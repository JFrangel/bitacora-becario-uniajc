import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import type { Actor } from './actors';
import { bogotaDate } from './dates';
import { logEvent } from './events';
import { LIMITS } from './limits';

/**
 * Regla 1: crea el borrador de Bitácora de una tarea completada si su responsable es la dueña y todavía no hay un
 * registro vinculado. Devuelve el id del borrador nuevo, o `null` si no creó nada.
 *
 * Solo se llama en una **transición** (la tarea pasa a Completada, o ya Completada se reasigna a la dueña), dentro de
 * la misma mutación que cambia la tarea: como las mutaciones son serializables, dos llamadas simultáneas ven el
 * registro de la otra y no duplican. `actor` es quien hizo el cambio (queda en el historial), no el responsable.
 */
export async function ensureDraft(ctx: MutationCtx, task: Doc<'tasks'>, actor: Actor): Promise<Id<'journalEntries'> | null> {
  if (!task.assigneeId) return null;
  const assignee = await ctx.db.get(task.assigneeId);
  if (!assignee?.isOwner) return null;
  const linked = await ctx.db.query('journalEntries').withIndex('by_task', (q) => q.eq('taskId', task._id)).first();
  if (linked) return null;

  const now = Date.now();
  const date = bogotaDate(now);
  const sameDay = await ctx.db.query('journalEntries').withIndex('by_date', (q) => q.eq('date', date)).collect();
  const id = await ctx.db.insert('journalEntries', {
    taskId: task._id,
    taskTitleSnapshot: task.title,
    date,
    projectId: task.projectId,
    activity: task.title,
    // La descripción de la tarea admite 2000 caracteres y el objetivo de la Bitácora 1500.
    objective: task.description?.slice(0, LIMITS.journalField),
    docStatus: 'draft',
    activityStatus: 'Completada',
    links: [],
    photos: [],
    dayOrder: sameDay.reduce((max, entry) => Math.max(max, entry.dayOrder), 0) + 1,
    createdAt: now,
    updatedAt: now,
  });
  await logEvent(ctx, actor, { type: 'journal.draft_created', subjectKind: 'journal', subjectId: id, subjectTitle: task.title });
  return id;
}
