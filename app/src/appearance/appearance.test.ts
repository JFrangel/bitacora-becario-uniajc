import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyAppearance, DEFAULT_APPEARANCE, loadAppearance, saveAppearance, THEME_COLORS } from './appearance';

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('loadAppearance', () => {
  it('starts as Grafito claro', () => {
    expect(loadAppearance()).toEqual({ style: 'grafito', mode: 'light' });
    expect(DEFAULT_APPEARANCE).toEqual({ style: 'grafito', mode: 'light' });
  });

  it('reads back what was saved, for the six combinations', () => {
    for (const style of ['grafito', 'papel', 'tinta'] as const) {
      for (const mode of ['dark', 'light'] as const) {
        saveAppearance({ style, mode });
        expect(loadAppearance()).toEqual({ style, mode });
      }
    }
  });

  it.each(['{not json', 'null', '"texto"', '[]', '{"style":"neon","mode":"dark"}', '{"style":"papel","mode":"sepia"}', '{"style":"papel"}'])(
    'falls back to the default for %s',
    (raw) => {
      localStorage.setItem('bitacora.appearance', raw);
      expect(loadAppearance()).toEqual(DEFAULT_APPEARANCE);
    },
  );

  it('survives storage that throws (private window, blocked data)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(loadAppearance()).toEqual(DEFAULT_APPEARANCE);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => saveAppearance({ style: 'papel', mode: 'light' })).not.toThrow();
  });
});

describe('applyAppearance', () => {
  it('writes data-theme and data-mode, and the theme-color of the browser bar', () => {
    document.head.innerHTML = '<meta name="theme-color" content="#000000">';
    const root = document.createElement('div');
    applyAppearance(root, { style: 'papel', mode: 'light' });
    expect(root.dataset.theme).toBe('papel');
    expect(root.dataset.mode).toBe('light');
    expect(document.querySelector('meta[name="theme-color"]')!.getAttribute('content')).toBe(THEME_COLORS['papel-light']);
    applyAppearance(root, { style: 'tinta', mode: 'dark' });
    expect(root.dataset.theme).toBe('tinta');
    expect(document.querySelector('meta[name="theme-color"]')!.getAttribute('content')).toBe(THEME_COLORS['tinta-dark']);
  });

  it('creates the theme-color tag when the page does not have one', () => {
    document.head.innerHTML = '';
    applyAppearance(document.createElement('div'), DEFAULT_APPEARANCE);
    expect(document.querySelector('meta[name="theme-color"]')!.getAttribute('content')).toBe(THEME_COLORS['grafito-light']);
  });
});
