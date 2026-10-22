import { ConvexError } from 'convex/values';
import { describe, expect, it } from 'vitest';
import { bogotaDate, daysFromToday, isOverdue, isValidDate, monthRange } from '../../convex/lib/dates';
import { parseHours } from '../../convex/lib/hours';
import { orderBetween } from '../../convex/lib/order';
import { cleanText, normalizeSearch } from '../../convex/lib/text';
import { newToken, sha256Hex } from '../../convex/lib/tokens';

describe('parseHours', () => {
  it.each([
    ['0,25', 0.25],
    ['0.5', 0.5],
    ['24', 24],
    ['2', 2],
    [' 1,75 ', 1.75],
  ])('accepts %s', (input, expected) => {
    expect(parseHours(input)).toBe(expected);
  });

  it.each(['0', '0,2', '24,25', 'abc', '', '1,3', '-1', '25'])('rejects %j', (input) => {
    expect(parseHours(input)).toBeNull();
  });
});

describe('dates (America/Bogota)', () => {
  it('uses the Bogotá day, not the UTC day (punto 3)', () => {
    expect(bogotaDate(Date.UTC(2026, 9, 22, 4, 30))).toBe('2026-10-21');
    expect(bogotaDate(Date.UTC(2026, 9, 22, 5, 0))).toBe('2026-10-22');
  });

  it('flags overdue only when not done and before today', () => {
    expect(isOverdue('2026-10-20', 'doing', '2026-10-21')).toBe(true);
    expect(isOverdue('2026-10-20', 'done', '2026-10-21')).toBe(false);
    expect(isOverdue('2026-10-21', 'todo', '2026-10-21')).toBe(false);
    expect(isOverdue(undefined, 'todo', '2026-10-21')).toBe(false);
  });

  it('adds days and finds month ranges', () => {
    expect(daysFromToday('2026-10-21', 7)).toBe('2026-10-28');
    expect(daysFromToday('2026-10-28', 7)).toBe('2026-11-04');
    expect(monthRange(2026, 9)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(monthRange(2026, 1)).toEqual({ from: '2026-02-01', to: '2026-02-28' });
  });
});

describe('orderBetween', () => {
  it('places items between neighbours and at both ends', () => {
    expect(orderBetween(null, null)).toBe(1);
    expect(orderBetween(1, 2)).toBe(1.5);
    expect(orderBetween(null, 4)).toBeLessThan(4);
    expect(orderBetween(3, null)).toBeGreaterThan(3);
  });
});

describe('tokens', () => {
  it('creates 43-character base64url tokens that differ', () => {
    const a = newToken();
    const b = newToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
  });

  it('hashes with SHA-256', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('text', () => {
  it('normalizes accents, case and spaces for search (punto 2)', () => {
    expect(normalizeSearch('  Análisis   JURÍDICO ')).toBe('analisis juridico');
  });

  it('trims and validates length', () => {
    expect(cleanText('  hola ', 10)).toBe('hola');
    let error: unknown;
    try { cleanText('x'.repeat(201), 200); } catch (e) { error = e; }
    expect(error).toBeInstanceOf(ConvexError);
    expect((error as ConvexError<{ code: string }>).data.code).toBe('VALIDATION');
  });
});

describe('isValidDate', () => {
  it('accepts real calendar days in AAAA-MM-DD', () => {
    expect(isValidDate('2026-10-22')).toBe(true);
    expect(isValidDate('2028-02-29')).toBe(true);
  });

  it('rejects impossible days and other shapes', () => {
    for (const bad of ['2026-02-29', '2026-13-01', '2026-00-10', '2026-04-31', '2026-1-5', '22/10/2026', '2026-10-22T00:00', '']) {
      expect(isValidDate(bad), bad).toBe(false);
    }
  });
});
