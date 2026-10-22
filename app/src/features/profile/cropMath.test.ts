import { describe, expect, it } from 'vitest';
import { clampCrop, initialCrop, KEY_STEP, moveCrop, zoomCrop, zoomOf } from './cropMath';
import { CROP_VIEW } from './photo';

const landscape = { width: 2000, height: 1000 };
const portrait = { width: 1000, height: 2000 };

describe('initialCrop', () => {
  it('fills the square with the shorter side and centres the longer one', () => {
    const crop = initialCrop(landscape);
    expect(crop.scale).toBeCloseTo(CROP_VIEW / 1000);
    expect(crop.oy).toBeCloseTo(0);
    expect(crop.ox).toBeCloseTo((CROP_VIEW - 2000 * crop.scale) / 2);
    expect(zoomOf(crop)).toBe(1);
  });

  it('on a tall photo starts higher up, where the face usually is, by the bias given', () => {
    const top = initialCrop(portrait, 0);
    const mid = initialCrop(portrait, 0.5);
    expect(top.oy).toBeCloseTo(0);
    expect(mid.oy).toBeLessThan(top.oy);
  });
});

describe('clampCrop', () => {
  it('never leaves empty space inside the square', () => {
    const start = initialCrop(landscape);
    const far = clampCrop({ ...start, ox: 500, oy: 500 }, landscape);
    expect(far.ox).toBe(0);
    expect(far.oy).toBe(0);
    const away = clampCrop({ ...start, ox: -99999, oy: -99999 }, landscape);
    expect(away.ox).toBeCloseTo(CROP_VIEW - 2000 * start.scale);
    expect(away.oy).toBeCloseTo(CROP_VIEW - 1000 * start.scale);
  });
});

describe('zoomCrop', () => {
  it('goes from 1 to 3 times, and clamps outside that range', () => {
    const start = initialCrop(landscape);
    expect(zoomOf(zoomCrop(start, 2, landscape))).toBeCloseTo(2);
    expect(zoomOf(zoomCrop(start, 3, landscape))).toBeCloseTo(3);
    expect(zoomOf(zoomCrop(start, 9, landscape))).toBeCloseTo(3);
    expect(zoomOf(zoomCrop(start, 0.2, landscape))).toBeCloseTo(1);
  });

  it('keeps the centre of the square where it was, and still covers the square', () => {
    const start = initialCrop(landscape);
    const zoomed = zoomCrop(start, 2, landscape);
    const c = CROP_VIEW / 2;
    const [before, after] = [(c - start.ox) / start.scale, (c - zoomed.ox) / zoomed.scale];
    expect(after).toBeCloseTo(before, 0);
    expect(zoomed.ox).toBeLessThanOrEqual(0);
    expect(zoomed.ox).toBeGreaterThanOrEqual(CROP_VIEW - 2000 * zoomed.scale);
  });
});

describe('moveCrop', () => {
  it('moves by the amount given and stops at the edges', () => {
    const start = zoomCrop(initialCrop(landscape), 2, landscape);
    const moved = moveCrop(start, -KEY_STEP, KEY_STEP, landscape);
    expect(moved.ox).toBeCloseTo(Math.max(start.ox - KEY_STEP, CROP_VIEW - 2000 * start.scale));
    expect(moveCrop(start, 99999, 99999, landscape)).toMatchObject({ ox: 0, oy: 0 });
  });

  it('uses 8 px per arrow key', () => {
    expect(KEY_STEP).toBe(8);
  });
});
