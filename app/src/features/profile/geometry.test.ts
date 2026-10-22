import { describe, expect, it } from 'vitest';
import { badgeGeometry, columnTuning, HIT_WIDTH, OVERHANG_MAX, px, STRAP_HIT } from './geometry';

describe('badgeGeometry', () => {
  // La aplicación mide 1400 px: el lienzo sobresale 280 px (un quinto) a cada lado.
  const base = { appLeft: 100, appRight: 1500, badgeLeft: 900, inviteRight: 1000, appearanceLeft: 1068 };
  const overhang = 280;

  it('hangs the strap in the middle of the gap between «Invitar» and «Apariencia»', () => {
    expect(badgeGeometry(base).gapX).toBe(1034);
  });

  it('makes the canvas wider than the app on both sides, so the card meets no invisible wall on screen', () => {
    const { stageLeft, stageWidth } = badgeGeometry(base);
    expect(base.badgeLeft + stageLeft).toBe(base.appLeft - overhang);
    expect(base.badgeLeft + stageLeft + stageWidth).toBe(base.appRight + overhang);
    expect(stageWidth).toBe(1400 + 2 * overhang);
  });

  it('never overhangs more than 300 px per side, so a huge screen does not make a huge canvas', () => {
    const wide = badgeGeometry({ ...base, appRight: 3100 });
    expect(wide.stageWidth).toBe(3000 + 2 * OVERHANG_MAX);
    expect(wide.stageLeft).toBe(100 - OVERHANG_MAX - 900);
  });

  it('hangs the strap from the gap by anchoring it at that fraction of the canvas width', () => {
    const { anchor, stageWidth, stageLeft, gapX } = badgeGeometry(base);
    expect(base.badgeLeft + stageLeft + anchor * stageWidth).toBeCloseTo(gapX);
  });

  it('keeps the anchor between 0 and 1 even if the gap were outside the canvas', () => {
    expect(badgeGeometry({ ...base, inviteRight: 3000, appearanceLeft: 3100 }).anchor).toBe(1);
    expect(badgeGeometry({ ...base, inviteRight: -500, appearanceLeft: -450 }).anchor).toBe(0);
  });

  it('is much wider than the 340 px column, so the card has room to swing', () => {
    expect(badgeGeometry(base).stageWidth).toBeGreaterThan(3 * 340);
  });

  it('centres the pointer zone under the bar and a narrow one on the strap itself', () => {
    const g = badgeGeometry(base);
    expect(g.hitLeft + HIT_WIDTH / 2).toBe(g.gapX - base.badgeLeft);
    expect(g.strapLeft + STRAP_HIT / 2).toBe(g.gapX - base.badgeLeft);
  });

  it('without «Invitar» (read-only link) uses the free space left of «Apariencia»', () => {
    const g = badgeGeometry({ appLeft: 100, appRight: 1500, badgeLeft: 900, appearanceLeft: 1068 });
    expect(g.gapX).toBe(1051);
  });
});

describe('columnTuning', () => {
  it('keeps the card the same size on screen as with the old 700 px canvas, whatever the window height', () => {
    for (const height of [600, 760, 900, 1080, 1440]) {
      const { size } = columnTuning(height);
      const before = Math.min(700, height - 60);
      expect(size * height).toBeCloseTo(0.66 * before, 6); // el alto del carné en px: 66 % del lienzo de antes
    }
  });

  it('keeps the top of the card where it was (27 % of the old canvas height)', () => {
    for (const height of [600, 760, 900, 1080, 1440]) {
      const { strapLength } = columnTuning(height);
      const before = Math.min(700, height - 60);
      expect((0.12 + 0.3 * strapLength) * height).toBeCloseTo(0.27 * before, 6);
    }
  });

  it('changes nothing when the window is exactly as tall as the old canvas needed', () => {
    const { size, strapLength } = columnTuning(1);
    expect(size).toBeGreaterThan(0);
    expect(strapLength).toBeGreaterThanOrEqual(0);
    expect(columnTuning(760).size).toBeCloseTo((0.66 * 700) / 760);
  });

  it('stays inside what the component accepts', () => {
    for (const height of [1, 300, 5000]) {
      const { strapLength } = columnTuning(height);
      expect(strapLength).toBeGreaterThanOrEqual(0);
      expect(strapLength).toBeLessThanOrEqual(1);
    }
  });
});

describe('px', () => {
  it('writes one decimal, as the CSS variables expect', () => {
    expect(px(-800)).toBe('-800.0px');
    expect(px(1279.4521)).toBe('1279.5px');
  });
});
