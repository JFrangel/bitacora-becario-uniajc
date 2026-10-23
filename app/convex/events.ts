import { v } from 'convex/values';
import { query } from './_generated/server';
import { requireViewer, resolveWorkspaceActor } from './lib/actors';
import { pageEvents } from './lib/eventPages';

/** Historial: del más reciente al más antiguo, de 50 en 50. No existe ninguna operación para editarlo o borrarlo. */
export const list = query({
  args: {
    shareToken: v.optional(v.string()),
    workspaceId: v.optional(v.id('workspaces')),
    cursor: v.optional(v.union(v.string(), v.null())),
    actorId: v.optional(v.id('members')),
    /** Solo los eventos de una tarea, un registro, etc. (para el historial del detalle de una tarea). */
    subjectId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.shareToken !== undefined) {
      const settings = await requireViewer(ctx, args.shareToken);
      return pageEvents(ctx, { withOwnerEvents: settings.shareIncludesJournal, workspaceId: settings.workspaceId, cursor: args.cursor, actorId: args.actorId, subjectId: args.subjectId });
    }
    const actor = await resolveWorkspaceActor(ctx, args.workspaceId);
    return pageEvents(ctx, { withOwnerEvents: actor.workspaceRole === 'owner', workspaceId: actor.workspaceId, cursor: args.cursor, actorId: args.actorId, subjectId: args.subjectId });
  },
});
