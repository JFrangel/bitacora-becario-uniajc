import type { Id } from '../_generated/dataModel';
import type { QueryCtx } from '../_generated/server';
import { toEventDto } from './events';
import type { EventDto } from './events';
import { LIMITS } from './limits';

/**
 * Historial del más reciente al más antiguo, de 50 en 50. `withOwnerEvents` incluye los eventos de la Bitácora
 * (`visibility: 'owner'`); sin él solo salen los del equipo.
 */
export async function pageEvents(
  ctx: QueryCtx,
  opts: { withOwnerEvents: boolean; cursor?: string | null; actorId?: Id<'members'>; subjectId?: string; workspaceId?: Id<'workspaces'> },
): Promise<{ items: EventDto[]; nextCursor: string | null }> {
  const base = opts.workspaceId
    ? opts.withOwnerEvents
      ? ctx.db.query('events').withIndex('by_workspace_at', (q) => q.eq('workspaceId', opts.workspaceId!))
      : ctx.db.query('events').withIndex('by_workspace_visibility_at', (q) => q.eq('workspaceId', opts.workspaceId!).eq('visibility', 'team'))
    : opts.withOwnerEvents
      ? ctx.db.query('events').withIndex('by_at')
      : ctx.db.query('events').withIndex('by_visibility_at', (q) => q.eq('visibility', 'team'));
  let ordered = base.order('desc');
  if (opts.actorId) ordered = ordered.filter((q) => q.eq(q.field('actorId'), opts.actorId));
  if (opts.subjectId) ordered = ordered.filter((q) => q.eq(q.field('subjectId'), opts.subjectId));
  const page = await ordered.paginate({ numItems: LIMITS.eventsPage, cursor: opts.cursor ?? null });
  return { items: page.page.map(toEventDto), nextCursor: page.isDone ? null : page.continueCursor };
}
