import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import type { Actor } from './actors';

export type EventType =
  | 'task.created' | 'task.edited' | 'task.moved' | 'task.completed' | 'task.deleted'
  | 'project.created' | 'invite.created' | 'member.joined' | 'member.updated' | 'member.revoked'
  | 'share.changed' | 'journal.draft_created' | 'journal.documented' | 'journal.edited' | 'journal.deleted';

export type EventDto = {
  id: Id<'events'>;
  at: number;
  actorId: Id<'members'>;
  actorName: string;
  actorRole: string;
  type: EventType;
  subjectKind: string;
  subjectId?: string;
  subjectTitle?: string;
  detail?: Record<string, unknown>;
};

/**
 * Escribe un evento inmutable. Copia el nombre y el rol de quien actúa en ese momento.
 * Los eventos de la Bitácora (`journal.*`) son solo para la dueña (y el enlace de solo lectura que incluya la Bitácora).
 * Debe llamarse dentro de la misma mutación que hace el cambio.
 */
export async function logEvent(
  ctx: MutationCtx,
  actor: Actor,
  e: { type: EventType; subjectKind: string; subjectId?: string; subjectTitle?: string; detail?: Record<string, unknown> },
): Promise<void> {
  await ctx.db.insert('events', {
    at: Date.now(),
    actorId: actor.memberId,
    actorName: actor.name,
    actorRole: actor.roleLabel,
    type: e.type,
    subjectKind: e.subjectKind,
    subjectId: e.subjectId,
    subjectTitle: e.subjectTitle,
    detail: e.detail,
    visibility: e.type.startsWith('journal.') ? 'owner' : 'team',
  });
}

export const toEventDto = (e: Doc<'events'>): EventDto => ({
  id: e._id,
  at: e.at,
  actorId: e.actorId,
  actorName: e.actorName,
  actorRole: e.actorRole,
  type: e.type,
  subjectKind: e.subjectKind,
  subjectId: e.subjectId,
  subjectTitle: e.subjectTitle,
  detail: e.detail,
});
