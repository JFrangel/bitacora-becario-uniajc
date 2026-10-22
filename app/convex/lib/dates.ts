import type { TaskStatus } from './types';

/** Colombia no usa horario de verano: Bogotá es UTC−5 todo el año. */
const BOGOTA_OFFSET_MS = -5 * 60 * 60 * 1000;

/** Día (AAAA-MM-DD) en Bogotá para una marca de tiempo en milisegundos UTC. */
export const bogotaDate = (ms: number): string => new Date(ms + BOGOTA_OFFSET_MS).toISOString().slice(0, 10);

const pad = (n: number) => String(n).padStart(2, '0');

/** `AAAA-MM-DD` que existe en el calendario (rechaza 2026-02-29 y 2026-13-01). */
export function isValidDate(text: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function isOverdue(due: string | undefined, status: TaskStatus, today: string): boolean {
  return Boolean(due) && status !== 'done' && (due as string) < today;
}

export function daysFromToday(today: string, days: number): string {
  const [y, m, d] = today.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** `month` va de 0 (enero) a 11 (diciembre). */
export function monthRange(year: number, month: number): { from: string; to: string } {
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return { from: `${year}-${pad(month + 1)}-01`, to: `${year}-${pad(month + 1)}-${pad(last)}` };
}
