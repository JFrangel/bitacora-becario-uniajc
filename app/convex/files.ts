import { v } from 'convex/values';
import { mutation } from './_generated/server';
import { requireWorkspaceOwner } from './lib/actors';

/** Dirección de un solo uso para subir una imagen de evidencia. Solo la dueña. */
export const generateUploadUrl = mutation({
  args: { workspaceId: v.optional(v.id('workspaces')) },
  handler: async (ctx, { workspaceId }) => {
    await requireWorkspaceOwner(ctx, workspaceId);
    return ctx.storage.generateUploadUrl();
  },
});
