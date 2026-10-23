import { useMutation, useQuery } from 'convex/react';
import { useEffect, useRef, useState } from 'react';
import { api } from '../../convex/_generated/api';
import { useAuthState } from '../auth';
import { errorCode, errorMessage } from '../convexClient';
import { useStuck } from '../lib/useConnectivity';
import { hrefFor, hrefForWorkspace, navigate, useRoute } from '../router';
import type { Route } from '../router';
import { ViewerApp } from '../viewer/ViewerApp';
import { SharedProfileApp } from '../viewer/SharedProfileApp';
import { Gate } from './Gate';
import type { GateState } from './Gate';
import { MemberApp } from './MemberApp';
import { useToast } from './Toast';

type RootProps = { reload?: () => void };

/** Decide qué se ve: el enlace de solo lectura, una pantalla de entrada o la aplicación de una persona con acceso. */
export function Root({ reload = () => window.location.reload() }: RootProps) {
  const route = useRoute();
  if (route.name === 'viewer') return <ViewerApp token={route.token!} />;
  if (route.name === 'profileShare') return <SharedProfileApp token={route.token!} />;
  return <MemberRoot route={route} reload={reload} />;
}

function MemberRoot({ route, reload }: { route: Route; reload: () => void }) {
  const isInvite = route.name === 'invite';
  const toast = useToast();
  const { state, me, signIn, signOut } = useAuthState({ tryOwner: !isInvite });
  const stuck = useStuck(state === 'loading');
  const peek = useQuery(api.invites.peek, isInvite ? { inviteToken: route.token! } : 'skip');
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

  const goHome = () => {
    setRevokedNotice(false);
    setInviteInvalid(false);
    navigate(hrefFor('board'));
  };

  const accept = async ({ name, roleLabel }: { name: string; roleLabel: string }) => {
    setBusy(true);
    setRedeemError('');
    try {
      const accepted = await redeem({ inviteToken: route.token!, name, roleLabel });
      navigate(hrefForWorkspace('board', accepted.workspaceId, accepted.isInitial));
      toast(`Bienvenido/a, ${name}.`);
    } catch (error) {
      const code = errorCode(error);
      if (code?.startsWith('INVITE_')) setInviteInvalid(true);
      else if (code === 'ALREADY_MEMBER') navigate(hrefFor('board'));
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
      suggestedName={me && 'name' in me && (me.status === 'none' || me.status === 'active') ? me.name : undefined}
      suggestedRole={me?.status === 'active' ? me.roleLabel : undefined}
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
  if (state === 'active') {
    if (isInvite) {
      if (inviteInvalid || peek?.valid === false) return gate('invalidInvite');
      if (!peek) return null;
      return gate('inviteName');
    }
    return <MemberApp me={me as Extract<typeof me, { status: 'active' }>} />;
  }

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
