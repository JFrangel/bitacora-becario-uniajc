import type { Doc, Id } from '../_generated/dataModel';
import type { QueryCtx } from '../_generated/server';
import type { ActivityStatus, DocStatus } from './types';

export type JournalPhotoDto = {
  storageId?: Id<'_storage'>;
  thumbStorageId?: Id<'_storage'>;
  name: string;
  url?: string;
  thumbUrl?: string;
};

export type JournalDto = {
  id: Id<'journalEntries'>;
  date: string;
  projectId: Id<'projects'>;
  projectName: string;
  projectColorSlot: number;
  activity: string;
  objective?: string;
  development?: string;
  result?: string;
  observations?: string;
  hours?: number;
  docStatus: DocStatus;
  isDraft: boolean;
  activityStatus: ActivityStatus;
  links: { label: string; url: string }[];
  photos: JournalPhotoDto[];
  taskId?: Id<'tasks'>;
  taskTitle?: string;
  /** La tarea de la que nació este registro ya no existe (se conserva el título). */
  taskDeleted?: true;
  dayOrder: number;
  createdAt: number;
  updatedAt: number;
};

/**
 * Registro de la Bitácora. Las claves opcionales sin valor se omiten (no se envían como `undefined`).
 * Para el enlace de solo lectura (`forViewer`) las imágenes llevan solo su dirección: sin los identificadores de almacenamiento.
 */
export async function journalDto(
  ctx: QueryCtx,
  entry: Doc<'journalEntries'>,
  project: Doc<'projects'> | null,
  opts: { forViewer?: boolean } = {},
): Promise<JournalDto> {
  const photos: JournalPhotoDto[] = [];
  for (const photo of entry.photos) {
    const dto: JournalPhotoDto = { name: photo.name };
    if (!opts.forViewer) {
      if (photo.storageId) dto.storageId = photo.storageId;
      if (photo.thumbStorageId) dto.thumbStorageId = photo.thumbStorageId;
    }
    const url = photo.storageId ? await ctx.storage.getUrl(photo.storageId) : (photo.url ?? null);
    const thumbUrl = photo.thumbStorageId ? await ctx.storage.getUrl(photo.thumbStorageId) : null;
    if (url) dto.url = url;
    if (thumbUrl) dto.thumbUrl = thumbUrl;
    photos.push(dto);
  }
  const dto: JournalDto = {
    id: entry._id,
    date: entry.date,
    projectId: entry.projectId,
    projectName: project?.name ?? 'Sin proyecto',
    projectColorSlot: project?.colorSlot ?? 1,
    activity: entry.activity,
    docStatus: entry.docStatus,
    isDraft: entry.docStatus === 'draft',
    activityStatus: entry.activityStatus,
    links: entry.links,
    photos,
    dayOrder: entry.dayOrder,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
  if (entry.objective !== undefined) dto.objective = entry.objective;
  if (entry.development !== undefined) dto.development = entry.development;
  if (entry.result !== undefined) dto.result = entry.result;
  if (entry.observations !== undefined) dto.observations = entry.observations;
  if (entry.hours !== undefined) dto.hours = entry.hours;
  if (entry.taskId !== undefined) dto.taskId = entry.taskId;
  if (entry.taskTitleSnapshot !== undefined) dto.taskTitle = entry.taskTitleSnapshot;
  if (entry.taskId === undefined && entry.taskTitleSnapshot !== undefined) dto.taskDeleted = true;
  return dto;
}
