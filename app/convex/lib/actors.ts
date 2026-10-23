import { getAuthUserId } from '@convex-dev/auth/server';
import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';
import { fail } from './errors';
import { requireWorkspaceMembership, workspaceMembership } from './workspaces';

export type Actor = { memberId: Id<'members'>; isOwner: boolean; name: string; roleLabel: string };
export type WorkspaceActor = Actor & { workspaceId?: Id<'workspaces'>; workspaceRole: 'owner' | 'editor' };

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

/** Identidad global más rol vigente en el espacio solicitado; no deriva permisos de `members.isOwner`. */
export async function requireWorkspaceActor(ctx: Ctx, workspaceId: Id<'workspaces'>): Promise<WorkspaceActor> {
  const actor = await requireMember(ctx);
  const membership = await requireWorkspaceMembership(ctx, actor.memberId, workspaceId);
  return { ...actor, workspaceId, workspaceRole: membership.role };
}

/** Resolves omitted legacy arguments to the original workspace, or to unscoped rows before backfill exists. */
export async function resolveWorkspaceActor(ctx: Ctx, requestedWorkspaceId?: Id<'workspaces'>): Promise<WorkspaceActor> {
  const actor = await requireMember(ctx);
  const workspace = requestedWorkspaceId
    ? await ctx.db.get(requestedWorkspaceId)
    : await ctx.db.query('workspaces').withIndex('by_legacy_key', (q) => q.eq('legacyKey', 'initial')).unique();
  if (requestedWorkspaceId && !workspace) throw fail('FORBIDDEN', 'No tienes acceso a esta Bitácora.');
  if (!workspace) return { ...actor, workspaceRole: actor.isOwner ? 'owner' : 'editor' };
  const membership = await workspaceMembership(ctx, actor.memberId, workspace._id);
  if (!membership) throw fail('FORBIDDEN', 'No tienes acceso a esta Bitácora.');
  return { ...actor, workspaceId: workspace._id, workspaceRole: membership.role };
}

export async function requireWorkspaceOwner(ctx: Ctx, workspaceId?: Id<'workspaces'>): Promise<WorkspaceActor> {
  const actor = await resolveWorkspaceActor(ctx, workspaceId);
  if (actor.workspaceRole !== 'owner') throw fail('FORBIDDEN');
  return actor;
}

/** Enlace de solo lectura: devuelve los ajustes si el token coincide y el enlace está activo. */
export async function requireViewer(ctx: Ctx, shareToken: string): Promise<Doc<'settings'>> {
  const settings = await ctx.db.query('settings').withIndex('by_shareToken', (q) => q.eq('shareToken', shareToken)).unique();
  if (!settings || !settings.shareEnabled || !settings.shareToken || settings.shareToken !== shareToken) {
    throw fail('FORBIDDEN', 'Este enlace ya no está activo');
  }
  return settings;
}
