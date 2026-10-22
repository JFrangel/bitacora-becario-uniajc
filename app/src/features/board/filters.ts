import type { TaskDto } from '../../../convex/lib/audience';
import { bogotaDate, daysFromToday } from '../../../convex/lib/dates';
import { normalizeSearch } from '../../../convex/lib/text';

export type BoardFilters = { projectId?: string; assigneeId?: string; priority?: number; q?: string; onlyMine?: boolean };

/** Un filtro vacío significa «todos». `me` es el id de quien mira (nulo en el enlace de solo lectura). */
export function filterTasks(tasks: TaskDto[], filters: BoardFilters, me: string | null): TaskDto[] {
  const words = normalizeSearch(filters.q ?? '').split(' ').filter(Boolean);
  return tasks.filter((task) => {
    if (filters.projectId && task.projectId !== filters.projectId) return false;
    if (filters.assigneeId && task.assigneeId !== filters.assigneeId) return false;
    if (filters.priority !== undefined && task.priority !== filters.priority) return false;
    if (filters.onlyMine && me && task.assigneeId !== me) return false;
    if (words.length === 0) return true;
    const haystack = normalizeSearch(`${task.title} ${task.description ?? ''}`);
    return words.every((word) => haystack.includes(word));
  });
}

/** La columna Completada muestra por defecto solo los últimos `days` días; las demás ya están completas. */
export function splitCompleted(tasks: TaskDto[], today: string, days = 30): { recent: TaskDto[]; older: TaskDto[] } {
  const limit = daysFromToday(today, -days);
  const recent: TaskDto[] = [];
  const older: TaskDto[] = [];
  for (const task of tasks) {
    // Una tarea sin fecha de finalización (datos antiguos) se trata como reciente para no esconderla.
    const when = task.completedAt === undefined ? undefined : bogotaDate(task.completedAt);
    (when !== undefined && when < limit ? older : recent).push(task);
  }
  return { recent, older };
}

const MOBILE_LIMIT = 5;

/** En móvil cada columna muestra 5 tarjetas (o todas si se expandió). */
export const visibleCount = (isMobile: boolean, expanded: boolean, total: number) => (isMobile && !expanded ? Math.min(MOBILE_LIMIT, total) : total);

export const MOBILE_CARDS = MOBILE_LIMIT;

/** *Activas* (no completadas) y *Vencen esta semana* (no completadas con fecha dentro de 7 días o ya vencidas). */
export function boardStats(tasks: TaskDto[], today: string): { active: number; dueThisWeek: number } {
  const week = daysFromToday(today, 7);
  const open = tasks.filter((task) => task.status !== 'done');
  return { active: open.length, dueThisWeek: open.filter((task) => task.dueDate !== undefined && task.dueDate <= week).length };
}
