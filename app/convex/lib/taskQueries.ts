import type { Doc, Id } from '../_generated/dataModel';
import type { QueryCtx } from '../_generated/server';
import { loadTaskDtos } from './audience';
import type { TaskDto, View } from './audience';
import { taskNotFound } from './errors';
import { normalizeSearch } from './text';
import { TASK_STATUSES } from './types';

export type TaskFilters = { projectId?: Id<'projects'>; assigneeId?: Id<'members'>; priority?: number; q?: string };

/**
 * Todas las tareas, por columna y orden. La búsqueda ignora tildes y mayúsculas, y exige todas las palabras;
 * quien no ve las descripciones (el enlace que no las comparte) solo busca en el título.
 */
export async function listTasks(ctx: QueryCtx, view: View, filters: TaskFilters = {}): Promise<TaskDto[]> {
  const words = normalizeSearch(filters.q ?? '').split(' ').filter(Boolean);
  const tasks: Doc<'tasks'>[] = [];
  for (const status of TASK_STATUSES) {
    tasks.push(...(await ctx.db.query('tasks').withIndex('by_status_order', (q) => q.eq('status', status)).collect()));
  }
  const visible = tasks.filter((task) => {
    if (filters.projectId && task.projectId !== filters.projectId) return false;
    if (filters.assigneeId && task.assigneeId !== filters.assigneeId) return false;
    if (filters.priority !== undefined && task.priority !== filters.priority) return false;
    if (words.length === 0) return true;
    const haystack = view.showDescriptions ? task.searchText : normalizeSearch(task.title);
    return words.every((word) => haystack.includes(word));
  });
  return loadTaskDtos(ctx, visible, view);
}

export async function getTask(ctx: QueryCtx, view: View, id: Id<'tasks'>): Promise<TaskDto> {
  const task = await ctx.db.get(id);
  if (!task) throw taskNotFound();
  return (await loadTaskDtos(ctx, [task], view))[0];
}
