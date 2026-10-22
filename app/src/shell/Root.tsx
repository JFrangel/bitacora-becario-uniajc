import { useMutation, useQuery } from 'convex/react';
import { useEffect, useRef, useState } from 'react';
import { api } from '../../convex/_generated/api';
import { useAuthState } from '../auth';
import { errorCode, errorMessage } from '../convexClient';
import { useStuck } from '../lib/useConnectivity';
import { navigate, useRoute } from '../router';
import type { Route } from '../router';
import { ViewerApp } from '../viewer/ViewerApp';
import { Gate } from './Gate';
import type { GateState } from './Gate';
import { MemberApp } from './MemberApp';
import { useToast } from './Toast';

type RootProps = { reload?: () => void };

/** Decide qué se ve: el enlace de solo lectura, una pantalla de entrada o la aplicación de una persona con acceso. */
export function Root({ reload = () => window.location.reload() }: RootProps) {
  const route = useRoute();
  if (route.name === 'viewer') return <ViewerApp token={route.token!} />;
  return <MemberRoot route={route} reload={reload} />;
}

function MemberRoot({ route, reload }: { route: Route; reload: () => void }) {
  const isInvite = route.name === 'invite';
  const toast = useToast();
  const { state, me, signIn, signOut } = useAuthState({ tryOwner: !isInvite });
  const stuck = useStuck(state === 'loading');
  const peek = useQuery(api.invites.peek, isInvite && state === 'anonymous' ? { inviteToken: route.token! } : 'skip');
  const redeem = useMutation(api.invites.redeem);

  const [revokedNotice, setRevokedNotice] = useState(false);
  const [inviteInvalid, setInviteInvalid] = useState(false);
  const [redeemError, setRedeemError] = useState('');
  const [busy, setBusy] = useState(false);
  const signedOut = useRef(false);

  // Acceso retirado (también con la aplicación abierta): se avisa y se cierra la sesión una sola vez.
  useEffect(() => {
    if (state !== 'revoked' || isInvite) return;
    setRevokedNotice(true);
    if (!signedOut.current) {
      signedOut.current = true;
      void signOut();
    }
  }, [state, isInvite, signOut]);
  useEffect(() => {
    if (state === 'active') signedOut.current = false;
  }, [state]);

  // Quien ya tiene acceso y abre una invitación va directo al tablero.
  useEffect(() => {
    if (isInvite && state === 'active') navigate('#/');
  }, [isInvite, state]);

  const goHome = () => {
    setRevokedNotice(false);
    setInviteInvalid(false);
    navigate('#/');
  };

  const accept = async ({ name, roleLabel }: { name: string; roleLabel: string }) => {
    setBusy(true);
    setRedeemError('');
    try {
      await redeem({ inviteToken: route.token!, name, roleLabel });
      navigate('#/');
      toast(`Bienvenido/a, ${name}.`);
    } catch (error) {
      const code = errorCode(error);
      if (code?.startsWith('INVITE_')) setInviteInvalid(true);
      else if (code === 'ALREADY_MEMBER') navigate('#/');
      else if (code === 'VALIDATION') setRedeemError(errorMessage(error) ?? 'Revisa tu nombre y tu rol.');
      else setRedeemError('No se pudo aceptar la invitación. Inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  const gate = (name: GateState) => (
    <Gate
      state={name}
      email={me && 'email' in me ? me.email : undefined}
      suggestedName={me && 'name' in me && me.status === 'none' ? me.name : undefined}
      error={redeemError}
      busy={busy}
      onGoogle={() => void signIn()}
      onHome={goHome}
      onRetry={reload}
      onOtherAccount={() => void signOut()}
      onAccept={(values) => void accept(values)}
    />
  );

  if (revokedNotice) return gate('revoked');
  if (stuck) return gate('offline');
  if (state === 'loading') return null;
  if (state === 'active') return <MemberApp me={me as Extract<typeof me, { status: 'active' }>} />;

  if (isInvite) {
    if (inviteInvalid) return gate('invalidInvite');
    if (state === 'anonymous') {
      if (!peek) return null;
      return gate(peek.valid ? 'invite' : 'invalidInvite');
    }
    return gate('inviteName');
  }
  if (state === 'anonymous') return gate('login');
  if (state === 'revoked') return gate('revoked');
  return gate('noAccess');
}
