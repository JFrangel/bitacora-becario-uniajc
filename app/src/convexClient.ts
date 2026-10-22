import { ConvexReactClient } from 'convex/react';

/** Dirección del despliegue de Convex (la escribe `npx convex dev` en `.env.local`). */
export const CONVEX_URL = import.meta.env.VITE_CONVEX_URL as string | undefined;

/** Un único cliente para toda la aplicación; sin dirección configurada no se crea y la aplicación avisa. */
export const convex = CONVEX_URL ? new ConvexReactClient(CONVEX_URL) : null;

/** Código de error de aplicación (`ConvexError({ code })`) de una excepción, si lo trae. */
export function errorCode(error: unknown): string | undefined {
  const data = (error as { data?: unknown } | null)?.data;
  return data && typeof data === 'object' && 'code' in data ? String((data as { code: unknown }).code) : undefined;
}

/** Mensaje de aplicación de una excepción de Convex, si lo trae. */
export function errorMessage(error: unknown): string | undefined {
  const data = (error as { data?: unknown } | null)?.data;
  return data && typeof data === 'object' && 'message' in data ? String((data as { message: unknown }).message) : undefined;
}
