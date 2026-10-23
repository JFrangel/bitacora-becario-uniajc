import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { requireMember, requireOwner } from './lib/actors';
import { fail } from './lib/errors';
import { logEvent } from './lib/events';
import { LIMITS } from './lib/limits';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Se llama al abrir la aplicación: actualiza `lastSeenAt` como máximo una vez cada 24 horas. */
export const touch = mutation({
  args: {},
  handler: async (ctx) => {
    const actor = await requireMember(ctx);
    const member = await ctx.db.get(actor.memberId);
    if (member && Date.now() - member.lastSeenAt >= DAY_MS) {
      await ctx.db.patch(member._id, { lastSeenAt: Date.now() });
    }
  },
});

/** Personas con acceso vigente, sin correos: alimenta el selector «Responsable» y el filtro «Asignada a». */
export const directory = query({
  args: {},
  handler: async (ctx) => {
    await requireMember(ctx);
    const members = await ctx.db.query('members').collect();
    return members
      .filter((m) => m.revokedAt === undefined)
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
      .map((m) => ({ id: m._id, name: m.name, roleLabel: m.roleLabel, isOwner: m.isOwner }));
  },
});

/** Solo la dueña: lista de personas con el correo de su cuenta (para comprobar quién entró) y quién invitó a quién. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireOwner(ctx);
    const members = await ctx.db.query('members').collect();
    const byId = new Map(members.map((m) => [m._id, m]));
    return members.map((m) => ({
      id: m._id,
      name: m.name,
      roleLabel: m.roleLabel,
      email: m.email,
      invitedByName: m.invitedBy ? byId.get(m.invitedBy)?.name : undefined,
      createdAt: m.createdAt,
      lastSeenAt: m.lastSeenAt,
      revoked: m.revokedAt !== undefined,
    }));
  },
});

/** Solo la dueña. Retira el acceso de inmediato y revoca las invitaciones pendientes de esa persona (no a quienes ya entraron). */
export const revoke = mutation({
  args: { memberId: v.id('members') },
  handler: async (ctx, { memberId }) => {
    const actor = await requireOwner(ctx);
    if (memberId === actor.memberId) throw fail('VALIDATION', 'No puedes retirarte a ti misma.');
    const member = await ctx.db.get(memberId);
    if (!member) throw fail('NOT_FOUND');
    const now = Date.now();
    if (member.revokedAt === undefined) await ctx.db.patch(memberId, { revokedAt: now });
    const profile = await ctx.db.query('profile').withIndex('by_memberId', (q) => q.eq('memberId', memberId)).unique();
    if (profile?.shareEnabled || profile?.shareTokenHash) {
      await ctx.db.patch(profile._id, { shareEnabled: false, shareTokenHash: undefined, sharePhoto: false, shareAcademic: false, updatedAt: now });
    }
    const invites = await ctx.db.query('invites').withIndex('by_creator', (q) => q.eq('createdBy', memberId)).collect();
    for (const invite of invites) {
      if (invite.usedAt === undefined && invite.revokedAt === undefined) await ctx.db.patch(invite._id, { revokedAt: now });
    }
    await logEvent(ctx, actor, { type: 'member.revoked', subjectKind: 'member', subjectId: memberId, subjectTitle: member.name });
  },
});

/** Cualquier persona edita su propio nombre y rol (2 a 60 caracteres). */
export const updateSelf = mutation({
  args: { name: v.string(), roleLabel: v.string() },
  handler: async (ctx, args) => {
    const actor = await requireMember(ctx);
    const name = args.name.trim();
    const roleLabel = args.roleLabel.trim();
    if (name.length < LIMITS.nameMin || name.length > LIMITS.nameMax) throw fail('VALIDATION', 'Escribe tu nombre (2 a 60 caracteres).');
    if (roleLabel.length < LIMITS.nameMin || roleLabel.length > LIMITS.nameMax) throw fail('VALIDATION', 'Escribe tu rol (2 a 60 caracteres).');
    await ctx.db.patch(actor.memberId, { name, roleLabel });
    await logEvent(ctx, { ...actor, name, roleLabel }, { type: 'member.updated', subjectKind: 'member', subjectId: actor.memberId, subjectTitle: name });
  },
});
