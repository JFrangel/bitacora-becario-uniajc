// Migración desde la hoja de Google de la bitácora publicada. Este archivo no importa nada: lo usan el servidor
// (`convex/legacyImport.ts`) y el script `scripts/migrate-legacy.ts`, que Node ejecuta directamente.

/** Un registro tal como lo devuelve el punto de lectura JSONP de Apps Script (`requestRemoteEntries` en `/app.js`). */
export type LegacyEntry = {
  id?: unknown;
  date?: unknown;
  hours?: unknown;
  project?: unknown;
  activity?: unknown;
  objective?: unknown;
  nextStep?: unknown;
  result?: unknown;
  blocker?: unknown;
  status?: unknown;
  order?: unknown;
  links?: unknown;
  photos?: unknown;
  recordedAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type ActivityStatus = 'Completada' | 'En progreso' | 'Pendiente de revisión';

/** Una imagen: del Drive de origen (`url`) o, ya copiada, en el almacenamiento de Convex (`storageId`, `thumbStorageId`). */
export type LegacyPhoto = { name: string; url?: string; storageId?: string; thumbStorageId?: string };

/** El registro listo para insertar en `journalEntries` (con el nombre del proyecto en lugar de su id). */
export type JournalInsert = {
  legacyId: string;
  date: string;
  hours: number;
  projectName: string;
  activity: string;
  objective?: string;
  development?: string;
  result?: string;
  observations?: string;
  activityStatus: ActivityStatus;
  docStatus: 'complete';
  dayOrder: number;
  links: { label: string; url: string }[];
  photos: LegacyPhoto[];
  createdAt: number;
  updatedAt: number;
};

/** Un registro que no se puede migrar, con el motivo para el informe. */
export class LegacyEntryError extends Error {}

const STATUSES: ActivityStatus[] = ['Completada', 'En progreso', 'Pendiente de revisión'];
const TEXT_MAX = 1500;
const PROJECT_MAX = 100;
const LINK_LABEL_MAX = 80;
const PHOTO_NAME_MAX = 120;
const MAX_LINKS = 12;
const MAX_PHOTOS = 4;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const text = (value: unknown, max: number) => String(value ?? '').trim().slice(0, max);
/** Texto opcional: vacío significa «sin valor». */
const optional = (value: unknown) => text(value, TEXT_MAX) || undefined;

/** El hueco del JSON que viene como texto (`links`, `photos`) se lee igual que lo hace el sitio publicado. */
function list(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  try {
    const parsed: unknown = JSON.parse(String(value || '[]'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Mediodía en Bogotá (UTC−5) de la fecha del registro: la hora de respaldo si el origen no trae cuándo se creó. */
const noonOf = (date: string) => Date.parse(`${date}T12:00:00-05:00`);

/**
 * El mapeo del plan: `nextStep` → `development`, `blocker` → `observations`, `order` → `dayOrder`, `status` →
 * `activityStatus`, `id` → `legacyId`, y todo queda como registro completo. Lanza `LegacyEntryError` si no se puede migrar.
 */
export function mapLegacyEntry(entry: LegacyEntry): JournalInsert {
  const legacyId = String(entry.id ?? '').trim();
  if (!legacyId) throw new LegacyEntryError('El registro no tiene id.');
  const date = String(entry.date ?? '').trim();
  if (!DATE.test(date)) throw new LegacyEntryError(`El registro ${legacyId} tiene una fecha inválida («${date}»).`);

  const createdAt = Number(entry.createdAt) || Date.parse(String(entry.recordedAt ?? '')) || noonOf(date);
  const order = Number(entry.order);
  const status = String(entry.status ?? '') as ActivityStatus;

  return {
    legacyId,
    date,
    hours: Number(String(entry.hours ?? '').replace(',', '.')),
    projectName: text(String(entry.project ?? '').replace(/\s+/g, ' '), PROJECT_MAX),
    activity: text(entry.activity, TEXT_MAX),
    objective: optional(entry.objective),
    development: optional(entry.nextStep),
    result: optional(entry.result),
    observations: optional(entry.blocker),
    activityStatus: STATUSES.includes(status) ? status : 'Completada',
    docStatus: 'complete',
    dayOrder: Number.isFinite(order) && order > 0 ? order : 1,
    links: list(entry.links)
      .map((link) => link as { label?: unknown; url?: unknown })
      .filter((link) => text(link?.url, 2000))
      .slice(0, MAX_LINKS)
      .map((link) => ({ label: text(link.label, LINK_LABEL_MAX) || 'Enlace', url: text(link.url, 2000) })),
    photos: list(entry.photos)
      .map((photo) => photo as { url?: unknown; name?: unknown })
      .filter((photo) => text(photo?.url, 2000))
      .slice(0, MAX_PHOTOS)
      .map((photo) => ({ name: text(photo.name, PHOTO_NAME_MAX) || 'Imagen', url: text(photo.url, 2000) })),
    createdAt,
    updatedAt: Number(entry.updatedAt) || Date.parse(String(entry.recordedAt ?? '')) || createdAt,
  };
}

/** Lee la respuesta JSONP (`cb_x({...});`) del punto de lectura. */
export function parseJsonp(body: string): { entries: LegacyEntry[] } {
  const open = body.indexOf('(');
  const close = body.lastIndexOf(')');
  const json = open >= 0 && close > open ? body.slice(open + 1, close) : body;
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('La respuesta de la hoja compartida no es JSON.');
  }
  const entries = (data as { entries?: unknown } | null)?.entries;
  if (!Array.isArray(entries)) throw new Error('No se pudo leer la hoja compartida.');
  return { entries: entries as LegacyEntry[] };
}

export type LegacySummary = { count: number; hours: number; completed: number; firstDate?: string; lastDate?: string; projects: string[] };

/** Cifras para comparar el origen con lo importado: registros, horas totales, completadas, rango de fechas y proyectos. */
export function summarize(entries: Array<Pick<JournalInsert, 'hours' | 'activityStatus' | 'date' | 'projectName'>>): LegacySummary {
  const dates = entries.map((entry) => entry.date).sort();
  return {
    count: entries.length,
    hours: entries.reduce((sum, entry) => sum + (Number.isFinite(entry.hours) ? entry.hours : 0), 0),
    completed: entries.filter((entry) => entry.activityStatus === 'Completada').length,
    firstDate: dates[0],
    lastDate: dates[dates.length - 1],
    projects: [...new Set(entries.map((entry) => entry.projectName))].sort((a, b) => a.localeCompare(b, 'es')),
  };
}
