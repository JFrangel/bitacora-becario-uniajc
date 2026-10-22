import type { TaskDto } from '../../../convex/lib/audience';

const pad = (n: number) => String(n).padStart(2, '0');

/** `month` va de 0 (enero) a 11 (diciembre). */
export const isoDay = (year: number, month: number, day: number) => `${year}-${pad(month + 1)}-${pad(day)}`;

/**
 * Cuadrícula del mes empezando en lunes: `null` rellena los huecos antes del día 1 y después del último día,
 * hasta completar semanas de 7.
 */
export function buildMonthGrid(year: number, month: number): (string | null)[] {
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const total = Math.ceil((offset + days) / 7) * 7;
  return Array.from({ length: total }, (_, i) => {
    const day = i - offset + 1;
    return day < 1 || day > days ? null : isoDay(year, month, day);
  });
}

/** Las próximas `n` tareas sin completar con fecha límite, las vencidas primero (es el orden natural por fecha). */
export function upcoming(tasks: TaskDto[], n = 6): TaskDto[] {
  return tasks
    .filter((task) => task.status !== 'done' && task.dueDate !== undefined)
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!) || a.order - b.order)
    .slice(0, n);
}

/** Tareas de un día, en el orden del tablero. */
export const tasksOn = (tasks: TaskDto[], day: string) => tasks.filter((task) => task.dueDate === day).sort((a, b) => a.order - b.order);

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + month + delta;
  return { year: Math.floor(index / 12), month: ((index % 12) + 12) % 12 };
}
