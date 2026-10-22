// Reemplaza `convex/react` en la vista previa: las consultas y mutaciones viajan por HTTP al servidor de ejemplo
// (`demo/plugin.ts`), que ejecuta las funciones reales de `convex/`. Cuando algo cambia, todas las consultas abiertas se
// vuelven a pedir, así la pantalla se actualiza sola igual que con Convex.
import { getFunctionName } from 'convex/server';
import type { FunctionReference } from 'convex/server';
import { createElement, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { getWho, subscribeWho } from './identity';

type Entry = { value?: unknown; error?: unknown; loaded: boolean; users: number };
const entries = new Map<string, Entry>();
const listeners = new Set<() => void>();
let tick = 0;
const emit = () => {
  tick += 1;
  listeners.forEach((listener) => listener());
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

class DemoError extends Error {
  data: unknown;
  constructor(message: string, data: unknown) {
    super(message);
    this.data = data;
  }
}

async function call(kind: 'query' | 'mutation', name: string, args: unknown) {
  const response = await fetch(`/__demo/${kind}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-demo-who': getWho() }, body: JSON.stringify({ name, args: args ?? {} }) });
  const body = (await response.json()) as { ok: boolean; value?: unknown; message?: string; data?: unknown };
  if (!body.ok) throw new DemoError(body.message ?? 'Error del servidor', body.data);
  return body.value ?? undefined;
}

const keyOf = (name: string, args: unknown) => `${getWho()}|${name}|${JSON.stringify(args ?? {})}`;

async function fetchEntry(key: string, name: string, args: unknown) {
  const entry = entries.get(key);
  if (!entry) return;
  try {
    entry.value = await call('query', name, args);
    entry.error = undefined;
  } catch (error) {
    entry.error = error;
  }
  entry.loaded = true;
  emit();
}

const requests = new Map<string, { name: string; args: unknown }>();

function refreshAll() {
  for (const [key, request] of requests) if (entries.get(key)?.users) void fetchEntry(key, request.name, request.args);
}

// Sondeo de cambios: cuando el servidor de ejemplo avisa que algo cambió, se vuelve a pedir todo lo que está abierto.
let version = -1;
let polling = false;
function startPolling() {
  if (polling) return;
  polling = true;
  const poll = async () => {
    try {
      const { version: next } = (await (await fetch('/__demo/version')).json()) as { version: number };
      if (version !== -1 && next !== version) refreshAll();
      version = next;
    } catch {
      /* el servidor de ejemplo se reinicia */
    }
    setTimeout(poll, 600);
  };
  void poll();
}
subscribeWho(() => {
  entries.clear();
  emit();
});

type AnyRef = FunctionReference<'query' | 'mutation' | 'action'>;

function useEntry(ref: AnyRef | undefined, args: unknown): Entry | undefined {
  useSyncExternalStore(subscribe, () => tick);
  useSyncExternalStore(subscribeWho, getWho);
  const name = ref ? getFunctionName(ref) : '';
  const key = ref ? keyOf(name, args) : '';
  const active = ref !== undefined && args !== 'skip';
  const last = useRef('');
  if (active && !entries.has(key)) entries.set(key, { loaded: false, users: 0 });
  useEffect(() => {
    if (!active) return undefined;
    startPolling();
    const entry = entries.get(key)!;
    entry.users += 1;
    requests.set(key, { name, args });
    if (!entry.loaded && last.current !== key) void fetchEntry(key, name, args);
    last.current = key;
    return () => {
      entry.users -= 1;
    };
    // `args` casi siempre es un objeto nuevo en cada pintado: lo que cuenta es `key`, que ya lo incluye.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, key]);
  return active ? entries.get(key) : undefined;
}

export function useQuery(ref: FunctionReference<'query'>, args?: unknown) {
  const entry = useEntry(ref, args);
  if (entry?.error) throw entry.error;
  return entry?.loaded ? entry.value : undefined;
}

export function useQueries(queries: Record<string, { query: FunctionReference<'query'>; args: unknown }>) {
  useSyncExternalStore(subscribe, () => tick);
  const results: Record<string, unknown> = {};
  const keys = Object.entries(queries).map(([name, { query, args }]) => ({ name, key: keyOf(getFunctionName(query), args), fn: getFunctionName(query), args }));
  for (const item of keys) if (!entries.has(item.key)) entries.set(item.key, { loaded: false, users: 0 });
  const joined = keys.map((item) => item.key).join('\n');
  useEffect(() => {
    startPolling();
    const mine = keys.map((item) => ({ ...item, entry: entries.get(item.key)! }));
    for (const item of mine) {
      item.entry.users += 1;
      requests.set(item.key, { name: item.fn, args: item.args });
      if (!item.entry.loaded) void fetchEntry(item.key, item.fn, item.args);
    }
    return () => mine.forEach((item) => (item.entry.users -= 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined]);
  for (const item of keys) {
    const entry = entries.get(item.key)!;
    if (entry.error) throw entry.error;
    if (entry.loaded) results[item.name] = entry.value;
  }
  return results;
}

export function useMutation(ref: FunctionReference<'mutation'>) {
  const name = getFunctionName(ref);
  // Estable entre pintados, como el de Convex: la aplicación lo usa en las dependencias de sus efectos.
  return useMemo(() => {
    const run = async (args?: unknown) => {
      const result = await call('mutation', name, args);
      refreshAll();
      return result;
    };
    return Object.assign(run, { withOptimisticUpdate: () => run });
  }, [name]);
}

export const useAction = () => async () => undefined;
export const useConvex = () => ({});
export function useConvexAuth() {
  useSyncExternalStore(subscribeWho, getWho);
  return { isLoading: false, isAuthenticated: getWho() !== 'anonymous' };
}
export class ConvexReactClient {
  constructor(public url: string) {}
}
export const ConvexProvider = ({ children }: { children: ReactNode }) => createElement('div', { style: { display: 'contents' } }, children);
export const ConvexProviderWithAuth = ConvexProvider;
