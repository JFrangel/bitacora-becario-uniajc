import { v } from 'convex/values';
import { query } from './_generated/server';
import { requireMember, requireViewer } from './lib/actors';
import { pageEvents } from './lib/eventPages';

/** Historial: del más reciente al más antiguo, de 50 en 50. No existe ninguna operación para editarlo o borrarlo. */
export const list = query({
  args: {
    shareToken: v.optional(v.string()),
    cursor: v.optional(v.union(v.string(), v.null())),
    actorId: v.optional(v.id('members')),
    /** Solo los eventos de una tarea, un registro, etc. (para el historial del detalle de una tarea). */
    subjectId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const withOwnerEvents =
      args.shareToken !== undefined ? (await requireViewer(ctx, args.shareToken)).shareIncludesJournal : (await requireMember(ctx)).isOwner;
    return pageEvents(ctx, { withOwnerEvents, cursor: args.cursor, actorId: args.actorId, subjectId: args.subjectId });
  },
});
