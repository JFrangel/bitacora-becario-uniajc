import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BadgeData } from '../../../convex/lib/profile';
import { fakeCanvasFactory, logoMask, portrait } from '../../test/fakeCanvas';
import { THEME_COLORS } from '../../appearance/appearance';
import { contrast, MODES, STYLES, themeVars } from '../../styles/themeTools';
import { DESIGN_ORDER, DESIGNS } from './badgeDesigns';
import type { BadgeDesignId } from './badgeDesigns';
import { brandColors, cachedFaces, clearFaceCache, drawBadgeFaces, faceKey, hasGroupLogo, onAccentFor } from './badgeFaces';
import type { Palette } from './badgeFaces';

const data: BadgeData = {
  name: 'Jose Frangel Padilla Camacho',
  roleLabel: 'Becario',
  isOwner: true,
  since: 1,
  program: 'Ingeniería de Sistemas',
  term: '10.º semestre',
  institution: 'Institución Universitaria Antonio José Camacho',
  group: 'AthenIA',
};
const palette: Palette = { bg: '#111416', ink: '#eef3f1', muted: '#93a09c', accent: '#66c6a9', line: '#22292b', fontMono: '"JetBrains Mono", monospace', fontBody: 'Inter, sans-serif', dark: true };

beforeEach(() => {
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:fake', revokeObjectURL: () => {} }));
});

async function draw(design: BadgeDesignId, extra: { data?: Partial<BadgeData>; photo?: boolean; logo?: boolean } = {}) {
  const factory = fakeCanvasFactory();
  const faces = await drawBadgeFaces(
    { design, data: { ...data, ...extra.data }, palette, photo: extra.photo === false ? null : portrait, logoMask: extra.logo === false ? null : logoMask },
    factory.make,
  );
  // Los lienzos teñidos del logotipo también se crean aquí: el frente y el reverso son los dos de 2048 de ancho; la cinta, la de 96 de alto.
  const [front, back] = factory.canvases.filter((c) => c.width === 2048);
  const strap = factory.canvases.find((c) => c.height === 96)!;
  return { faces, factory, front, back, strap };
}

