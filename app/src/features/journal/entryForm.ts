import type { JournalDto } from '../../../convex/lib/journalDto';
import { HOURS_MESSAGE, parseHours } from '../../../convex/lib/hours';
import type { ActivityStatus } from '../../../convex/lib/types';
import { formatHours } from '../../lib/format';

/** Imagen ya guardada en el servidor (se conserva su archivo y su miniatura). */
export type SavedPhoto = { storageId: string; thumbStorageId?: string; name: string; url?: string; thumbUrl?: string };
/** Imagen elegida en este formulario que todavía no se sube: ya viene comprimida. */
export type PendingPhoto = { key: string; name: string; full: Blob; thumb: Blob; previewUrl: string };

export type EntryForm = {
  date: string;
  /** Texto tal cual se escribe: acepta la coma decimal. */
  hours: string;
  projectName: string;
  activity: string;
  objective: string;
  development: string;
  result: string;
  observations: string;
  activityStatus: ActivityStatus;
  links: Array<{ label: string; url: string }>;
  photos: SavedPhoto[];
  pending: PendingPhoto[];
  linkLabel: string;
  linkUrl: string;
};

/** Valores iniciales del formulario «Registrar actividad»: hoy, 2 horas y «Completada». */
export function newEntryForm(today: string): EntryForm {
  return { date: today, hours: '2', projectName: '', activity: '', objective: '', development: '', result: '', observations: '', activityStatus: 'Completada', links: [], photos: [], pending: [], linkLabel: '', linkUrl: '' };
}

/** Un registro (o un borrador) en el formulario. En un borrador las horas quedan vacías: la dueña las escribe. */
export function entryFormFrom(entry: JournalDto): EntryForm {
  return {
    date: entry.date,
    hours: entry.isDraft || entry.hours === undefined ? '' : formatHours(entry.hours),
    projectName: entry.projectName,
    activity: entry.activity,
    objective: entry.objective ?? '',
    development: entry.development ?? '',
    result: entry.result ?? '',
    observations: entry.observations ?? '',
    activityStatus: entry.activityStatus,
    links: entry.links.map((l) => ({ ...l })),
    photos: entry.photos.filter((p) => p.storageId).map((p) => ({ storageId: p.storageId!, thumbStorageId: p.thumbStorageId, name: p.name, url: p.url, thumbUrl: p.thumbUrl })),
    pending: [],
    linkLabel: '',
    linkUrl: '',
  };
}

export type EntryCheck = { ok: true; hours: number } | { ok: false; field: 'date' | 'hours' | 'project' | 'activity' | 'result'; message: string };

/** Obligatorios: fecha, horas, proyecto, título de la actividad y resultado. Todos responden con el mismo mensaje del sitio publicado. */
export function validateEntryForm(form: EntryForm): EntryCheck {
  if (!form.date) return { ok: false, field: 'date', message: HOURS_MESSAGE };
  const hours = parseHours(form.hours);
  if (hours === null) return { ok: false, field: 'hours', message: HOURS_MESSAGE };
  if (!form.projectName.trim()) return { ok: false, field: 'project', message: HOURS_MESSAGE };
  if (!form.activity.trim()) return { ok: false, field: 'activity', message: HOURS_MESSAGE };
  if (!form.result.trim()) return { ok: false, field: 'result', message: HOURS_MESSAGE };
  return { ok: true, hours };
}

/**
 * El enlace escrito en las dos cajas. Vacío ⇒ `null`; sin nombre ⇒ se usa el dominio; sin dirección o con otro esquema
 * que http o https ⇒ lanza el mensaje exacto de la especificación.
 */
export function pendingLink(label: string, url: string): { label: string; url: string } | null {
  const [name, address] = [label.trim(), url.trim()];
  if (!address) {
    if (name) throw new Error('Completa la dirección web del enlace.');
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(address);
  } catch {
    throw new Error('Usa un enlace que comience con http:// o https://.');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('Usa un enlace que comience con http:// o https://.');
  return { label: name || parsed.hostname, url: address };
}

/** Argumentos de `journal.createManual` / `update` / `documentDraft` (`photos` ya con sus archivos subidos). */
export function toFieldsArgs(form: EntryForm, photos: Array<{ storageId: string; thumbStorageId?: string; name: string }>) {
  const optional = (text: string) => (text.trim() ? text.trim() : undefined);
  return {
    date: form.date,
    hours: form.hours,
    projectName: form.projectName.trim(),
    activity: form.activity.trim(),
    ...(optional(form.objective) ? { objective: optional(form.objective) } : {}),
    ...(optional(form.development) ? { development: optional(form.development) } : {}),
    result: form.result.trim(),
    ...(optional(form.observations) ? { observations: optional(form.observations) } : {}),
    activityStatus: form.activityStatus,
    links: form.links,
    photos,
  };
}
