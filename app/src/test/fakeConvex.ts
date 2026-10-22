// Utilidades de PRUEBAS: reemplazan `convex/react` y `@convex-dev/auth/react` por un servidor falso y reactivo.
//
//   vi.mock('convex/react', async () => (await import('../test/fakeConvex')).convexReactMock);
//   vi.mock('@convex-dev/auth/react', async () => (await import('../test/fakeConvex')).convexAuthMock);
import { getFunctionName } from 'convex/server';
import type { FunctionReference } from 'convex/server';
import { createElement, useEffect, useMemo, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { vi } from 'vitest';

type QueryValue = unknown | ((args: Record<string, unknown>) => unknown);
type MutationHandler = (args: Record<string, unknown>) => unknown | Promise<unknown>;

const listeners = new Set<() => void>();
let version = 0;
const notify = () => {
  version += 1;
  listeners.forEach((listener) => listener());
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

type FakeApi = {
  auth: { isLoading: boolean; isAuthenticated: boolean };
  queries: Record<string, QueryValue>;
  mutations: Record<string, MutationHandler>;
  calls: Array<{ name: string; args: Record<string, unknown> }>;
  asked: Array<{ name: string; args: unknown }>;
  signIn: ReturnType<typeof vi.fn>;
  signOut: ReturnType<typeof vi.fn>;
  setAuth(next: Partial<FakeApi['auth']>): void;
  setQuery(name: string, value: QueryValue): void;
  onMutation(name: string, handler: MutationHandler): void;
  reset(): void;
  called(name: string): Array<{ name: string; args: Record<string, unknown> }>;
};

export const fake: FakeApi = {
  auth: { isLoading: false, isAuthenticated: false },
  queries: {} as Record<string, QueryValue>,
  mutations: {} as Record<string, MutationHandler>,
  /** Registro de cada llamada a una mutación: `{ name: 'tasks:move', args }`. */
  calls: [] as Array<{ name: string; args: Record<string, unknown> }>,
  /** Registro de cada consulta con sus argumentos (para comprobar qué se pidió). */
  asked: [] as Array<{ name: string; args: unknown }>,
  signIn: vi.fn(async (..._args: unknown[]) => ({ signingIn: false })),
  signOut: vi.fn(async () => {}),

  setAuth(next) {
    Object.assign(fake.auth, next);
    notify();
  },
  setQuery(name: string, value: QueryValue) {
    fake.queries[name] = value;
    notify();
  },
  onMutation(name: string, handler: MutationHandler) {
    fake.mutations[name] = handler;
  },
  reset() {
    fake.auth = { isLoading: false, isAuthenticated: false };
    fake.queries = {};
    fake.mutations = {};
    fake.calls = [];
    fake.asked = [];
    fake.signIn.mockClear();
    fake.signOut.mockClear();
    notify();
  },
  /** Mutaciones llamadas con ese nombre. */
  called(name: string) {
    return fake.calls.filter((call) => call.name === name);
  },
};

const nameOf = (ref: FunctionReference<'query' | 'mutation' | 'action'>) => getFunctionName(ref);

function useQuery(ref: FunctionReference<'query'>, args?: Record<string, unknown> | 'skip') {
  useSyncExternalStore(subscribe, () => version);
  if (args === 'skip') return undefined;
  const name = nameOf(ref);
  fake.asked.push({ name, args });
  if (!(name in fake.queries)) return undefined;
  const value = fake.queries[name];
  return typeof value === 'function' ? (value as (a: Record<string, unknown>) => unknown)(args ?? {}) : value;
}

function useMutation(ref: FunctionReference<'mutation'>) {
  const name = nameOf(ref);
  // Estable entre pintados, como el de Convex (la aplicación lo usa en las dependencias de sus efectos).
  return useMemo(() => {
    const run = async (args: Record<string, unknown> = {}) => {
      fake.calls.push({ name, args });
      const handler = fake.mutations[name];
      if (!handler) return undefined;
      return handler(args);
    };
    // La actualización optimista real la prueba cada módulo con su función pura; aquí solo se acepta el método.
    return Object.assign(run, { withOptimisticUpdate: () => run });
  }, [name]);
}

function useQueries(requests: Record<string, { query: FunctionReference<'query'>; args: Record<string, unknown> }>) {
  useSyncExternalStore(subscribe, () => version);
  // Como el de Convex: si cambia la identidad de `requests` se vuelve a suscribir, lo que avisa a todos y vuelve a pintar.
  // Quien cree el objeto nuevo en cada pintado cae en un bucle infinito (error «Too many re-renders»), igual que en producción.
  useEffect(() => {
    notify();
  }, [requests]);
  const results: Record<string, unknown> = {};
  for (const [key, { query, args }] of Object.entries(requests)) {
    const name = nameOf(query);
    fake.asked.push({ name, args });
    if (!(name in fake.queries)) continue;
    const value = fake.queries[name];
    results[key] = typeof value === 'function' ? (value as (a: Record<string, unknown>) => unknown)(args) : value;
  }
  return results;
}

export const convexReactMock = {
  useQuery,
  useQueries,
  useMutation,
  useAction: () => async () => undefined,
  useConvexAuth: () => {
    useSyncExternalStore(subscribe, () => version);
    return { ...fake.auth };
  },
  useConvex: () => ({}),
  ConvexReactClient: class {
    constructor(public url: string) {}
  },
  ConvexProvider: ({ children }: { children: ReactNode }) => createElement('div', null, children),
};

export const convexAuthMock = {
  useAuthActions: () => ({ signIn: fake.signIn, signOut: fake.signOut }),
  ConvexAuthProvider: ({ children }: { children: ReactNode }) => createElement('div', null, children),
};

/** Error de aplicación como el que lanza el servidor: `ConvexError({ code, message })`. */
export function appError(code: string, message = code) {
  const error = new Error(message) as Error & { data: { code: string; message: string } };
  error.data = { code, message };
  return error;
}
