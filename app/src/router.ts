import { useEffect, useState } from 'react';

export type Tab = 'board' | 'calendar' | 'journal' | 'history';
export type Route = { name: Tab | 'workspace' | 'invite' | 'viewer' | 'profileShare'; token?: string; workspaceId?: string; view?: Tab };

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

/** Legacy `#/` routes and clean paths: `/espacio/<id>[/<sección>]`, shares and profiles. */
export function parseRoute(location: string): Route {
  const routePath = location.startsWith('#') ? location.slice(1) : location.split(/[?#]/, 1)[0];
  const parts = routePath.replace(/^\/+/, '').split('/').filter(Boolean).map(safeDecode);
  const [first, second, third] = parts;
  if (first === 'invitacion' && second) return { name: 'invite', token: second };
  if (first === 'ver' && second) {
    const view = tabOf(third);
    return view ? { name: 'viewer', token: second, view } : { name: 'viewer', token: second };
  }
  if (first === 'perfil' && second) return { name: 'profileShare', token: second };
  if (first === 'espacio' && second) return { name: 'workspace', workspaceId: second, view: tabOf(third) };
  const tab = tabOf(first);
  if (tab) return { name: tab };
  return { name: 'board' };
}

const usesLegacyHash = () => window.location.hash.startsWith('#/');
const appHref = (path: string) => (usesLegacyHash() ? `#/${path}` : `/${path}`);

/** Dirección de una sección; dentro del enlace de solo lectura conserva el token. */
export function hrefFor(tab: Tab, viewerToken?: string): string {
  const path = TABS.find((t) => t.id === tab)!.path;
  if (viewerToken) return appHref(`ver/${encodeURIComponent(viewerToken)}${path ? `/${path}` : ''}`);
  return appHref(path);
}

/** Los espacios nuevos tienen ruta propia; el inicial conserva el formato de URL con el que se abrió la app. */
export function hrefForWorkspace(tab: Tab, workspaceId?: string, isInitial = false): string {
  if (!workspaceId || isInitial) return hrefFor(tab);
  const path = TABS.find((t) => t.id === tab)!.path;
  return appHref(`espacio/${encodeURIComponent(workspaceId)}${path ? `/${path}` : ''}`);
}

/** La ruta actual, al día con los cambios de URL y las rutas heredadas con hash. */
export function useRoute(): Route {
  const [location, setLocation] = useState(() => window.location.hash || window.location.pathname);
  useEffect(() => {
    const onChange = () => setLocation(window.location.hash || window.location.pathname);
    window.addEventListener('hashchange', onChange);
    window.addEventListener('popstate', onChange);
    return () => {
      window.removeEventListener('hashchange', onChange);
      window.removeEventListener('popstate', onChange);
    };
  }, []);
  return parseRoute(location);
}

export function navigate(href: string): void {
  if (href.startsWith('#')) {
    if (window.location.hash === href) return;
    window.location.hash = href;
    return;
  }
  const target = new URL(href, window.location.origin);
  const next = `${target.pathname}${target.search}${target.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (current === next) return;
  window.history.pushState(null, '', next);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
