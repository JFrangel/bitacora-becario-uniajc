// Reemplaza `@convex-dev/auth/react` en la vista previa: «Entrar con Google» entra como la dueña y «Cerrar sesión» sale.
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { getWho, setWho } from './identity';

export const useAuthActions = () => ({
  signIn: async () => {
    if (getWho() === 'anonymous') setWho('owner');
    return { signingIn: true };
  },
  signOut: async () => setWho('anonymous'),
});

export const ConvexAuthProvider = ({ children }: { client?: unknown; children: ReactNode }) => createElement('div', { style: { display: 'contents' } }, children);
