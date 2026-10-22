import { describe, expect, it } from 'vitest';
import { allRules, cssPaths, readCss, stripComments } from './cssFiles';

/** Criterio 26: presupuesto de movimiento (sección 10 de la especificación). */
const ALLOWED_INFINITE = new Set(['pulse', 'wiggle']);
/** Elementos únicos (no se repiten por tarjeta): pueden animar su ancho o posición. */
const SINGLE_ELEMENTS = ['.indicator', '.pop', '.drawer', '.toast', '.scrim', '.gallery', '.gate', '.badge-stage', '.badge-hit', '.journal-badge', '.nav'];

const all = allRules();
const withDecl = (prop: RegExp) => all.filter((rule) => prop.test(rule.body));

describe('motion budget (criterion 26)', () => {
  it('reads the project stylesheets', () => {
    expect(cssPaths().length).toBeGreaterThanOrEqual(7);
  });

  it('has no backdrop-filter anywhere', () => {
    const offenders = cssPaths().filter((path) => /backdrop-filter/.test(stripComments(readCss(path))));
    expect(offenders).toEqual([]);
  });

  it('has no filter on the badge container or on a canvas', () => {
    const offenders = withDecl(/(^|[;\s{])filter\s*:/).filter((rule) => /canvas|badge|lanyard/i.test(rule.selector));
    expect(offenders.map((r) => r.selector)).toEqual([]);
  });

  it('only loops the allowed animations forever', () => {
    const offenders: string[] = [];
    for (const rule of withDecl(/animation[^:]*:[^;]*infinite/)) {
      for (const match of rule.body.matchAll(/animation(?:-name)?\s*:\s*([^;]+);/g)) {
        if (!/infinite/.test(match[1])) continue;
        const names = match[1].split(/[\s,]+/).filter((token) => /^[a-z][\w-]*$/i.test(token) && !/^(infinite|ease|linear|ease-in|ease-out|ease-in-out|alternate|forwards|backwards|both|normal|reverse|running|paused)$/.test(token));
        if (!names.some((name) => ALLOWED_INFINITE.has(name))) offenders.push(`${rule.selector} → ${match[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('does not transition width, height, top or left on repeated elements', () => {
    const offenders = withDecl(/transition[^:]*:[^;]*\b(width|height|top|left)\b/)
      .filter((rule) => !SINGLE_ELEMENTS.some((single) => rule.selector.split(',').every((part) => part.includes(single))))
      .map((rule) => rule.selector);
    expect(offenders).toEqual([]);
  });

  it('never uses content-visibility on .entry', () => {
    const offenders = withDecl(/content-visibility/).filter((rule) => /\.entry/.test(rule.selector));
    expect(offenders.map((r) => r.selector)).toEqual([]);
  });

  it('turns every animation off for people who ask for reduced motion', () => {
    const css = cssPaths().map((path) => stripComments(readCss(path))).join('\n');
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    expect(css).toMatch(/animation:\s*none\s*!important/);
  });
});
