import { v } from 'convex/values';
import { makeFunctionReference } from 'convex/server';
import type { FunctionReference } from 'convex/server';
import type { Id } from './_generated/dataModel';
import { action } from './_generated/server';
import type { ActionCtx } from './_generated/server';
import { fail } from './lib/errors';

type MigrationStatus = {
  unassigned: Record<'projects' | 'tasks' | 'journalEntries' | 'events' | 'invites' | 'settings', number>;
  associated: Record<'projects' | 'tasks' | 'journalEntries' | 'events' | 'invites' | 'settings', number>;
  inconsistentReferences: number;
};
type BatchArgs = { cursor?: string; limit?: number };
type BatchResult = { cursor: string | null; processed: number; workspaceId: Id<'workspaces'> };

const statusRef = makeFunctionReference<'query', Record<string, never>, MigrationStatus>('workspaceMigration:status') as unknown as FunctionReference<'query', 'internal', Record<string, never>, MigrationStatus>;
const runBatchRef = makeFunctionReference<'mutation', BatchArgs, BatchResult>('workspaceMigration:runBatch') as unknown as FunctionReference<'mutation', 'internal', BatchArgs, BatchResult>;

function assertMigrationSecret(secret: string) {
  const configured = process.env.WORKSPACE_MIGRATION_SECRET;
  if (!configured || secret !== configured) throw fail('FORBIDDEN', 'La clave de migración no es válida o no está configurada en este despliegue.');
}

// The CLI cannot invoke internal functions directly. Keep the administrative bridge secret-gated.
export const statusAction = action({
  args: { secret: v.string() },
  handler: async (ctx: ActionCtx, { secret }) => {
    assertMigrationSecret(secret);
    return await ctx.runQuery(statusRef, {});
  },
});

export const runBatchAction = action({
  args: { secret: v.string(), cursor: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx: ActionCtx, { secret, ...args }) => {
    assertMigrationSecret(secret);
    return await ctx.runMutation(runBatchRef, args);
  },
});
