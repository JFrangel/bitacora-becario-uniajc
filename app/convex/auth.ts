import Google from '@auth/core/providers/google';
import { convexAuth } from '@convex-dev/auth/server';

// Solo el proveedor Google: el correo de `users` viene de Google, así que `OWNER_EMAIL` es confiable.
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({ providers: [Google] });
