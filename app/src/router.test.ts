import { afterEach, describe, expect, it } from 'vitest';
import { hrefFor, parseRoute, TABS } from './router';

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

  it('reads the invitation token', () => {
    expect(parseRoute('#/invitacion/abc')).toEqual({ name: 'invite', token: 'abc' });
    expect(parseRoute('#/invitacion/A-b_9')).toEqual({ name: 'invite', token: 'A-b_9' });
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

  it('builds the hash of each section', () => {
    expect(hrefFor('board')).toBe('#/');
    expect(hrefFor('calendar')).toBe('#/calendario');
    expect(hrefFor('journal')).toBe('#/bitacora');
    expect(hrefFor('history')).toBe('#/historial');
  });

  it('keeps the read-only token in the address', () => {
    expect(hrefFor('board', 'xyz')).toBe('#/ver/xyz');
    expect(hrefFor('journal', 'xyz')).toBe('#/ver/xyz/bitacora');
    expect(hrefFor('history', 'xyz')).toBe('#/ver/xyz/historial');
  });

  it('lists the tabs in order', () => {
    expect(TABS.map((t) => t.id)).toEqual(['board', 'calendar', 'journal', 'history']);
    expect(TABS.map((t) => t.label)).toEqual(['Tablero', 'Calendario', 'Bitácora', 'Historial']);
  });
});
