import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { requireMember, resolveWorkspaceActor } from './lib/actors';
import { fail } from './lib/errors';
import { logEvent } from './lib/events';
import { LIMITS } from './lib/limits';
import { newToken, sha256Hex } from './lib/tokens';

const DAY_MS = 24 * 60 * 60 * 1000;
const isPending = (i: { usedAt?: number; revokedAt?: number; expiresAt: number }, now: number) =>
  i.usedAt === undefined && i.revokedAt === undefined && i.expiresAt > now;

/** Genera un enlace de invitación de un solo uso. Devuelve el token en claro **una sola vez**; en la base solo queda su hash. */
export const create = mutation({
  args: { workspaceId: v.optional(v.id('workspaces')) },
  handler: async (ctx, { workspaceId }) => {
    const actor = await resolveWorkspaceActor(ctx, workspaceId);
    const now = Date.now();
    const mine = actor.workspaceId
      ? await ctx.db.query('invites').withIndex('by_workspace_creator', (q) => q.eq('workspaceId', actor.workspaceId).eq('createdBy', actor.memberId)).collect()
      : (await ctx.db.query('invites').withIndex('by_creator', (q) => q.eq('createdBy', actor.memberId)).collect()).filter((invite) => invite.workspaceId === undefined);
    if (mine.filter((i) => isPending(i, now)).length >= LIMITS.pendingInvites) {
      throw fail('LIMIT', `Ya tienes ${LIMITS.pendingInvites} invitaciones pendientes. Revoca alguna para crear otra.`);
    }
    const token = newToken();
    await ctx.db.insert('invites', {
      workspaceId: actor.workspaceId,
      tokenHash: await sha256Hex(token),
      createdBy: actor.memberId,
      createdAt: now,
      expiresAt: now + LIMITS.inviteDays * DAY_MS,
    });
    await logEvent(ctx, actor, { type: 'invite.created', subjectKind: 'invite' }, { workspaceId: actor.workspaceId });
    const base = (process.env.SITE_URL ?? '').replace(/\/$/, '');
    return { link: `${base}/invitacion/${token}` };
  },
});

/** ¿Sigue siendo válida esta invitación? No exige sesión y solo responde sí o no, para mostrar «Esta invitación ya no es válida» sin pedir antes el inicio de sesión. */
export const peek = query({
  args: { inviteToken: v.string() },
  handler: async (ctx, { inviteToken }) => {
    const hash = await sha256Hex(inviteToken);
    const invite = await ctx.db.query('invites').withIndex('by_hash', (q) => q.eq('tokenHash', hash)).unique();
    return { valid: Boolean(invite && isPending(invite, Date.now())) };
  },
});

export const mine = query({
  args: { workspaceId: v.optional(v.id('workspaces')) },
  handler: async (ctx, { workspaceId }) => {
    const actor = await resolveWorkspaceActor(ctx, workspaceId);
    const now = Date.now();
    const rows = actor.workspaceId
      ? await ctx.db.query('invites').withIndex('by_workspace_creator', (q) => q.eq('workspaceId', actor.workspaceId).eq('createdBy', actor.memberId)).collect()
      : (await ctx.db.query('invites').withIndex('by_creator', (q) => q.eq('createdBy', actor.memberId)).collect()).filter((invite) => invite.workspaceId === undefined);
    return rows.filter((i) => isPending(i, now)).map((i) => ({ id: i._id, expiresAt: i.expiresAt }));
  },
});

export const revoke = mutation({
  args: { inviteId: v.id('invites'), workspaceId: v.optional(v.id('workspaces')) },
  handler: async (ctx, { inviteId, workspaceId }) => {
    const actor = await resolveWorkspaceActor(ctx, workspaceId);
    const invite = await ctx.db.get(inviteId);
    if (!invite) throw fail('NOT_FOUND');
    if (invite.workspaceId !== actor.workspaceId) throw fail('NOT_FOUND');
    if (actor.workspaceRole !== 'owner' && invite.createdBy !== actor.memberId) throw fail('FORBIDDEN');
    if (invite.usedAt !== undefined) throw fail('INVITE_USED');
    if (invite.revokedAt === undefined) await ctx.db.patch(inviteId, { revokedAt: Date.now() });
  },
});

