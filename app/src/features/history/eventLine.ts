import type { EventDto, EventType } from '../../../convex/lib/events';
import { bogotaDate, daysFromToday } from '../../../convex/lib/dates';
import { columnName } from '../board/columns';
import { formatShort } from '../../lib/format';
import type { TaskStatus } from '../../../convex/lib/types';

const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;
const pad = (n: number) => String(n).padStart(2, '0');

/** «Hoy · 09:42» · «Ayer · 17:30» · «19 oct · 16:20» (con el año si no es de este año), siempre en hora de Bogotá. */
export function dayLabel(at: number, now: number): string {
  const day = bogotaDate(at);
  const today = bogotaDate(now);
  const local = new Date(at - BOGOTA_OFFSET_MS);
  const time = `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
  if (day === today) return `Hoy · ${time}`;
  if (day === daysFromToday(today, -1)) return `Ayer · ${time}`;
  const year = day.slice(0, 4) === today.slice(0, 4) ? '' : ` ${day.slice(0, 4)}`;
  return `${formatShort(day)}${year} · ${time}`;
}

export type EventText = { who: string; verb: string; subject: string; detail: string; glyph: string };

const GLYPH: Record<EventType, string> = {
  'task.created': '+',
  'task.edited': '✎',
  'task.moved': '→',
  'task.completed': '✓',
  'task.deleted': '×',
  'project.created': '+',
  'invite.created': '↗',
  'member.joined': '↗',
  'member.updated': '✎',
  'member.revoked': '×',
  'share.changed': '↗',
  'journal.draft_created': '+',
  'journal.documented': '✎',
  'journal.edited': '✎',
  'journal.deleted': '×',
};

/** [tercera persona, segunda persona] */
const VERB: Record<EventType, [string, string]> = {
  'task.created': ['añadió', 'añadiste'],
  'task.edited': ['editó', 'editaste'],
  'task.moved': ['movió', 'moviste'],
  'task.completed': ['completó', 'completaste'],
  'task.deleted': ['eliminó', 'eliminaste'],
  'project.created': ['creó el proyecto', 'creaste el proyecto'],
  'invite.created': ['invitó a alguien', 'invitaste a alguien'],
  'member.joined': ['aceptó una invitación', 'aceptaste una invitación'],
  'member.updated': ['actualizó su perfil', 'actualizaste tu perfil'],
  'member.revoked': ['retiró el acceso de', 'retiraste el acceso de'],
  'share.changed': ['cambió el enlace de solo lectura', 'cambiaste el enlace de solo lectura'],
  'journal.draft_created': ['creó un borrador', 'creaste un borrador'],
  'journal.documented': ['documentó', 'documentaste'],
  'journal.edited': ['editó el registro', 'editaste el registro'],
  'journal.deleted': ['eliminó el registro', 'eliminaste el registro'],
};

const PRIORITY: Record<number, string> = { 1: 'baja', 2: 'media', 3: 'alta' };
type Change = { from?: unknown; to?: unknown };
const asChange = (value: unknown): Change => (value && typeof value === 'object' ? (value as Change) : {});
const statusName = (value: unknown) => (typeof value === 'string' ? columnName(value as TaskStatus) : '');

const FIELD_NOUN: Record<string, string> = {
  title: 'el nombre',
  description: 'la descripción',
  subtasks: 'las subtareas',
  projectId: 'el proyecto',
  priority: 'la prioridad',
  dueDate: 'la fecha límite',
  assigneeId: 'el responsable',
};

/** Con un solo campo se dice qué valor tomó; con varios, solo cuáles cambiaron. */
function singleEdit(field: string, changes: Record<string, unknown>): string {
  switch (field) {
    case 'projectId': {
      const to = asChange(changes.projectName).to;
      return typeof to === 'string' ? `Cambió el proyecto a ${to}` : 'Cambió el proyecto';
    }
    case 'priority': {
      const { from, to } = asChange(changes.priority);
      return typeof from === 'number' && typeof to === 'number' ? `Cambió la prioridad de ${PRIORITY[from]} a ${PRIORITY[to]}` : 'Cambió la prioridad';
    }
    case 'dueDate': {
      const to = asChange(changes.dueDate).to;
      return typeof to === 'string' ? `Cambió la fecha límite al ${formatShort(to)}` : 'Quitó la fecha límite';
    }
    case 'assigneeId': {
      const to = asChange(changes.assigneeName).to;
      return typeof to === 'string' ? `Asignó a ${to}` : 'Quitó al responsable';
    }
    default:
      return `Cambió ${FIELD_NOUN[field] ?? field}`;
  }
}

function editDetail(detail: Record<string, unknown> | undefined): string {
  const fields = (detail?.fields as string[] | undefined) ?? [];
  const changes = (detail?.changes as Record<string, unknown> | undefined) ?? {};
  if (fields.length === 0) return '';
  if (fields.length === 1) return singleEdit(fields[0], changes);
  const nouns = fields.map((field) => FIELD_NOUN[field] ?? field);
  return `Cambió ${nouns.slice(0, -1).join(', ')} y ${nouns[nouns.length - 1]}`;
}

function shareDetail(detail: Record<string, unknown> | undefined): string {
  if (!detail) return '';
  if (detail.regenerated) return 'Creó un enlace nuevo; el anterior dejó de funcionar';
  const parts: string[] = [];
  if (typeof detail.enabled === 'boolean') parts.push(detail.enabled ? 'Lo activó' : 'Lo desactivó');
  if (typeof detail.includesJournal === 'boolean') parts.push(detail.includesJournal ? 'Ahora incluye la Bitácora' : 'Ya no incluye la Bitácora');
  if (typeof detail.showsDescriptions === 'boolean') parts.push(detail.showsDescriptions ? 'Ahora muestra las descripciones' : 'Ya no muestra las descripciones');
  return parts.join(' · ');
}

function detailOf(event: EventDto): string {
  const detail = event.detail;
  switch (event.type) {
    case 'task.created': {
      const assignee = typeof detail?.assigneeName === 'string' ? `Asignada a ${detail.assigneeName}` : 'Sin responsable';
      const due = typeof detail?.dueDate === 'string' ? ` · vence el ${formatShort(detail.dueDate)}` : '';
      return `${assignee}${due}`;
    }
    case 'task.edited':
      return editDetail(detail);
    case 'task.moved':
    case 'task.completed':
      return detail?.from && detail?.to ? `${statusName(detail.from)} → ${statusName(detail.to)}` : '';
    case 'invite.created':
      return 'Enlace de un solo uso';
    case 'share.changed':
      return shareDetail(detail);
    default:
      return '';
  }
}

/** La línea del historial: quién, qué hizo, sobre qué y el detalle. Con `meId`, tus propios eventos van en segunda persona. */
export function eventLine(event: EventDto, meId: string | null): EventText {
  const you = meId !== null && event.actorId === meId;
  return {
    who: you ? 'Tú' : event.actorName,
    verb: VERB[event.type][you ? 1 : 0],
    subject: event.subjectTitle ? `«${event.subjectTitle}»` : '',
    detail: detailOf(event),
    glyph: GLYPH[event.type],
  };
}
