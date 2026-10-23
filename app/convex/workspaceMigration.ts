import { v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import { internalMutation, internalQuery } from './_generated/server';
import type { MutationCtx } from './_generated/server';
import { fail } from './lib/errors';

const LEGACY_KEY = 'initial';
const DEFAULT_BATCH = 100;
const MAX_BATCH = 100;
const WORKSPACE_TABLES = ['projects', 'tasks', 'journalEntries', 'events', 'invites', 'settings'] as const;
type WorkspaceTable = (typeof WORKSPACE_TABLES)[number];
type CursorState = { tableIndex: number; cursor: string | null };

function encodeCursor(state: CursorState): string {
  return JSON.stringify(state);
}

function decodeCursor(cursor: string | undefined): CursorState {
  if (cursor === undefined) return { tableIndex: 0, cursor: null };
  try {
    const state = JSON.parse(cursor) as CursorState;
    if (!Number.isInteger(state.tableIndex) || state.tableIndex < 0 || state.tableIndex >= WORKSPACE_TABLES.length + 1) throw new Error();
    if (state.cursor !== null && typeof state.cursor !== 'string') throw new Error();
    return state;
  } catch {
    throw fail('VALIDATION', 'El cursor de migración no es válido.');
  }
}

async function ensureInitialWorkspace(ctx: MutationCtx) {
  const existing = await ctx.db.query('workspaces').withIndex('by_legacy_key', (q) => q.eq('legacyKey', LEGACY_KEY)).unique();
  if (existing) return { workspace: existing, created: false };
  const members = await ctx.db.query('members').collect();
  const owners = members.filter((member) => member.isOwner);
  if (owners.length !== 1) throw fail('NOT_FOUND', 'Se requiere exactamente una cuenta propietaria para crear la Bitácora inicial.');
  const owner = owners[0];
  const now = Date.now();
  const workspaceId = await ctx.db.insert('workspaces', {
    name: 'Bitácora principal',
    nameLower: 'bitácora principal',
    ownerMemberId: owner._id,
    legacyKey: LEGACY_KEY,
    createdAt: now,
    updatedAt: now,
  });
  return { workspace: await ctx.db.get(workspaceId), created: true };
}

async function migrateMembers(ctx: MutationCtx, cursor: string | null, limit: number, workspaceId: Id<'workspaces'>) {
  const page = await ctx.db.query('members').paginate({ numItems: limit, cursor });
  let changed = 0;
  for (const member of page.page) {
    const memberships = await ctx.db.query('workspaceMembers').withIndex('by_member_workspace', (q) => q.eq('memberId', member._id).eq('workspaceId', workspaceId)).collect();
    if (memberships.length === 0) {
      await ctx.db.insert('workspaceMembers', {
        workspaceId,
        memberId: member._id,
        role: member.isOwner ? 'owner' : 'editor',
        createdAt: member.createdAt,
        ...(member.revokedAt !== undefined ? { revokedAt: member.revokedAt } : {}),
      });
      changed += 1;
    }
  }
  return { page, changed };
}

async function migrateWorkspaceTable<Table extends WorkspaceTable>(ctx: MutationCtx, table: Table, cursor: string | null, limit: number, workspaceId: Id<'workspaces'>) {
  const page = await ctx.db.query(table).paginate({ numItems: limit, cursor });
  let changed = 0;
  for (const doc of page.page) {
    if (doc.workspaceId === undefined) {
      await ctx.db.patch(doc._id as Id<Table>, { workspaceId } as Pick<Doc<Table>, 'workspaceId'>);
      changed += 1;
    }
  }
  return { page, changed };
}

export const status = internalQuery({
  args: {},
  handler: async (ctx) => {
    const records = {
      projects: await ctx.db.query('projects').collect(),
      tasks: await ctx.db.query('tasks').collect(),
      journalEntries: await ctx.db.query('journalEntries').collect(),
      events: await ctx.db.query('events').collect(),
      invites: await ctx.db.query('invites').collect(),
      settings: await ctx.db.query('settings').collect(),
    };
    const unassigned = {} as Record<WorkspaceTable, number>;
    const associated = {} as Record<WorkspaceTable, number>;
    const workspaces = await ctx.db.query('workspaces').collect();
    const workspaceIds = new Set(workspaces.map((workspace) => String(workspace._id)));
    for (const table of WORKSPACE_TABLES) {
      const docs = records[table];
      unassigned[table] = docs.filter((doc) => doc.workspaceId === undefined).length;
      associated[table] = docs.length - unassigned[table];
    }
    const projects = new Map(records.projects.map((project) => [String(project._id), project]));
    const tasks = new Map(records.tasks.map((task) => [String(task._id), task]));
    let inconsistentReferences = 0;
    for (const table of WORKSPACE_TABLES) {
      for (const doc of records[table]) {
        if (doc.workspaceId && !workspaceIds.has(String(doc.workspaceId))) inconsistentReferences += 1;
      }
    }
    for (const task of records.tasks) {
      const project = projects.get(String(task.projectId));
      if (!project || ((task.workspaceId || project.workspaceId) && task.workspaceId !== project.workspaceId)) inconsistentReferences += 1;
    }
    for (const entry of records.journalEntries) {
      const project = projects.get(String(entry.projectId));
      const task = entry.taskId ? tasks.get(String(entry.taskId)) : undefined;
      if (!project || ((entry.workspaceId || project.workspaceId) && entry.workspaceId !== project.workspaceId)) inconsistentReferences += 1;
      if (entry.taskId && (!task || ((entry.workspaceId || task.workspaceId) && entry.workspaceId !== task.workspaceId))) inconsistentReferences += 1;
    }
    for (const invite of records.invites) {
      if (invite.workspaceId && !(await ctx.db.get(invite.createdBy))) inconsistentReferences += 1;
    }
    const settingsByWorkspace = new Map<string, number>();
    for (const settings of records.settings) {
      if (!settings.workspaceId) continue;
      const key = String(settings.workspaceId);
      settingsByWorkspace.set(key, (settingsByWorkspace.get(key) ?? 0) + 1);
    }
    for (const count of settingsByWorkspace.values()) if (count > 1) inconsistentReferences += count - 1;
    return { unassigned, associated, inconsistentReferences };
  },
});

export const runBatch = internalMutation({
  args: { cursor: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? DEFAULT_BATCH;
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_BATCH) throw fail('VALIDATION', `El lote debe estar entre 1 y ${MAX_BATCH} documentos.`);
    const { workspace, created } = await ensureInitialWorkspace(ctx);
    if (!workspace) throw fail('NOT_FOUND', 'No se pudo preparar la Bitácora inicial.');
    const state = decodeCursor(args.cursor);
    if (state.tableIndex >= WORKSPACE_TABLES.length + 1) throw fail('VALIDATION', 'El cursor de migración no es válido.');
    const remaining = limit - (created ? 1 : 0);
    if (remaining === 0) return { cursor: encodeCursor(state), processed: 1, workspaceId: workspace._id };

    const result = state.tableIndex === 0
      ? await migrateMembers(ctx, state.cursor, remaining, workspace._id)
      : await migrateWorkspaceTable(ctx, WORKSPACE_TABLES[state.tableIndex - 1], state.cursor, remaining, workspace._id);
    const nextState = result.page.isDone
      ? state.tableIndex + 1 < WORKSPACE_TABLES.length + 1
        ? { tableIndex: state.tableIndex + 1, cursor: null }
        : null
      : { tableIndex: state.tableIndex, cursor: result.page.continueCursor };
    return { cursor: nextState ? encodeCursor(nextState) : null, processed: result.page.page.length + (created ? 1 : 0), workspaceId: workspace._id };
  },
});

