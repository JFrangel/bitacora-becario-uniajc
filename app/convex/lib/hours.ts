/**
 * Horas de una actividad: de 0,25 a 24 en pasos de 0,25; acepta coma decimal.
 * Devuelve `null` si el texto no es válido.
 */
export function parseHours(input: string): number | null {
  const normalized = input.trim().replace(',', '.');
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const hours = Number(normalized);
  if (hours < 0.25 || hours > 24) return null;
  if (Math.abs(hours * 4 - Math.round(hours * 4)) > 1e-8) return null;
  return hours;
}

export const HOURS_MESSAGE = 'Completa los campos. Las horas deben estar entre 0,25 y 24, en incrementos de 0,25.';
