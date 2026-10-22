import { v } from 'convex/values';

export const taskStatus = v.union(v.literal('todo'), v.literal('doing'), v.literal('review'), v.literal('done'));
export const activityStatus = v.union(v.literal('Completada'), v.literal('En progreso'), v.literal('Pendiente de revisión'));
export const docStatus = v.union(v.literal('draft'), v.literal('complete'));
export const eventVisibility = v.union(v.literal('team'), v.literal('owner'));

export const eventType = v.union(
  v.literal('task.created'),
  v.literal('task.edited'),
  v.literal('task.moved'),
  v.literal('task.completed'),
  v.literal('task.deleted'),
  v.literal('project.created'),
  v.literal('invite.created'),
  v.literal('member.joined'),
  v.literal('member.updated'),
  v.literal('member.revoked'),
  v.literal('share.changed'),
  v.literal('journal.draft_created'),
  v.literal('journal.documented'),
  v.literal('journal.edited'),
  v.literal('journal.deleted'),
);

export const subtask = v.object({ id: v.string(), text: v.string(), done: v.boolean() });
/** Subtarea tal como la envía el cliente: sin `id` (se crea) y sin `done` (por defecto falso). */
export const subtaskInput = v.object({ id: v.optional(v.string()), text: v.string(), done: v.optional(v.boolean()) });
export const journalLink = v.object({ label: v.string(), url: v.string() });
export const journalPhoto = v.object({
  storageId: v.optional(v.id('_storage')),
  thumbStorageId: v.optional(v.id('_storage')),
  name: v.string(),
  url: v.optional(v.string()),
});

/** Enlace tal como lo envía el formulario: el nombre es opcional (si falta se usa el dominio). */
export const journalLinkInput = v.object({ label: v.optional(v.string()), url: v.string() });
/** Imagen ya subida con `files.generateUploadUrl`: el archivo completo, su miniatura y el nombre original. */
export const journalPhotoInput = v.object({ storageId: v.id('_storage'), thumbStorageId: v.optional(v.id('_storage')), name: v.string() });
/** Campos del formulario «Registrar actividad» (las horas llegan como texto: acepta coma decimal). */
export const journalFieldsInput = v.object({
  date: v.string(),
  hours: v.string(),
  projectName: v.string(),
  activity: v.string(),
  objective: v.optional(v.string()),
  development: v.optional(v.string()),
  result: v.string(),
  observations: v.optional(v.string()),
  activityStatus,
  links: v.optional(v.array(journalLinkInput)),
  photos: v.optional(v.array(journalPhotoInput)),
});
