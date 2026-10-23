import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';
import { fail } from './errors';

type Ctx = QueryCtx | MutationCtx;

export async function workspaceMembership(ctx: Ctx, memberId: Id<'members'>, workspaceId: Id<'workspaces'>) {
  const rows = await ctx.db
    .query('workspaceMembers')
    .withIndex('by_member_workspace', (q) => q.eq('memberId', memberId).eq('workspaceId', workspaceId))
    .collect();
  return rows.find((row) => row.revokedAt === undefined) ?? null;
}

export async function requireWorkspaceMembership(ctx: Ctx, memberId: Id<'members'>, workspaceId: Id<'workspaces'>) {
  const membership = await workspaceMembership(ctx, memberId, workspaceId);
  if (!membership || !(await ctx.db.get(workspaceId))) throw fail('FORBIDDEN', 'No tienes acceso a esta Bitácora.');
  return membership;
}

export function filterWorkspaceRows<T extends { workspaceId?: Id<'workspaces'> }>(rows: T[], workspaceId?: Id<'workspaces'>): T[] {
  return rows.filter((row) => row.workspaceId === workspaceId);
}

export type WorkspaceSummary = {
  id: Id<'workspaces'>;
  name: string;
  role: 'owner' | 'editor';
  ownerName: string;
  updatedAt: number;
  isInitial: boolean;
};

export async function listMemberWorkspaces(ctx: Ctx, memberId: Id<'members'>): Promise<WorkspaceSummary[]> {
  const memberships = await ctx.db.query('workspaceMembers').withIndex('by_member', (q) => q.eq('memberId', memberId)).collect();
  const active = memberships.filter((membership) => membership.revokedAt === undefined);
  const workspaces = await Promise.all(active.map(async (membership) => {
    const workspace = await ctx.db.get(membership.workspaceId);
    if (!workspace) return null;
    const owner = await ctx.db.get(workspace.ownerMemberId);
    return {
      id: workspace._id,
      name: workspace.name,
      role: membership.role,
      ownerName: owner?.name ?? 'Propietario',
      updatedAt: workspace.updatedAt,
      isInitial: workspace.legacyKey === 'initial',
    } satisfies WorkspaceSummary;
  }));
  return workspaces.filter((workspace): workspace is WorkspaceSummary => workspace !== null).sort((a, b) => b.updatedAt - a.updatedAt);
}
