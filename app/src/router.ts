import { useEffect, useState } from 'react';

export type Tab = 'board' | 'calendar' | 'journal' | 'history';
export type Route = { name: Tab | 'invite' | 'viewer'; token?: string; view?: Tab };

export const TABS: ReadonlyArray<{ id: Tab; label: string; path: string }> = [
  { id: 'board', label: 'Tablero', path: '' },
  { id: 'calendar', label: 'Calendario', path: 'calendario' },
  { id: 'journal', label: 'Bitácora', path: 'bitacora' },
  { id: 'history', label: 'Historial', path: 'historial' },
];

const tabOf = (path: string | undefined): Tab | undefined => {
  if (path === 'tablero') return 'board';
  return TABS.find((tab) => tab.path !== '' && tab.path === path)?.id;
};

const safeDecode = (part: string) => {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
};

/** `#/` tablero · `#/calendario` · `#/bitacora` · `#/historial` · `#/invitacion/<token>` · `#/ver/<token>[/<sección>]`. */
export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(safeDecode);
  const [first, second, third] = parts;
  if (first === 'invitacion' && second) return { name: 'invite', token: second };
  if (first === 'ver' && second) {
    const view = tabOf(third);
    return view ? { name: 'viewer', token: second, view } : { name: 'viewer', token: second };
  }
  const tab = tabOf(first);
  if (tab) return { name: tab };
  return { name: 'board' };
}

/** Dirección de una sección; dentro del enlace de solo lectura conserva el token. */
export function hrefFor(tab: Tab, viewerToken?: string): string {
  const path = TABS.find((t) => t.id === tab)!.path;
  if (viewerToken) return `#/ver/${viewerToken}${path ? `/${path}` : ''}`;
  return path ? `#/${path}` : '#/';
}

/** La ruta actual, al día con los cambios del hash. */
export function useRoute(): Route {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return parseRoute(hash);
}

export function navigate(href: string): void {
  if (window.location.hash === href) return;
  window.location.hash = href;
}
