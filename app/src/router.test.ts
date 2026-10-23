import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { hrefFor, hrefForWorkspace, navigate, parseRoute, TABS, useRoute } from './router';

describe('parseRoute', () => {
  it('opens the board when there is no hash', () => {
    expect(parseRoute('')).toEqual({ name: 'board' });
    expect(parseRoute('#')).toEqual({ name: 'board' });
    expect(parseRoute('#/')).toEqual({ name: 'board' });
  });

  it('maps the four sections', () => {
    expect(parseRoute('#/calendario')).toEqual({ name: 'calendar' });
    expect(parseRoute('#/bitacora')).toEqual({ name: 'journal' });
    expect(parseRoute('#/historial')).toEqual({ name: 'history' });
    expect(parseRoute('#/tablero')).toEqual({ name: 'board' });
  });

  it('maps clean paths as well as the legacy hash routes', () => {
    expect(parseRoute('/calendario')).toEqual({ name: 'calendar' });
    expect(parseRoute('/bitacora')).toEqual({ name: 'journal' });
    expect(parseRoute('/historial')).toEqual({ name: 'history' });
    expect(parseRoute('/ver/xyz/bitacora')).toEqual({ name: 'viewer', token: 'xyz', view: 'journal' });
    expect(parseRoute('/invitacion/A-b_9')).toEqual({ name: 'invite', token: 'A-b_9' });
    expect(parseRoute('/perfil/A-b_9')).toEqual({ name: 'profileShare', token: 'A-b_9' });
    expect(parseRoute('/espacio/workspaces%3Aabc/bitacora')).toEqual({ name: 'workspace', workspaceId: 'workspaces:abc', view: 'journal' });
  });

  it('reads the invitation token', () => {
    expect(parseRoute('#/invitacion/abc')).toEqual({ name: 'invite', token: 'abc' });
    expect(parseRoute('#/invitacion/A-b_9')).toEqual({ name: 'invite', token: 'A-b_9' });
  });

  it('reads a workspace and its section without changing legacy routes', () => {
    expect(parseRoute('#/espacio/workspaces%3Aabc')).toEqual({ name: 'workspace', workspaceId: 'workspaces:abc', view: undefined });
    expect(parseRoute('#/espacio/workspaces%3Aabc/bitacora')).toEqual({ name: 'workspace', workspaceId: 'workspaces:abc', view: 'journal' });
  });

  it('reads an individual profile share token separately from the board share', () => {
    expect(parseRoute('#/perfil/A-b_9')).toEqual({ name: 'profileShare', token: 'A-b_9' });
  });

  it('reads the read-only token and the section inside the read-only view', () => {
    expect(parseRoute('#/ver/xyz')).toEqual({ name: 'viewer', token: 'xyz' });
    expect(parseRoute('#/ver/xyz/calendario')).toEqual({ name: 'viewer', token: 'xyz', view: 'calendar' });
    expect(parseRoute('#/ver/xyz/bitacora')).toEqual({ name: 'viewer', token: 'xyz', view: 'journal' });
    expect(parseRoute('#/ver/xyz/historial')).toEqual({ name: 'viewer', token: 'xyz', view: 'history' });
    expect(parseRoute('#/ver/xyz/inexistente')).toEqual({ name: 'viewer', token: 'xyz' });
  });

  it('falls back to the board for anything unknown or without a token', () => {
    expect(parseRoute('#/nada')).toEqual({ name: 'board' });
    expect(parseRoute('#/invitacion/')).toEqual({ name: 'board' });
    expect(parseRoute('#/ver')).toEqual({ name: 'board' });
    expect(parseRoute('#/ver/')).toEqual({ name: 'board' });
  });

  it('never throws on odd input', () => {
    for (const hash of ['#/%E0%A4%A', '#//', '#/invitacion/%', '#/ver/a/b/c/d']) expect(() => parseRoute(hash)).not.toThrow();
  });
});

describe('hrefFor', () => {
  afterEach(() => history.replaceState(null, '', '/'));

  it('builds clean paths for each section by default', () => {
    expect(hrefFor('board')).toBe('/');
    expect(hrefFor('calendar')).toBe('/calendario');
    expect(hrefFor('journal')).toBe('/bitacora');
    expect(hrefFor('history')).toBe('/historial');
  });

  it('keeps the read-only token in clean paths', () => {
    expect(hrefFor('board', 'xyz')).toBe('/ver/xyz');
    expect(hrefFor('journal', 'xyz')).toBe('/ver/xyz/bitacora');
    expect(hrefFor('history', 'xyz')).toBe('/ver/xyz/historial');
  });

  it('keeps navigation in hash mode for existing shared links', () => {
    window.history.replaceState(null, '', '/#/ver/legacy');
    expect(hrefFor('journal', 'legacy')).toBe('#/ver/legacy/bitacora');
  });

  it('uses a dedicated route for a new workspace and preserves the initial workspace links', () => {
    expect(hrefForWorkspace('board', 'workspaces:abc')).toBe('/espacio/workspaces%3Aabc');
    expect(hrefForWorkspace('journal', 'workspaces:abc')).toBe('/espacio/workspaces%3Aabc/bitacora');
    expect(hrefForWorkspace('journal', 'workspaces:legacy', true)).toBe('/bitacora');
  });

  it('updates active routes when navigating with clean paths', () => {
    const { result } = renderHook(() => useRoute());
    act(() => navigate('/bitacora'));
    expect(result.current).toEqual({ name: 'journal' });
  });

  it('lists the tabs in order', () => {
    expect(TABS.map((t) => t.id)).toEqual(['board', 'calendar', 'journal', 'history']);
    expect(TABS.map((t) => t.label)).toEqual(['Tablero', 'Calendario', 'Bitácora', 'Historial']);
  });
});
