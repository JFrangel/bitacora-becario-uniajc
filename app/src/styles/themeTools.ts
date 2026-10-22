// Utilidades de PRUEBAS: variables efectivas de los seis temas y contraste WCAG.
import { expect } from 'vitest';
import type { Mode, Style } from '../appearance/appearance';
import { allRules, declarations } from './cssFiles';

export const STYLES: Style[] = ['grafito', 'papel', 'tinta'];
export const MODES: Mode[] = ['dark', 'light'];

/** Variables efectivas de cada tema: el bloque base del estilo más el bloque de su modo, si lo tiene. */
export function themeVars() {
  const base: Partial<Record<Style, Record<string, string>>> = {};
  const byMode: Partial<Record<`${Style}-${Mode}`, Record<string, string>>> = {};
  for (const rule of allRules()) {
    const match = /^\.app\[data-theme="(\w+)"\](?:\[data-mode="(\w+)"\])?$/.exec(rule.selector);
    if (!match) continue;
    const [, style, mode] = match as unknown as [string, Style, Mode | undefined];
    const vars = declarations(rule.body);
    if (mode) byMode[`${style}-${mode}`] = { ...(byMode[`${style}-${mode}`] ?? {}), ...vars };
    else base[style] = { ...(base[style] ?? {}), ...vars };
  }
  // Cada estilo define por defecto un modo (Grafito oscuro; Papel y Tinta viva claros) y el otro lo sobrescribe.
  const defaultMode: Record<Style, Mode> = { grafito: 'dark', papel: 'light', tinta: 'light' };
  const result: Record<string, Record<string, string> | undefined> = {};
  for (const style of STYLES) {
    for (const mode of MODES) {
      const key = `${style}-${mode}` as const;
      if (!base[style]) result[key] = undefined;
      else if (mode === defaultMode[style] && !byMode[key]) result[key] = base[style];
      else result[key] = byMode[key] ? { ...base[style], ...byMode[key] } : undefined;
    }
  }
  return result;
}

export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.trim().replace('#', '');
  const full = clean.length === 3 ? [...clean].map((c) => c + c).join('') : clean;
  expect(full, `color ${hex}`).toMatch(/^[0-9a-f]{6}$/i);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

