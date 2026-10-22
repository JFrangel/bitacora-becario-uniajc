import type { Infer } from 'convex/values';
import { isValidDate } from './dates';
import { fail } from './errors';
import { HOURS_MESSAGE, parseHours } from './hours';
import { LIMITS } from './limits';
import { cleanText } from './text';
import type { ActivityStatus } from './types';
import { validateProjectName } from './validate';
import type { journalFieldsInput } from './validators';

export type RawJournalFields = Infer<typeof journalFieldsInput>;
export type PhotoInput = NonNullable<RawJournalFields['photos']>[number];

/** Campos ya limpios y validados; la existencia de los archivos de las imágenes se comprueba aparte (necesita la base). */
export type ValidJournalFields = {
  date: string;
  hours: number;
  projectName: string;
  activity: string;
  objective?: string;
  development?: string;
  result: string;
  observations?: string;
  activityStatus: ActivityStatus;
  links: { label: string; url: string }[];
  photos: PhotoInput[];
};

const LINK_SCHEME_MESSAGE = 'Usa un enlace que comience con http:// o https://.';
const LINK_LABEL_MAX = 80;
const LINK_URL_MAX = 2000;
const PHOTO_NAME_MAX = 120;

/** Texto opcional: vacío significa «sin valor». */
const optionalText = (raw: string | undefined) => {
  const text = (raw ?? '').trim();
  return text ? cleanText(text, LIMITS.journalField) : undefined;
};

export function validateLinks(rows: { label?: string; url: string }[] | undefined): { label: string; url: string }[] {
  const list = rows ?? [];
  if (list.length > LIMITS.links) throw fail('VALIDATION', `Puedes añadir hasta ${LIMITS.links} enlaces por registro.`);
  return list.map((row) => {
    const url = row.url.trim();
    if (!url) throw fail('VALIDATION', 'Completa la dirección web del enlace.');
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw fail('VALIDATION', LINK_SCHEME_MESSAGE);
    }
    if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || url.length > LINK_URL_MAX) throw fail('VALIDATION', LINK_SCHEME_MESSAGE);
    const label = (row.label ?? '').trim();
    return { label: label ? cleanText(label, LINK_LABEL_MAX, `El nombre del enlace admite hasta ${LINK_LABEL_MAX} caracteres.`) : parsed.hostname, url };
  });
}

export function validatePhotos(rows: PhotoInput[] | undefined): PhotoInput[] {
  const list = rows ?? [];
  if (list.length > LIMITS.photos) throw fail('VALIDATION', `Puedes adjuntar hasta ${LIMITS.photos} imágenes por registro.`);
  return list.map((row) => ({
    storageId: row.storageId,
    thumbStorageId: row.thumbStorageId,
    name: cleanText(row.name, PHOTO_NAME_MAX, `El nombre de la imagen admite hasta ${PHOTO_NAME_MAX} caracteres.`) || 'imagen',
  }));
}

/**
 * Obligatorios: fecha, horas, proyecto, título de la actividad y resultado. Si falta alguno o las horas no son de
 * 0,25 a 24 en pasos de 0,25 (se acepta la coma) se responde con el mismo mensaje que usa hoy el sitio publicado.
 */
export function validateJournalFields(raw: RawJournalFields): ValidJournalFields {
  const hours = parseHours(raw.hours);
  const projectName = raw.projectName.trim();
  const activity = raw.activity.trim();
  const result = raw.result.trim();
  if (hours === null || !isValidDate(raw.date) || !projectName || !activity || !result) throw fail('VALIDATION', HOURS_MESSAGE);
  return {
    date: raw.date,
    hours,
    projectName: validateProjectName(projectName),
    activity: cleanText(activity, LIMITS.journalField),
    objective: optionalText(raw.objective),
    development: optionalText(raw.development),
    result: cleanText(result, LIMITS.journalField),
    observations: optionalText(raw.observations),
    activityStatus: raw.activityStatus,
    links: validateLinks(raw.links),
    photos: validatePhotos(raw.photos),
  };
}
