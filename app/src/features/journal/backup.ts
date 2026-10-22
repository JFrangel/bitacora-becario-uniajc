import { LIMITS } from '../../../convex/lib/limits';
import { parseHours } from '../../../convex/lib/hours';
import { isValidDate } from '../../../convex/lib/dates';
import type { ActivityStatus } from '../../../convex/lib/types';
import { MAX_IMAGE_BYTES } from './images';

const FORMAT = 'bitacora-iterativa';
const STATUSES: ActivityStatus[] = ['Completada', 'En progreso', 'Pendiente de revisión'];

/** Un registro como se escribe en la copia (versión 2). `project` es el nombre del proyecto. */
export type ExportEntry = {
  id: string;
  date: string;
  hours: number | null;
  project: string;
  activity: string;
  objective?: string;
  development?: string;
  result: string;
  observations?: string;
  status: ActivityStatus;
  docStatus: 'draft' | 'complete';
  taskTitle?: string;
  links: Array<{ label: string; url: string }>;
  photos: Array<{ name: string; dataUrl: string }>;
  createdAt?: number;
  updatedAt?: number;
};

/** Un registro de la copia ya revisado, listo para `journal.restore` (las imágenes aún sin subir). */
export type BackupEntry = {
  legacyId: string;
  date: string;
  hours: number;
  projectName: string;
  activity: string;
  objective?: string;
  development?: string;
  result: string;
  observations?: string;
  activityStatus: ActivityStatus;
  links: Array<{ label: string; url: string }>;
  photos: Array<{ name: string; dataUrl?: string; url?: string }>;
  createdAt?: number;
  updatedAt?: number;
};

export const INVALID_COPY = 'El archivo no es una copia válida de la bitácora.';
const INVALID_RECORD = 'La copia contiene un registro con datos inválidos.';

/** El contenido del archivo «Descargar copia»: formato `bitacora-iterativa`, versión 2 (con `docStatus` y el vínculo a la tarea). */
export function exportBackup(entries: ExportEntry[], exportedAt: Date = new Date()): string {
  return JSON.stringify({ format: FORMAT, version: 2, exportedAt: exportedAt.toISOString(), entries });
}

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const optional = (value: unknown) => text(value) || undefined;
const decodedBytes = (dataUrl: string) => {
  const payload = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
  return Math.floor((payload.length * 3) / 4) - padding;
};

function readPhotos(raw: unknown): BackupEntry['photos'] {
  const list = Array.isArray(raw) ? raw : [];
  if (list.length > LIMITS.photos) throw new Error(`Cada registro puede tener máximo ${LIMITS.photos} imágenes.`);
  return list.map((photo) => {
    const item = (photo ?? {}) as Record<string, unknown>;
    const name = text(item.name).slice(0, 120) || 'Imagen';
    if (typeof item.dataUrl === 'string') {
      if (!/^data:image\/[\w.+-]+;base64,/.test(item.dataUrl)) throw new Error('La copia contiene una imagen inválida.');
      if (decodedBytes(item.dataUrl) > MAX_IMAGE_BYTES) throw new Error('La copia contiene una imagen de más de 5 MB.');
      return { name, dataUrl: item.dataUrl };
    }
    if (typeof item.url === 'string' && /^https:\/\//.test(item.url)) return { name, url: item.url };
    throw new Error('La copia contiene una imagen inválida.');
  });
}

function readLinks(raw: unknown): BackupEntry['links'] {
  const list = Array.isArray(raw) ? raw : [];
  const links: BackupEntry['links'] = [];
  for (const link of list.slice(0, LIMITS.links)) {
    const item = (link ?? {}) as Record<string, unknown>;
    const url = text(item.url);
    if (!/^https?:\/\//i.test(url)) continue;
    links.push({ label: text(item.label).slice(0, 80) || new URL(url).hostname, url });
  }
  return links;
}

/**
 * Lee una copia de la bitácora: la del sitio publicado (versión 1) o la nueva (versión 2). Los borradores no se
 * restauran (no tienen horas ni resultado; se crean de nuevo al completar la tarea) y se cuentan aparte.
 */
export function parseBackup(json: string): { entries: BackupEntry[]; skippedDrafts: number } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error(INVALID_COPY);
  }
  const copy = parsed as { format?: unknown; version?: unknown; entries?: unknown } | null;
  if (!copy || typeof copy !== 'object' || copy.format !== FORMAT || (copy.version !== 1 && copy.version !== 2) || !Array.isArray(copy.entries)) throw new Error(INVALID_COPY);

  const entries: BackupEntry[] = [];
  let skippedDrafts = 0;
  for (const raw of copy.entries) {
    const e = (raw ?? {}) as Record<string, unknown>;
    if (e.docStatus === 'draft') {
      skippedDrafts += 1;
      continue;
    }
    const hours = typeof e.hours === 'number' ? parseHours(String(e.hours)) : null;
    const legacyId = text(e.id);
    const date = text(e.date);
    const projectName = text(e.project);
    const activity = text(e.activity);
    const result = text(e.result);
    const status = e.status as ActivityStatus;
    if (!legacyId || !isValidDate(date) || !projectName || !activity || !result || hours === null || !STATUSES.includes(status)) throw new Error(INVALID_RECORD);
    entries.push({
      legacyId,
      date,
      hours,
      projectName: projectName.slice(0, LIMITS.projectName),
      activity: activity.slice(0, LIMITS.journalField),
      objective: optional(e.objective),
      development: optional(e.development) ?? optional(e.nextStep),
      result: result.slice(0, LIMITS.journalField),
      observations: optional(e.observations) ?? optional(e.blocker),
      activityStatus: status,
      links: readLinks(e.links),
      photos: readPhotos(e.photos),
      createdAt: typeof e.createdAt === 'number' ? e.createdAt : undefined,
      updatedAt: typeof e.updatedAt === 'number' ? e.updatedAt : undefined,
    });
  }
  return { entries, skippedDrafts };
}
