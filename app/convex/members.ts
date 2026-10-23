import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { requireMember, requireWorkspaceOwner, resolveWorkspaceActor } from './lib/actors';
import { fail } from './lib/errors';
import { logEvent } from './lib/events';
import { LIMITS } from './lib/limits';
import { workspaceMembership } from './lib/workspaces';

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
  args: { workspaceId: v.optional(v.id('workspaces')) },
  handler: async (ctx, { workspaceId }) => {
    const actor = await resolveWorkspaceActor(ctx, workspaceId);
    if (actor.workspaceId) {
      const memberships = await ctx.db.query('workspaceMembers').withIndex('by_workspace', (q) => q.eq('workspaceId', actor.workspaceId!)).collect();
      const members = await Promise.all(memberships.filter((m) => m.revokedAt === undefined).map((m) => ctx.db.get(m.memberId)));
      return memberships.filter((m) => m.revokedAt === undefined).flatMap((membership, index) => {
        const member = members[index];
        return member && member.revokedAt === undefined ? [{ id: member._id, name: member.name, roleLabel: member.roleLabel, isOwner: membership.role === 'owner' }] : [];
      }).sort((a, b) => a.name.localeCompare(b.name, 'es'));
    }
    const members = await ctx.db.query('members').collect();
    return members
      .filter((m) => m.revokedAt === undefined)
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
      .map((m) => ({ id: m._id, name: m.name, roleLabel: m.roleLabel, isOwner: m.isOwner }));
  },
});

/** Solo la dueña: lista de personas con el correo de su cuenta (para comprobar quién entró) y quién invitó a quién. */
export const list = query({
  args: { workspaceId: v.optional(v.id('workspaces')) },
  handler: async (ctx, { workspaceId }) => {
    const actor = await requireWorkspaceOwner(ctx, workspaceId);
    if (!actor.workspaceId) {
      const members = await ctx.db.query('members').collect();
      const byId = new Map(members.map((m) => [m._id, m]));
      return members.map((m) => ({ id: m._id, name: m.name, roleLabel: m.roleLabel, email: m.email, invitedByName: m.invitedBy ? byId.get(m.invitedBy)?.name : undefined, createdAt: m.createdAt, lastSeenAt: m.lastSeenAt, revoked: m.revokedAt !== undefined }));
    }
    const memberships = await ctx.db.query('workspaceMembers').withIndex('by_workspace', (q) => q.eq('workspaceId', actor.workspaceId!)).collect();
    const records = await Promise.all(memberships.map((membership) => ctx.db.get(membership.memberId)));
    const members = records.filter((member): member is NonNullable<typeof member> => Boolean(member));
    const byId = new Map(members.map((m) => [m._id, m]));
    return memberships.flatMap((membership) => {
      const m = byId.get(membership.memberId);
      if (!m) return [];
      return [{
      id: m._id,
      name: m.name,
      roleLabel: m.roleLabel,
      email: m.email,
      invitedByName: m.invitedBy ? byId.get(m.invitedBy)?.name : undefined,
      createdAt: m.createdAt,
      lastSeenAt: m.lastSeenAt,
      revoked: membership.revokedAt !== undefined || m.revokedAt !== undefined,
    }];
    });
  },
});

/** Solo la dueña. Retira el acceso de inmediato y revoca las invitaciones pendientes de esa persona (no a quienes ya entraron). */
export const revoke = mutation({
  args: { memberId: v.id('members'), workspaceId: v.optional(v.id('workspaces')) },
  handler: async (ctx, { memberId, workspaceId }) => {
    const actor = await requireWorkspaceOwner(ctx, workspaceId);
    if (memberId === actor.memberId) throw fail('VALIDATION', 'No puedes retirarte a ti misma.');
    const member = await ctx.db.get(memberId);
    if (!member) throw fail('NOT_FOUND');
    const now = Date.now();
    if (!actor.workspaceId) {
      if (member.isOwner) throw fail('VALIDATION', 'No puedes retirar el acceso de la persona propietaria.');
      if (member.revokedAt === undefined) await ctx.db.patch(memberId, { revokedAt: now });
      const invites = await ctx.db.query('invites').withIndex('by_creator', (q) => q.eq('createdBy', memberId)).collect();
      for (const invite of invites) {
        if (invite.workspaceId === undefined && invite.usedAt === undefined && invite.revokedAt === undefined) await ctx.db.patch(invite._id, { revokedAt: now });
      }
      await logEvent(ctx, actor, { type: 'member.revoked', subjectKind: 'member', subjectId: memberId, subjectTitle: member.name });
      return;
    }
    const memberships = await ctx.db.query('workspaceMembers').withIndex('by_member_workspace', (q) => q.eq('memberId', memberId).eq('workspaceId', actor.workspaceId!)).collect();
    const membership = memberships.find((row) => row.revokedAt === undefined);
    if (!membership) throw fail('NOT_FOUND', 'La persona no pertenece a esta Bitácora.');
    if (membership.role === 'owner') throw fail('VALIDATION', 'No puedes retirar a la persona propietaria de esta Bitácora.');
    await ctx.db.patch(membership._id, { revokedAt: now });
    const invites = await ctx.db.query('invites').withIndex('by_creator', (q) => q.eq('createdBy', memberId)).collect();
    for (const invite of invites) {
      if (invite.workspaceId === actor.workspaceId && invite.usedAt === undefined && invite.revokedAt === undefined) await ctx.db.patch(invite._id, { revokedAt: now });
    }
    await logEvent(ctx, actor, { type: 'member.revoked', subjectKind: 'member', subjectId: memberId, subjectTitle: member.name }, { workspaceId: actor.workspaceId });
  },
});

/** Cualquier persona edita su propio nombre y rol (2 a 60 caracteres). */
export const updateSelf = mutation({
  args: { name: v.string(), roleLabel: v.string(), workspaceId: v.optional(v.id('workspaces')) },
  handler: async (ctx, args) => {
    const actor = args.workspaceId ? await resolveWorkspaceActor(ctx, args.workspaceId) : await requireMember(ctx);
    const name = args.name.trim();
    const roleLabel = args.roleLabel.trim();
    if (name.length < LIMITS.nameMin || name.length > LIMITS.nameMax) throw fail('VALIDATION', 'Escribe tu nombre (2 a 60 caracteres).');
    if (roleLabel.length < LIMITS.nameMin || roleLabel.length > LIMITS.nameMax) throw fail('VALIDATION', 'Escribe tu rol (2 a 60 caracteres).');
    let eventWorkspaceId = args.workspaceId;
    if (!eventWorkspaceId) {
      const initial = await ctx.db.query('workspaces').withIndex('by_legacy_key', (q) => q.eq('legacyKey', 'initial')).unique();
      if (initial && await workspaceMembership(ctx, actor.memberId, initial._id)) eventWorkspaceId = initial._id;
    }
    await ctx.db.patch(actor.memberId, { name, roleLabel });
    await logEvent(ctx, { ...actor, name, roleLabel }, { type: 'member.updated', subjectKind: 'member', subjectId: actor.memberId, subjectTitle: name }, { workspaceId: eventWorkspaceId });
  },
});
