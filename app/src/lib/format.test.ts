import { describe, expect, it } from 'vitest';
import { formatHours, formatShort, formatToday, formatWeekday, hoursLabel, todayBogota } from './format';

describe('format', () => {
  it('uses the Bogotá day, which is the previous UTC day late at night', () => {
    expect(todayBogota(Date.UTC(2026, 9, 22, 4, 30))).toBe('2026-10-21');
    expect(todayBogota(Date.UTC(2026, 9, 22, 5, 0))).toBe('2026-10-22');
  });

  it('writes short dates like «20 oct»', () => {
    expect(formatShort('2026-10-20')).toBe('20 oct');
    expect(formatShort('2026-01-05')).toBe('5 ene');
    expect(formatShort(undefined)).toBe('Sin fecha');
  });

  it('writes long dates in Spanish', () => {
    expect(formatWeekday('2026-10-16')).toBe('viernes, 16 de octubre de 2026');
    expect(formatToday('2026-10-21')).toBe('Miércoles, 21 de octubre');
  });

  it('writes hours with a decimal comma', () => {
    expect(formatHours(1.5)).toBe('1,5');
    expect(formatHours(17.5)).toBe('17,5');
    expect(formatHours(2)).toBe('2');
    expect(hoursLabel(1)).toBe('1 hora');
    expect(hoursLabel(0.5)).toBe('0,5 horas');
    expect(hoursLabel(3.25)).toBe('3,25 horas');
  });
});
