import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { requireMember } from './lib/actors';
import { fail } from './lib/errors';
import { LIMITS } from './lib/limits';
import { listMemberWorkspaces } from './lib/workspaces';

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

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const actor = await requireMember(ctx);
    const name = args.name.trim();
    if (name.length < LIMITS.nameMin || name.length > LIMITS.projectName) {
      throw fail('VALIDATION', `El nombre de la Bitácora debe tener entre ${LIMITS.nameMin} y ${LIMITS.projectName} caracteres.`);
    }
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