describe('the five designs', () => {
  it('are exactly the ones the owner chose, with Olimpo first', () => {
    expect(DESIGN_ORDER).toEqual(['olimpo', 'circuito', 'poster', 'suizo', 'clasico']);
    expect(Object.keys(DESIGNS).sort()).toEqual([...DESIGN_ORDER].sort());
    expect(Object.fromEntries(DESIGN_ORDER.map((id) => [id, DESIGNS[id].finish]))).toEqual({ olimpo: 'glossy', circuito: 'glossy', poster: 'glossy', suizo: 'matte', clasico: 'glossy' });
  });

  it.each(DESIGN_ORDER)('%s draws without throwing, with and without a photo, with and without the logo', async (design) => {
    for (const photo of [true, false]) {
      for (const logo of [true, false]) {
        const { faces } = await draw(design, { photo, logo, data: logo ? {} : { group: 'Otro grupo' } });
        expect(faces.front).toMatch(/^blob:/);
        expect(faces.back).toMatch(/^blob:/);
        expect(faces.strap).toMatch(/^blob:/);
      }
    }
  });

  it.each(DESIGN_ORDER)('%s writes the name, the role, the program and the institution on the front', async (design) => {
    const { front } = await draw(design);
    const text = front.texts.join(' ').toLowerCase();
    expect(text).toContain('padilla');
    expect(text).toMatch(/becario/);
    expect(text).toMatch(/ingenier/);
    expect(text).toMatch(/instituci/);
  });

  it.each(DESIGN_ORDER)('%s never prints an e-mail address, a phone number or a document number', async (design) => {
    const { front, back, strap } = await draw(design);
    for (const canvas of [front, back, strap]) {
      for (const text of canvas.texts) {
        expect(text, `${design}: ${text}`).not.toMatch(/@/);
        expect(text, `${design}: ${text}`).not.toMatch(/\d{7,}/);
      }
    }
  });

  it.each(DESIGN_ORDER)('%s does not say «Bitácora» or the year on the front when the group is AthenIA', async (design) => {
    const { front } = await draw(design);
    const text = front.texts.join(' ');
    expect(text).not.toMatch(/bit[aá]cora/i);
    expect(text).not.toMatch(/20\d\d/);
  });

  it('draws the logo only when the group name contains AthenIA, whatever the capitalization', async () => {
    const withLogo = await draw('olimpo', { data: { group: 'athenia' } });
    const without = await draw('olimpo', { data: { group: 'Otro grupo' } });
    // El logotipo se tiñe en un lienzo aparte: con logotipo se crean más lienzos.
    expect(withLogo.factory.canvases.length).toBeGreaterThan(without.factory.canvases.length);
    expect(hasGroupLogo('AthenIA')).toBe(true);
    expect(hasGroupLogo('ATHENIA – semillero')).toBe(true);
    expect(hasGroupLogo('Otro grupo')).toBe(false);
    expect(hasGroupLogo(undefined)).toBe(false);
  });

  it('Olimpo shows <Becario de="AthenIA" /> as code', async () => {
    const { front } = await draw('olimpo');
    expect(front.texts).toEqual(expect.arrayContaining(['<', 'Becario', ' de', '=', '"AthenIA"', ' />']));
    expect(front.texts.some((t) => t.startsWith('const '))).toBe(true);
    expect(front.texts).toContain('athenia.ts');
  });

  it('only Circuito animates, with a halo inside the card that needs no per-frame drawing', async () => {
    for (const design of DESIGN_ORDER) {
      const { faces } = await draw(design);
      if (design !== 'circuito') {
        expect(faces.fx, design).toBeUndefined();
        continue;
      }
      expect(faces.fx).toBeDefined();
      const { size, dot, dotColor } = faces.fx!;
      expect(size).toEqual([1024, 1440]);
      expect(dot[0]).toBeGreaterThan(0);
      expect(dot[0]).toBeLessThan(1024);
      expect(dot[1]).toBeGreaterThan(0);
      expect(dot[1]).toBeLessThan(1440);
      expect(dot[2]).toBeGreaterThan(0);
      expect(dotColor).toMatch(/^#[0-9a-f]{6}$/i);
      expect(Object.keys(faces.fx!).sort()).toEqual(['dot', 'dotColor', 'size']);
    }
  });

  it('draws the faces at twice the logical size and the strap at 1024 × 96', async () => {
    const { front, back, strap } = await draw('suizo');
    expect([front.width, front.height]).toEqual([2048, 2880]);
    expect([back.width, back.height]).toEqual([2048, 2880]);
    expect([strap.width, strap.height]).toEqual([1024, 96]);
  });

  it('gives the poster its own card color and the others the style background', async () => {
    expect((await draw('poster')).faces.cardColor).toBe('#0b2f73');
    expect((await draw('olimpo')).faces.cardColor).toBe(palette.bg);
  });

  it('falls back to Olimpo for an unknown design', async () => {
    const { faces } = await draw('desconocido' as BadgeDesignId);
    expect(faces.finish).toBe('glossy');
  });
});

describe('colors on the brand and on the accent (AA in the six themes)', () => {
  const themes = themeVars();

  it.each(STYLES.flatMap((style) => MODES.map((mode) => `${style}-${mode}` as const)))('%s: the text over the accent reaches 4.5:1', (key) => {
    const vars = themes[key]!;
    const accent = vars['--accent'];
    expect(contrast(onAccentFor(accent), accent), 'Clásico: texto sobre el acento').toBeGreaterThanOrEqual(4.5);
    expect(contrast(brandColors(accent, key.endsWith('dark'), false).onBrand, accent), 'Olimpo sin logotipo').toBeGreaterThanOrEqual(4.5);
    const dark = key.endsWith('dark');
    const { brand, onBrand } = brandColors(accent, dark, true);
    expect(contrast(onBrand, brand), 'Olimpo con logotipo').toBeGreaterThanOrEqual(4.5);
    expect(THEME_COLORS[key]).toBeDefined();
  });
});

describe('the face cache', () => {
  beforeEach(() => clearFaceCache());

  it('draws once for the same design, theme and profile version', async () => {
    const make = vi.fn(async () => ({ front: 'f', back: 'b', strap: 's', cardColor: '#000', finish: 'glossy' as const }));
    const key = faceKey('olimpo', 2, 'grafito', 'dark', 100);
    const [a, b] = await Promise.all([cachedFaces(key, make), cachedFaces(key, make)]);
    expect(a).toBe(b);
    expect(make).toHaveBeenCalledTimes(1);
  });

  it('draws again when the profile was updated (updatedAt changes) or the design or theme changes', async () => {
    const make = vi.fn(async () => ({ front: 'f', back: 'b', strap: 's', cardColor: '#000', finish: 'glossy' as const }));
    await cachedFaces(faceKey('olimpo', 2, 'grafito', 'dark', 100), make);
    await cachedFaces(faceKey('olimpo', 2, 'grafito', 'dark', 200), make);
    await cachedFaces(faceKey('suizo', 2, 'grafito', 'dark', 100), make);
    await cachedFaces(faceKey('olimpo', 2, 'papel', 'light', 100), make);
    expect(make).toHaveBeenCalledTimes(4);
  });

  it('does not keep a failed drawing', async () => {
    const make = vi.fn().mockRejectedValueOnce(new Error('fallo')).mockResolvedValue({ front: 'f', back: 'b', strap: 's', cardColor: '#000', finish: 'glossy' });
    const key = faceKey('olimpo', 2, 'grafito', 'dark', 1);
    await expect(cachedFaces(key, make)).rejects.toThrow('fallo');
    await Promise.resolve();
    await expect(cachedFaces(key, make)).resolves.toBeDefined();
  });
});
