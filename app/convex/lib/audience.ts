import type { Doc, Id } from '../_generated/dataModel';
import type { QueryCtx } from '../_generated/server';
import { resolveWorkspaceActor, requireViewer } from './actors';
import { filterWorkspaceRows, workspaceMembership } from './workspaces';
import type { TaskStatus } from './types';
import type { Subtask } from './validate';

/** Quién mira: la dueña, una persona del equipo o el enlace de solo lectura. */
export type Audience = 'owner' | 'member' | 'viewer';

/** Lo que la audiencia que llama puede ver (tabla 3.1 de la especificación). */
export type View = { audience: Audience; showDescriptions: boolean; showJournal: boolean; workspaceId?: Id<'workspaces'> };

export type TaskDto = {
  id: Id<'tasks'>;
  title: string;
  description?: string;
  projectId: Id<'projects'>;
  projectName: string;
  projectColorSlot: number;
  assigneeId?: Id<'members'>;
  assigneeName?: string;
  assigneeRevoked?: boolean;
  dueDate?: string;
  priority: number;
  status: TaskStatus;
  order: number;
  subtasks: Subtask[];
  completedAt?: number;
  /** Horas del registro de la Bitácora ya documentado. Solo dueña y enlace con Bitácora; nunca la clave para la persona invitada. */
  hours?: number;
  /** El registro de la Bitácora de esta tarea sigue siendo un borrador. Mismas audiencias que `hours`. */
  draft?: true;
};

type TaskLookups = {
  showDescriptions: boolean;
  project: Doc<'projects'> | null;
  assignee: Doc<'members'> | null;
  journal?: { hours?: number; isDraft: boolean };
};

/**
 * Convierte una tarea en lo que cada audiencia puede ver. Las claves opcionales sin valor se **omiten**
 * (no se envían como `undefined`) y nunca se devuelve el documento crudo.
 * La descripción solo se oculta al enlace de solo lectura cuando la dueña no la comparte; los datos derivados de la
 * Bitácora (`hours`, `draft`) nunca salen hacia una persona invitada, aunque se los pasen.
 */
export function taskDto(task: Doc<'tasks'>, audience: Audience, opts: TaskLookups): TaskDto {
  const dto: TaskDto = {
    id: task._id,
    title: task.title,
    projectId: task.projectId,
    projectName: opts.project?.name ?? 'Sin proyecto',
    projectColorSlot: opts.project?.colorSlot ?? 1,
    priority: task.priority,
    status: task.status,
    order: task.order,
    subtasks: task.subtasks,
  };
  if (task.description !== undefined && (audience !== 'viewer' || opts.showDescriptions)) dto.description = task.description;
  if (task.assigneeId !== undefined) {
    dto.assigneeId = task.assigneeId;
    if (opts.assignee) {
      dto.assigneeName = opts.assignee.name;
      if (opts.assignee.revokedAt !== undefined) dto.assigneeRevoked = true;
    }
  }
  if (task.dueDate !== undefined) dto.dueDate = task.dueDate;
  if (task.completedAt !== undefined) dto.completedAt = task.completedAt;
  if (opts.journal && audience !== 'member') {
    if (opts.journal.isDraft) dto.draft = true;
    else if (opts.journal.hours !== undefined) dto.hours = opts.journal.hours;
  }
  return dto;
}

/**
 * Busca proyectos, responsables y (solo si la audiencia ve la Bitácora) el registro vinculado de las tareas
 * completadas, una sola vez por elemento distinto, y arma los DTO en el mismo orden.
 */
export async function loadTaskDtos(ctx: QueryCtx, tasks: Doc<'tasks'>[], view: View): Promise<TaskDto[]> {
  const projects = new Map<Id<'projects'>, Doc<'projects'> | null>();
  const members = new Map<Id<'members'>, Doc<'members'> | null>();
  const result: TaskDto[] = [];
  for (const task of tasks) {
    if (!projects.has(task.projectId)) {
      const project = await ctx.db.get(task.projectId);
      projects.set(task.projectId, project && project.workspaceId === view.workspaceId ? project : null);
    }
    if (task.assigneeId && !members.has(task.assigneeId)) {
      const member = await ctx.db.get(task.assigneeId);
      const membership = view.workspaceId && member ? await workspaceMembership(ctx, member._id, view.workspaceId) : null;
      members.set(task.assigneeId, member && (view.workspaceId === undefined || membership) ? member : null);
    }
    let journal: TaskLookups['journal'];
    if (view.showJournal && view.audience !== 'member' && task.status === 'done') {
      const entry = filterWorkspaceRows(await ctx.db.query('journalEntries').withIndex('by_task', (q) => q.eq('taskId', task._id)).collect(), view.workspaceId)[0];
      if (entry) journal = { hours: entry.hours, isDraft: entry.docStatus === 'draft' };
    }
    result.push(
      taskDto(task, view.audience, {
        showDescriptions: view.showDescriptions,
        project: projects.get(task.projectId) ?? null,
        assignee: task.assigneeId ? (members.get(task.assigneeId) ?? null) : null,
        journal,
      }),
    );
  }
  return result;
}

/** Cuenta con acceso vigente: la dueña ve todo; la persona invitada, todo menos lo derivado de la Bitácora. */
export async function memberView(ctx: QueryCtx, workspaceId?: Id<'workspaces'>): Promise<View> {
  return memberViewForWorkspace(ctx, workspaceId);
}

export async function memberViewForWorkspace(ctx: QueryCtx, workspaceId?: Id<'workspaces'>): Promise<View> {
  const actor = await resolveWorkspaceActor(ctx, workspaceId);
  return { audience: actor.workspaceRole === 'owner' ? 'owner' : 'member', showDescriptions: true, showJournal: actor.workspaceRole === 'owner', workspaceId: actor.workspaceId };
}

/** Enlace de solo lectura: el token debe coincidir con el enlace activo; las opciones las fija la dueña. */
export async function viewerView(ctx: QueryCtx, shareToken: string): Promise<View> {
  const settings = await requireViewer(ctx, shareToken);
  return { audience: 'viewer', showDescriptions: settings.shareShowsDescriptions, showJournal: settings.shareIncludesJournal, workspaceId: settings.workspaceId };
}
