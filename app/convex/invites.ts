import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { requireMember } from './lib/actors';
import { fail } from './lib/errors';
import { logEvent } from './lib/events';
import { LIMITS } from './lib/limits';
import { newToken, sha256Hex } from './lib/tokens';

const DAY_MS = 24 * 60 * 60 * 1000;
const isPending = (i: { usedAt?: number; revokedAt?: number; expiresAt: number }, now: number) =>
  i.usedAt === undefined && i.revokedAt === undefined && i.expiresAt > now;

/** Genera un enlace de invitación de un solo uso. Devuelve el token en claro **una sola vez**; en la base solo queda su hash. */
export const create = mutation({
  args: {},
  handler: async (ctx) => {
    const actor = await requireMember(ctx);
    const now = Date.now();
    const mine = await ctx.db.query('invites').withIndex('by_creator', (q) => q.eq('createdBy', actor.memberId)).collect();
    if (mine.filter((i) => isPending(i, now)).length >= LIMITS.pendingInvites) {
      throw fail('LIMIT', `Ya tienes ${LIMITS.pendingInvites} invitaciones pendientes. Revoca alguna para crear otra.`);
    }
    const token = newToken();
    await ctx.db.insert('invites', {
      tokenHash: await sha256Hex(token),
      createdBy: actor.memberId,
      createdAt: now,
      expiresAt: now + LIMITS.inviteDays * DAY_MS,
    });
    await logEvent(ctx, actor, { type: 'invite.created', subjectKind: 'invite' });
    const base = (process.env.SITE_URL ?? '').replace(/\/$/, '');
    return { link: `${base}/#/invitacion/${token}` };
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
  args: {},
  handler: async (ctx) => {
    const actor = await requireMember(ctx);
    const now = Date.now();
    const rows = await ctx.db.query('invites').withIndex('by_creator', (q) => q.eq('createdBy', actor.memberId)).collect();
    return rows.filter((i) => isPending(i, now)).map((i) => ({ id: i._id, expiresAt: i.expiresAt }));
  },
});

export const revoke = mutation({
  args: { inviteId: v.id('invites') },
  handler: async (ctx, { inviteId }) => {
    const actor = await requireMember(ctx);
    const invite = await ctx.db.get(inviteId);
    if (!invite) throw fail('NOT_FOUND');
    if (!actor.isOwner && invite.createdBy !== actor.memberId) throw fail('FORBIDDEN');
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
    if (existing && existing.revokedAt === undefined) throw fail('ALREADY_MEMBER', 'Esta cuenta ya tiene acceso.');

    let memberId;
    if (existing) {
      memberId = existing._id;
      await ctx.db.patch(memberId, { name, roleLabel, email, invitedBy: invite.createdBy, revokedAt: undefined, lastSeenAt: now });
    } else {
      memberId = await ctx.db.insert('members', { name, roleLabel, isOwner: false, userId, email, invitedBy: invite.createdBy, createdAt: now, lastSeenAt: now });
    }
    await ctx.db.patch(invite._id, { usedBy: memberId, usedAt: now });
    await logEvent(ctx, { memberId, isOwner: false, name, roleLabel }, { type: 'member.joined', subjectKind: 'member', subjectId: memberId, subjectTitle: name });
    return { memberId };
  },
});
