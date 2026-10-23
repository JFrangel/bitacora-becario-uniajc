import { v } from 'convex/values';
import type { Id } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
import type { MutationCtx } from './_generated/server';
import { requireMember, requireWorkspaceActor } from './lib/actors';
import { fail } from './lib/errors';
import { LIMITS } from './lib/limits';
import { filterWorkspaceRows, listMemberWorkspaces } from './lib/workspaces';

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const actor = await requireMember(ctx);
    const [items, existingWorkspace] = await Promise.all([
      listMemberWorkspaces(ctx, actor.memberId),
      ctx.db.query('workspaces').first(),
    ]);
    return { items, workspaceMode: existingWorkspace !== null };
  },
});

function validName(raw: string): string {
  const name = raw.trim();
  if (name.length < LIMITS.nameMin || name.length > LIMITS.projectName) {
    throw fail('VALIDATION', `El nombre de la Bitácora debe tener entre ${LIMITS.nameMin} y ${LIMITS.projectName} caracteres.`);
  }
  return name;
}

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const actor = await requireMember(ctx);
    const name = validName(args.name);
    const now = Date.now();
    const workspaceId = await ctx.db.insert('workspaces', {
      name,
      nameLower: name.toLocaleLowerCase('es'),
      ownerMemberId: actor.memberId,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert('workspaceMembers', { workspaceId, memberId: actor.memberId, role: 'owner', createdAt: now });
    await ctx.db.insert('settings', {
      workspaceId,
      shareEnabled: false,
      shareIncludesJournal: true,
      shareShowsDescriptions: false,
      timezone: 'America/Bogota',
    });
    return workspaceId;
  },
});

/** Solo quien es propietaria de ese espacio. */
async function requireSpaceOwner(ctx: MutationCtx, workspaceId: Id<'workspaces'>) {
  const actor = await requireWorkspaceActor(ctx, workspaceId);
  if (actor.workspaceRole !== 'owner') throw fail('FORBIDDEN', 'Solo la persona propietaria puede hacer esto.');
  return actor;
}

export const rename = mutation({
  args: { workspaceId: v.id('workspaces'), name: v.string() },
  handler: async (ctx, { workspaceId, name }) => {
    await requireSpaceOwner(ctx, workspaceId);
    const next = validName(name);
    await ctx.db.patch(workspaceId, { name: next, nameLower: next.toLocaleLowerCase('es'), updatedAt: Date.now() });
  },
});

/**
 * Elimina una Bitácora vacía. Se niega si tiene tareas o registros (no se pierde trabajo por error) y nunca borra la original.
 * Quita sus accesos, invitaciones, enlace de solo lectura, proyectos y eventos; los demás espacios no se tocan.
 */
export const remove = mutation({
  args: { workspaceId: v.id('workspaces') },
  handler: async (ctx, { workspaceId }) => {
    await requireSpaceOwner(ctx, workspaceId);
    const workspace = await ctx.db.get(workspaceId);
    if (!workspace) throw fail('NOT_FOUND', 'Esta Bitácora ya no existe.');
    if (workspace.legacyKey === 'initial') throw fail('FORBIDDEN', 'La Bitácora principal no se puede eliminar.');

    const [tasks, entries] = await Promise.all([ctx.db.query('tasks').collect(), ctx.db.query('journalEntries').collect()]);
    if (filterWorkspaceRows(tasks, workspaceId).length > 0 || filterWorkspaceRows(entries, workspaceId).length > 0) {
      throw fail('VALIDATION', 'Esta Bitácora todavía tiene tareas o registros. Elimínalos o muévelos antes de borrarla.');
    }

    const projects = filterWorkspaceRows(await ctx.db.query('projects').collect(), workspaceId);
    const events = await ctx.db.query('events').withIndex('by_workspace_at', (q) => q.eq('workspaceId', workspaceId)).collect();
    const invites = await ctx.db.query('invites').withIndex('by_workspace_creator', (q) => q.eq('workspaceId', workspaceId)).collect();
    const settings = await ctx.db.query('settings').withIndex('by_workspace', (q) => q.eq('workspaceId', workspaceId)).collect();
    const members = await ctx.db.query('workspaceMembers').withIndex('by_workspace', (q) => q.eq('workspaceId', workspaceId)).collect();
    for (const row of [...projects, ...events, ...invites, ...settings, ...members]) await ctx.db.delete(row._id);
    await ctx.db.delete(workspaceId);
  },
});
