import { describe, expect, it } from 'vitest';
import { THEME_COLORS } from '../appearance/appearance';
import { contrast, MODES, STYLES, themeVars } from './themeTools';

const themes = themeVars();
const KEYS = STYLES.flatMap((style) => MODES.map((mode) => `${style}-${mode}` as const));

describe('contrast helper', () => {
  it('matches the WCAG reference values', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 1);
    expect(contrast('#fff', '#fff')).toBeCloseTo(1, 5);
  });
});

describe('the six themes (3 styles × dark and light)', () => {
  it.each(KEYS)('%s is defined', (key) => {
    expect(themes[key], `falta el bloque de variables de ${key}`).toBeDefined();
  });

  it.each(KEYS)('%s: text reaches AA (4.5:1)', (key) => {
    const v = themes[key]!;
    expect(contrast(v['--ink'], v['--bg']), '--ink sobre --bg').toBeGreaterThanOrEqual(4.5);
    expect(contrast(v['--ink'], v['--surface']), '--ink sobre --surface').toBeGreaterThanOrEqual(4.5);
    expect(contrast(v['--muted'], v['--surface']), '--muted sobre --surface').toBeGreaterThanOrEqual(4.5);
    expect(contrast(v['--muted'], v['--bg']), '--muted sobre --bg').toBeGreaterThanOrEqual(4.5);
  });

  it.each(['tinta-dark', 'tinta-light'] as const)('%s: the text on lime is --on-lime (#0e0e0e) and passes', (key) => {
    const v = themes[key]!;
    expect(v['--on-lime'].toLowerCase()).toBe('#0e0e0e');
    expect(contrast(v['--on-lime'], v['--lime'])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(['grafito-dark', 'grafito-light'] as const)('%s: the text on the accent passes', (key) => {
    const v = themes[key]!;
    expect(contrast(v['--accent-ink'], v['--accent'])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(KEYS)('%s: the theme-color of the browser bar is its background', (key) => {
    expect(THEME_COLORS[key].toLowerCase()).toBe(themes[key]!['--bg'].toLowerCase());
  });
});
