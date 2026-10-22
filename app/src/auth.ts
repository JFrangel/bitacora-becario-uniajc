import { useAuthActions } from '@convex-dev/auth/react';
import { useConvexAuth, useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../convex/_generated/api';

export type Me = FunctionReturnType<typeof api.session.me>;
export type AuthState = 'loading' | 'anonymous' | 'no-access' | 'revoked' | 'active';

/**
 * Estado de la sesión de Google frente a la lista de personas del servidor.
 *  - `anonymous`: nadie inició sesión.
 *  - `active`: la cuenta tiene acceso vigente.
 *  - `revoked`: la dueña retiró el acceso (también si ocurre con la aplicación abierta).
 *  - `no-access`: la cuenta no es la dueña ni tiene una invitación.
 * La primera vez que entra la cuenta de la dueña se crea su registro con `session.ensureOwner`; cualquier otra cuenta
 * sin registro recibe FORBIDDEN y queda en `no-access`.
 */
export function useAuthState(options: { tryOwner?: boolean } = {}) {
  const { tryOwner = true } = options;
  const { isLoading, isAuthenticated } = useConvexAuth();
  const me = useQuery(api.session.me, isAuthenticated ? {} : 'skip') as Me | undefined;
  const ensureOwner = useMutation(api.session.ensureOwner);
  const { signIn, signOut } = useAuthActions();
  const [denied, setDenied] = useState(false);
  const tried = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) {
      tried.current = false;
      setDenied(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!tryOwner || !isAuthenticated || me?.status !== 'none' || tried.current) return;
    tried.current = true;
    ensureOwner({}).catch(() => setDenied(true));
  }, [tryOwner, isAuthenticated, me?.status, ensureOwner]);

  let state: AuthState;
  if (isLoading) state = 'loading';
  else if (!isAuthenticated) state = 'anonymous';
  else if (!me) state = 'loading';
  else if (me.status === 'active') state = 'active';
  else if (me.status === 'revoked') state = 'revoked';
  else if (me.status === 'none') state = !tryOwner || denied ? 'no-access' : 'loading';
  else state = 'anonymous';

  /** Abre el inicio de sesión de Google y vuelve a esta misma dirección (con su `#`, por si es una invitación). */
  const signInWithGoogle = useCallback(() => {
    const here = window.location.pathname + window.location.search + window.location.hash;
    return signIn('google', { redirectTo: here });
  }, [signIn]);

  return { state, me, signIn: signInWithGoogle, signOut };
}