/**
 * Canjea una invitación con la sesión de Google de quien llama. Una sola transacción: comprueba, marca la invitación
 * como usada y crea (o reactiva) el registro de la persona. Con dos intentos simultáneos solo uno gana.
 */
export const redeem = mutation({
  args: { inviteToken: v.string(), name: v.string(), roleLabel: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw fail('UNAUTHENTICATED');
    const name = args.name.trim();
    const roleLabel = args.roleLabel.trim();
    if (name.length < LIMITS.nameMin || name.length > LIMITS.nameMax) throw fail('VALIDATION', 'Escribe tu nombre (2 a 60 caracteres).');
    if (roleLabel.length < LIMITS.nameMin || roleLabel.length > LIMITS.nameMax) throw fail('VALIDATION', 'Escribe tu rol (2 a 60 caracteres).');

    const hash = await sha256Hex(args.inviteToken);
    const invite = await ctx.db.query('invites').withIndex('by_hash', (q) => q.eq('tokenHash', hash)).unique();
    const now = Date.now();
    if (!invite) throw fail('INVITE_INVALID', 'Esta invitación ya no es válida');
    if (invite.revokedAt !== undefined) throw fail('INVITE_REVOKED', 'Esta invitación ya no es válida');
    if (invite.usedAt !== undefined) throw fail('INVITE_USED', 'Esta invitación ya no es válida');
    if (invite.expiresAt <= now) throw fail('INVITE_EXPIRED', 'Esta invitación ya no es válida');

    const user = await ctx.db.get(userId);
    const email = user?.email?.trim().toLowerCase();
    if (!email) throw fail('VALIDATION', 'Tu cuenta de Google no tiene un correo.');

    const existing = await ctx.db.query('members').withIndex('by_userId', (q) => q.eq('userId', userId)).unique();
    const initial = invite.workspaceId ? null : await ctx.db.query('workspaces').withIndex('by_legacy_key', (q) => q.eq('legacyKey', 'initial')).unique();
    const workspaceId = invite.workspaceId ?? initial?._id;
    const existingMemberships = existing && workspaceId
      ? await ctx.db.query('workspaceMembers').withIndex('by_member_workspace', (q) => q.eq('memberId', existing._id).eq('workspaceId', workspaceId)).collect()
      : [];
    const existingMembership = existingMemberships.find((membership) => membership.revokedAt === undefined);
    if (existingMembership || (existing && existing.revokedAt === undefined && !workspaceId)) {
      throw fail('ALREADY_MEMBER', 'Esta cuenta ya tiene acceso a esta Bitácora.');
    }

    let memberId;
    if (existing) {
      memberId = existing._id;
      await ctx.db.patch(memberId, { name, roleLabel, email, invitedBy: invite.createdBy, revokedAt: undefined, lastSeenAt: now });
    } else {
      memberId = await ctx.db.insert('members', { name, roleLabel, isOwner: false, userId, email, invitedBy: invite.createdBy, createdAt: now, lastSeenAt: now });
    }
    const profile = await ctx.db.query('profile').withIndex('by_memberId', (q) => q.eq('memberId', memberId)).unique();
    if (!profile) await ctx.db.insert('profile', { memberId, updatedAt: now });
    if (workspaceId) {
      const prior = existingMemberships[0];
      if (prior) await ctx.db.patch(prior._id, { role: 'editor', revokedAt: undefined });
      else await ctx.db.insert('workspaceMembers', { workspaceId, memberId, role: 'editor', createdAt: now });
    }
    await ctx.db.patch(invite._id, { usedBy: memberId, usedAt: now });
    await logEvent(ctx, { memberId, isOwner: false, name, roleLabel }, { type: 'member.joined', subjectKind: 'member', subjectId: memberId, subjectTitle: name }, { workspaceId });
    const workspace = workspaceId ? await ctx.db.get(workspaceId) : null;
    return { memberId, workspaceId, isInitial: workspace?.legacyKey === 'initial' };
  },
});
