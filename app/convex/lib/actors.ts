import { getAuthUserId } from '@convex-dev/auth/server';
import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';
import { fail } from './errors';

export type Actor = { memberId: Id<'members'>; isOwner: boolean; name: string; roleLabel: string };

type Ctx = QueryCtx | MutationCtx;

/**
 * Única función que lee la identidad: la cuenta de Google (Convex Auth) → registro vigente de `members`.
 * Si algún día se cambia de proveedor, solo cambia este archivo.
 */
export async function getActor(ctx: Ctx): Promise<Actor | null> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  const member = await ctx.db.query('members').withIndex('by_userId', (q) => q.eq('userId', userId)).unique();
  if (!member || member.revokedAt !== undefined) return null;
  return { memberId: member._id, isOwner: member.isOwner, name: member.name, roleLabel: member.roleLabel };
}

export async function requireMember(ctx: Ctx): Promise<Actor> {
  const actor = await getActor(ctx);
  if (!actor) throw fail('UNAUTHENTICATED');
  return actor;
}

export async function requireOwner(ctx: Ctx): Promise<Actor> {
  const actor = await requireMember(ctx);
  if (!actor.isOwner) throw fail('FORBIDDEN');
  return actor;
}

/** Enlace de solo lectura: devuelve los ajustes si el token coincide y el enlace está activo. */
export async function requireViewer(ctx: Ctx, shareToken: string): Promise<Doc<'settings'>> {
  const settings = await ctx.db.query('settings').first();
  if (!settings || !settings.shareEnabled || !settings.shareToken || settings.shareToken !== shareToken) {
    throw fail('FORBIDDEN', 'Este enlace ya no está activo');
  }
  return settings;
}
