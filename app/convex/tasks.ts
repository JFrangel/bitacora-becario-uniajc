import type { WithoutSystemFields } from 'convex/server';
import { v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
import type { MutationCtx } from './_generated/server';
import { requireWorkspaceOwner, resolveWorkspaceActor } from './lib/actors';
import { memberView } from './lib/audience';
import { fail, taskNotFound } from './lib/errors';
import { logEvent } from './lib/events';
import { orderBetween } from './lib/order';
import { ensureDraft } from './lib/journalDraft';
import { ensureProject } from './lib/projects';
import { normalizeSearch } from './lib/text';
import { getTask, listTasks } from './lib/taskQueries';
import { validateDescription, validateDueDate, validatePriority, validateProjectName, validateSubtasks, validateTaskInput, validateTitle } from './lib/validate';
import { subtaskInput, taskStatus } from './lib/validators';
import { workspaceMembership } from './lib/workspaces';

/** Texto de búsqueda sin tildes ni mayúsculas: título y descripción. */
const taskSearchText = (title: string, description?: string) => normalizeSearch(`${title} ${description ?? ''}`);

/** El responsable debe ser una persona con acceso vigente. */
async function assertActiveMember(ctx: MutationCtx, id: Id<'members'>, workspaceId?: Id<'workspaces'>): Promise<Doc<'members'>> {
  const member = await ctx.db.get(id);
  if (!member || member.revokedAt !== undefined) throw fail('VALIDATION', 'Elige una persona con acceso.');
  if (workspaceId && !(await workspaceMembership(ctx, id, workspaceId))) throw fail('VALIDATION', 'Elige una persona con acceso a esta Bitácora.');
  return member;
}

export const create = mutation({
  args: {
    title: v.string(),
    workspaceId: v.optional(v.id('workspaces')),
    projectName: v.string(),
    description: v.optional(v.string()),
    subtasks: v.optional(v.array(subtaskInput)),
    assigneeId: v.optional(v.id('members')),
    dueDate: v.optional(v.string()),
    priority: v.optional(v.number()),
    status: v.optional(taskStatus),
  },
  handler: async (ctx, args): Promise<Id<'tasks'>> => {
    const actor = await resolveWorkspaceActor(ctx, args.workspaceId);
    const input = validateTaskInput(args);
    if (args.assigneeId) await assertActiveMember(ctx, args.assigneeId, actor.workspaceId);
    const project = await ensureProject(ctx, actor, input.projectName);
    const status = args.status ?? 'todo';
    // Una tarea nueva queda arriba de su columna.
    const top = (await ctx.db.query('tasks').withIndex('by_status_order', (q) => q.eq('status', status)).order('asc').collect()).find((task) => task.workspaceId === actor.workspaceId);
    const now = Date.now();
    const id = await ctx.db.insert('tasks', {
      workspaceId: actor.workspaceId,
      title: input.title,
      description: input.description,
      projectId: project._id,
      assigneeId: args.assigneeId,
      dueDate: input.dueDate,
      priority: input.priority,
      status,
      order: orderBetween(null, top?.order ?? null),
      createdBy: actor.memberId,
      createdAt: now,
      updatedAt: now,
      completedAt: status === 'done' ? now : undefined,
      subtasks: input.subtasks,
      searchText: taskSearchText(input.title, input.description),
    });
    // El historial dice «Asignada a … · vence el …»: se guardan el nombre del responsable y la fecha de ese momento.
    const assignee = args.assigneeId ? await ctx.db.get(args.assigneeId) : null;
    await logEvent(ctx, actor, {
      type: 'task.created',
      subjectKind: 'task',
      subjectId: id,
      subjectTitle: input.title,
      detail: { projectName: project.name, status, assigneeName: assignee?.name ?? null, dueDate: input.dueDate ?? null },
    }, { workspaceId: actor.workspaceId });
    if (status === 'done') await ensureDraft(ctx, (await ctx.db.get(id))!, actor);
    return id;
  },
});

/**
 * Cambia de columna o de posición. El `order` se calcula aquí: la tarjeta queda justo antes de `beforeId` (que debe estar
 * en la columna de destino); si `beforeId` no existe, está en otra columna o falta, queda al final.
 */
export const move = mutation({
  args: { id: v.id('tasks'), workspaceId: v.optional(v.id('workspaces')), status: taskStatus, beforeId: v.optional(v.id('tasks')) },
  handler: async (ctx, { id, workspaceId, status, beforeId }) => {
    const actor = await resolveWorkspaceActor(ctx, workspaceId);
    const task = await ctx.db.get(id);
    if (!task || task.workspaceId !== actor.workspaceId) throw taskNotFound();
    if (beforeId === id && task.status === status) return;

    const column = (await ctx.db.query('tasks').withIndex('by_status_order', (q) => q.eq('status', status)).collect()).filter((t) => t.workspaceId === actor.workspaceId && t._id !== id);
    const at = beforeId ? column.findIndex((t) => t._id === beforeId) : -1;
    const order = at >= 0 ? orderBetween(column[at - 1]?.order ?? null, column[at].order) : orderBetween(column.at(-1)?.order ?? null, null);
    const now = Date.now();
    const completedAt = status === 'done' ? (task.completedAt ?? now) : undefined;
    await ctx.db.patch(id, { status, order, completedAt, updatedAt: now });

    if (status === task.status) return;
    await logEvent(ctx, actor, {
      type: status === 'done' ? 'task.completed' : 'task.moved',
      subjectKind: 'task',
      subjectId: id,
      subjectTitle: task.title,
      detail: { from: task.status, to: status },
    }, { workspaceId: actor.workspaceId });
    // Transición a Completada: dentro de esta misma mutación se crea el borrador único (reglas 1 a 6).
    if (status === 'done') await ensureDraft(ctx, { ...task, status, order, completedAt }, actor);
  },
});

type Change = { from: unknown; to: unknown };

/** Solo escribe los campos presentes en `patch`; `null` borra descripción, fecha o responsable. */
export const update = mutation({
  args: {
    id: v.id('tasks'),
    workspaceId: v.optional(v.id('workspaces')),
    patch: v.object({
      title: v.optional(v.string()),
      description: v.optional(v.union(v.string(), v.null())),
      projectName: v.optional(v.string()),
      priority: v.optional(v.number()),
      dueDate: v.optional(v.union(v.string(), v.null())),
      assigneeId: v.optional(v.union(v.id('members'), v.null())),
      subtasks: v.optional(v.array(subtaskInput)),
    }),
  },
  handler: async (ctx, { id, workspaceId, patch }) => {
    const actor = await resolveWorkspaceActor(ctx, workspaceId);
    const task = await ctx.db.get(id);
    if (!task || task.workspaceId !== actor.workspaceId) throw taskNotFound();

    const next: Partial<WithoutSystemFields<Doc<'tasks'>>> = {};
    const fields: string[] = [];
    const changes: Record<string, Change> = {};
    const record = (field: string, change?: Record<string, Change>) => {
      fields.push(field);
      Object.assign(changes, change);
    };

    if (patch.title !== undefined) {
      const title = validateTitle(patch.title);
      if (title !== task.title) {
        next.title = title;
        record('title', { title: { from: task.title, to: title } });
      }
    }
    if (patch.description !== undefined) {
      const description = validateDescription(patch.description);
      if (description !== task.description) {
        next.description = description;
        record('description');
      }
    }
    if (patch.projectName !== undefined) {
      const project = await ensureProject(ctx, actor, validateProjectName(patch.projectName));
      if (project._id !== task.projectId) {
        const previous = await ctx.db.get(task.projectId);
        next.projectId = project._id;
        record('projectId', { projectName: { from: previous?.name ?? null, to: project.name } });
      }
    }
    if (patch.priority !== undefined) {
      const priority = validatePriority(patch.priority);
      if (priority !== task.priority) {
        next.priority = priority;
        record('priority', { priority: { from: task.priority, to: priority } });
      }
    }
    if (patch.dueDate !== undefined) {
      const dueDate = validateDueDate(patch.dueDate);
      if (dueDate !== task.dueDate) {
        next.dueDate = dueDate;
        record('dueDate', { dueDate: { from: task.dueDate ?? null, to: dueDate ?? null } });
      }
    }
    if (patch.assigneeId !== undefined) {
      const assigneeId = patch.assigneeId ?? undefined;
      if (assigneeId !== task.assigneeId) {
        const to = assigneeId ? await assertActiveMember(ctx, assigneeId, actor.workspaceId) : null;
        const from = task.assigneeId ? await ctx.db.get(task.assigneeId) : null;
        next.assigneeId = assigneeId;
        record('assigneeId', {
          assigneeId: { from: task.assigneeId ?? null, to: assigneeId ?? null },
          assigneeName: { from: from?.name ?? null, to: to?.name ?? null },
        });
      }
    }
    if (patch.subtasks !== undefined) {
      const subtasks = validateSubtasks(patch.subtasks);
      if (JSON.stringify(subtasks) !== JSON.stringify(task.subtasks)) {
        next.subtasks = subtasks;
        record('subtasks');
      }
    }

    if (fields.length === 0) return;
    if (fields.includes('title') || fields.includes('description')) {
      next.searchText = taskSearchText(next.title ?? task.title, 'description' in next ? next.description : task.description);
    }
    next.updatedAt = Date.now();
    await ctx.db.patch(id, next);
    await logEvent(ctx, actor, { type: 'task.edited', subjectKind: 'task', subjectId: id, subjectTitle: next.title ?? task.title, detail: { fields, changes } }, { workspaceId: actor.workspaceId });
    // Segunda transición de la regla 1: una tarea ya Completada que se reasigna a la dueña.
    if (next.assigneeId) {
      const fresh = await ctx.db.get(id);
      if (fresh?.status === 'done') await ensureDraft(ctx, fresh, actor);
    }
  },
});

/** Solo la dueña borra tareas. */
export const remove = mutation({
  args: { id: v.id('tasks'), workspaceId: v.optional(v.id('workspaces')) },
  handler: async (ctx, { id, workspaceId }) => {
    const actor = await requireWorkspaceOwner(ctx, workspaceId);
    const task = await ctx.db.get(id);
    if (!task || task.workspaceId !== actor.workspaceId) throw taskNotFound();
    const project = await ctx.db.get(task.projectId);
    // Regla 5: los registros de la Bitácora se conservan, sin vínculo y con el título guardado.
    const linked = (await ctx.db.query('journalEntries').withIndex('by_task', (q) => q.eq('taskId', id)).collect()).filter((entry) => entry.workspaceId === actor.workspaceId);
    for (const entry of linked) await ctx.db.patch(entry._id, { taskId: undefined, taskTitleSnapshot: task.title });
    await ctx.db.delete(id);
    await logEvent(ctx, actor, { type: 'task.deleted', subjectKind: 'task', subjectId: id, subjectTitle: task.title, detail: { projectName: project?.name ?? null } }, { workspaceId: actor.workspaceId });
  },
});

/** Personas con sesión. El enlace de solo lectura usa `viewer.board`. */
export const get = query({
  args: { id: v.id('tasks'), workspaceId: v.optional(v.id('workspaces')) },
  handler: async (ctx, { id, workspaceId }) => getTask(ctx, await memberView(ctx, workspaceId), id),
});

export const list = query({
  args: {
    workspaceId: v.optional(v.id('workspaces')),
    projectId: v.optional(v.id('projects')),
    assigneeId: v.optional(v.id('members')),
    priority: v.optional(v.number()),
    q: v.optional(v.string()),
  },
  handler: async (ctx, { workspaceId, ...filters }) => listTasks(ctx, await memberView(ctx, workspaceId), filters),
});
