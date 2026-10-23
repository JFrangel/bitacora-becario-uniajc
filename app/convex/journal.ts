import { v } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
import type { MutationCtx } from './_generated/server';
import { requireWorkspaceOwner } from './lib/actors';
import type { WorkspaceActor } from './lib/actors';
import { fail } from './lib/errors';
import { logEvent } from './lib/events';
import { validateJournalFields } from './lib/journalFields';
import type { PhotoInput, ValidJournalFields } from './lib/journalFields';
import { journalSummary, listJournal } from './lib/journalQueries';
import { ensureProject } from './lib/projects';
import { activityStatus, journalFieldsInput } from './lib/validators';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const entryNotFound = () => fail('NOT_FOUND', 'El registro ya no existe.');
const titleOf = (activity: string) => (activity.length > 120 ? `${activity.slice(0, 117)}…` : activity);

/** Comprueba que cada imagen nueva sea un archivo ya subido, de tipo imagen y de hasta 5 MB. Las que ya estaban no se vuelven a revisar. */
async function checkPhotos(ctx: MutationCtx, photos: PhotoInput[], already: Set<string>) {
  for (const photo of photos) {
    if (already.has(photo.storageId)) continue;
    const file = await ctx.db.system.get(photo.storageId);
    if (!file || !file.contentType?.startsWith('image/')) throw fail('VALIDATION', 'Se omitió un archivo que no es una imagen.');
    if (file.size > MAX_IMAGE_BYTES) throw fail('VALIDATION', `${photo.name} supera el límite de 5 MB.`);
    if (photo.thumbStorageId) {
      const thumb = await ctx.db.system.get(photo.thumbStorageId);
      if (!thumb || !thumb.contentType?.startsWith('image/')) throw fail('VALIDATION', 'Se omitió un archivo que no es una imagen.');
    }
  }
}

const storageIdsOf = (photos: Doc<'journalEntries'>['photos']) => photos.flatMap((p) => [p.storageId, p.thumbStorageId].filter((id): id is Id<'_storage'> => Boolean(id)));

/** Siguiente posición al final de un día. */
async function nextDayOrder(ctx: MutationCtx, date: string, workspaceId?: Id<'workspaces'>, except?: Id<'journalEntries'>) {
  const sameDay = await ctx.db.query('journalEntries').withIndex('by_date', (q) => q.eq('date', date)).collect();
  return sameDay.filter((e) => e.workspaceId === workspaceId && e._id !== except).reduce((max, e) => Math.max(max, e.dayOrder), 0) + 1;
}

/**
 * Aplica los campos validados a un registro existente. Devuelve los nombres de los campos que cambiaron (vacío si nada
 * cambió, y entonces no se escribe nada) y borra los archivos de las imágenes que ya no están.
 */
async function applyFields(ctx: MutationCtx, actor: WorkspaceActor, entry: Doc<'journalEntries'>, fields: ValidJournalFields, extra: Partial<Doc<'journalEntries'>> = {}): Promise<string[]> {
  const project = await ensureProject(ctx, actor, fields.projectName);
  const keep = new Map(entry.photos.map((p) => [p.storageId as string | undefined, p]));
  await checkPhotos(ctx, fields.photos, new Set(entry.photos.map((p) => p.storageId).filter((id): id is Id<'_storage'> => Boolean(id))));
  const photos = fields.photos.map((p) => keep.get(p.storageId) ?? p);

  const changed: string[] = [];
  const next: Partial<Doc<'journalEntries'>> = { ...extra };
  const set = <K extends keyof Doc<'journalEntries'>>(key: K, value: Doc<'journalEntries'>[K], same: boolean) => {
    if (same) return;
    next[key] = value;
    changed.push(key as string);
  };
  set('date', fields.date, entry.date === fields.date);
  set('hours', fields.hours, entry.hours === fields.hours);
  set('projectId', project._id, entry.projectId === project._id);
  set('activity', fields.activity, entry.activity === fields.activity);
  set('objective', fields.objective, entry.objective === fields.objective);
  set('development', fields.development, entry.development === fields.development);
  set('result', fields.result, entry.result === fields.result);
  set('observations', fields.observations, entry.observations === fields.observations);
  set('activityStatus', fields.activityStatus, entry.activityStatus === fields.activityStatus);
  set('links', fields.links, JSON.stringify(entry.links) === JSON.stringify(fields.links));
  set('photos', photos, JSON.stringify(entry.photos) === JSON.stringify(photos));

  if (changed.length === 0 && Object.keys(extra).length === 0) return [];
  if (next.date !== undefined) next.dayOrder = await nextDayOrder(ctx, fields.date, actor.workspaceId, entry._id);
  next.updatedAt = Date.now();
  await ctx.db.patch(entry._id, next);

  const kept = new Set(storageIdsOf(photos));
  for (const id of storageIdsOf(entry.photos)) if (!kept.has(id)) await ctx.storage.delete(id);
  return changed;
}

/** Un registro creado desde el formulario nace completo (no es borrador). */
export const createManual = mutation({
  args: { fields: journalFieldsInput, workspaceId: v.optional(v.id('workspaces')) },
  handler: async (ctx, { fields, workspaceId }): Promise<Id<'journalEntries'>> => {
    const actor = await requireWorkspaceOwner(ctx, workspaceId);
    const valid = validateJournalFields(fields);
    const project = await ensureProject(ctx, actor, valid.projectName);
    await checkPhotos(ctx, valid.photos, new Set());
    const now = Date.now();
    const id = await ctx.db.insert('journalEntries', {
      workspaceId: actor.workspaceId,
      date: valid.date,
      projectId: project._id,
      activity: valid.activity,
      objective: valid.objective,
      development: valid.development,
      result: valid.result,
      observations: valid.observations,
      hours: valid.hours,
      docStatus: 'complete',
      activityStatus: valid.activityStatus,
      links: valid.links,
      photos: valid.photos,
      dayOrder: await nextDayOrder(ctx, valid.date, actor.workspaceId),
      createdAt: now,
      updatedAt: now,
    });
    await logEvent(ctx, actor, { type: 'journal.documented', subjectKind: 'journal', subjectId: id, subjectTitle: titleOf(valid.activity), detail: { origin: 'manual' } }, { workspaceId: actor.workspaceId });
    return id;
  },
});

const MAX_RESTORE_BATCH = 50;

/**
 * «Restaurar copia»: agrega o actualiza registros completos identificados por su id original (`legacyId`), así que
 * restaurar la misma copia dos veces no duplica nada. Si un registro no es válido, no se guarda ninguno del lote.
 * Conserva el vínculo con la tarea de un registro que ya existía y las fechas de creación de la copia.
 */
export const restore = mutation({
  args: {
    workspaceId: v.optional(v.id('workspaces')),
    entries: v.array(v.object({ legacyId: v.string(), fields: journalFieldsInput, createdAt: v.optional(v.number()), updatedAt: v.optional(v.number()) })),
  },
  handler: async (ctx, { entries, workspaceId }) => {
    const actor = await requireWorkspaceOwner(ctx, workspaceId);
    if (entries.length > MAX_RESTORE_BATCH) throw fail('VALIDATION', `Se restauran ${MAX_RESTORE_BATCH} registros por vez.`);
    let created = 0;
    let updated = 0;
    for (const item of entries) {
      const valid = validateJournalFields(item.fields);
      const existing = (await ctx.db.query('journalEntries').withIndex('by_legacyId', (q) => q.eq('legacyId', item.legacyId)).collect()).find((entry) => entry.workspaceId === actor.workspaceId);
      if (existing) {
        await applyFields(ctx, actor, existing, valid, { docStatus: 'complete', ...(item.updatedAt ? { updatedAt: item.updatedAt } : {}) });
        updated += 1;
        continue;
      }
      const project = await ensureProject(ctx, actor, valid.projectName);
      await checkPhotos(ctx, valid.photos, new Set());
      const now = Date.now();
      await ctx.db.insert('journalEntries', {
          workspaceId: actor.workspaceId,
        legacyId: item.legacyId,
        date: valid.date,
        projectId: project._id,
        activity: valid.activity,
        objective: valid.objective,
        development: valid.development,
        result: valid.result,
        observations: valid.observations,
        hours: valid.hours,
        docStatus: 'complete',
        activityStatus: valid.activityStatus,
        links: valid.links,
        photos: valid.photos,
          dayOrder: await nextDayOrder(ctx, valid.date, actor.workspaceId),
        createdAt: item.createdAt ?? now,
        updatedAt: item.updatedAt ?? now,
      });
      created += 1;
    }
    return { created, updated };
  },
});

/** «Completar detalles»: el borrador pasa a completo y recién entonces suma horas. */
export const documentDraft = mutation({
  args: { id: v.id('journalEntries'), fields: journalFieldsInput, workspaceId: v.optional(v.id('workspaces')) },
  handler: async (ctx, { id, fields, workspaceId }) => {
    const actor = await requireWorkspaceOwner(ctx, workspaceId);
    const entry = await ctx.db.get(id);
    if (!entry || entry.workspaceId !== actor.workspaceId) throw entryNotFound();
    if (entry.docStatus !== 'draft') throw fail('VALIDATION', 'Este registro ya está completo.');
    const valid = validateJournalFields(fields);
    await applyFields(ctx, actor, entry, valid, { docStatus: 'complete' });
    await logEvent(ctx, actor, { type: 'journal.documented', subjectKind: 'journal', subjectId: id, subjectTitle: titleOf(valid.activity), detail: { origin: 'draft' } }, { workspaceId: actor.workspaceId });
  },
});

/** «Editar registro»: solo registros completos; los borradores se completan con `documentDraft`. */
export const update = mutation({
  args: { id: v.id('journalEntries'), fields: journalFieldsInput, workspaceId: v.optional(v.id('workspaces')) },
  handler: async (ctx, { id, fields, workspaceId }) => {
    const actor = await requireWorkspaceOwner(ctx, workspaceId);
    const entry = await ctx.db.get(id);
    if (!entry || entry.workspaceId !== actor.workspaceId) throw entryNotFound();
    if (entry.docStatus === 'draft') throw fail('VALIDATION', 'Este registro es un borrador: usa «Completar detalles».');
    const valid = validateJournalFields(fields);
    const changed = await applyFields(ctx, actor, entry, valid);
    if (changed.length === 0) return;
    await logEvent(ctx, actor, { type: 'journal.edited', subjectKind: 'journal', subjectId: id, subjectTitle: titleOf(valid.activity), detail: { fields: changed } }, { workspaceId: actor.workspaceId });
  },
});

/** Borra el registro y los archivos de sus imágenes. No vuelve a crear el borrador de su tarea. */
export const remove = mutation({
  args: { id: v.id('journalEntries'), workspaceId: v.optional(v.id('workspaces')) },
  handler: async (ctx, { id, workspaceId }) => {
    const actor = await requireWorkspaceOwner(ctx, workspaceId);
    const entry = await ctx.db.get(id);
    if (!entry || entry.workspaceId !== actor.workspaceId) throw entryNotFound();
    for (const storageId of storageIdsOf(entry.photos)) await ctx.storage.delete(storageId);
    await ctx.db.delete(id);
    await logEvent(ctx, actor, { type: 'journal.deleted', subjectKind: 'journal', subjectId: id, subjectTitle: titleOf(entry.activity) }, { workspaceId: actor.workspaceId });
  },
});

/** Reordena los registros de un día: `orderedIds` debe ser exactamente el conjunto de registros de esa fecha. */
export const reorder = mutation({
  args: { date: v.string(), orderedIds: v.array(v.id('journalEntries')), workspaceId: v.optional(v.id('workspaces')) },
  handler: async (ctx, { date, orderedIds, workspaceId }) => {
    const actor = await requireWorkspaceOwner(ctx, workspaceId);
    const sameDay = (await ctx.db.query('journalEntries').withIndex('by_date', (q) => q.eq('date', date)).collect()).filter((entry) => entry.workspaceId === actor.workspaceId);
    const ids = new Set<string>(orderedIds);
    if (ids.size !== orderedIds.length || ids.size !== sameDay.length || sameDay.some((e) => !ids.has(e._id))) {
      throw fail('VALIDATION', 'El orden del día cambió. Recarga e inténtalo de nuevo.');
    }
    const byId = new Map(sameDay.map((e) => [e._id as string, e]));
    for (const [index, id] of orderedIds.entries()) {
      if (byId.get(id)!.dayOrder !== index + 1) await ctx.db.patch(id, { dayOrder: index + 1 });
    }
  },
});

/** Fecha descendente; dentro del día, orden manual y luego última actualización (la más reciente primero). */
export const list = query({
  args: {
    workspaceId: v.optional(v.id('workspaces')),
    q: v.optional(v.string()),
    projectId: v.optional(v.id('projects')),
    activityStatus: v.optional(activityStatus),
    onlyDrafts: v.optional(v.boolean()),
  },
  handler: async (ctx, { workspaceId, ...filters }) => {
    const actor = await requireWorkspaceOwner(ctx, workspaceId);
    return listJournal(ctx, filters, {}, actor.workspaceId);
  },
});

/** Indicadores de la Bitácora: solo los registros completos cuentan y suman horas; los borradores se cuentan aparte. */
export const summary = query({
  args: { workspaceId: v.optional(v.id('workspaces')) },
  handler: async (ctx, { workspaceId }) => {
    const actor = await requireWorkspaceOwner(ctx, workspaceId);
    return journalSummary(ctx, actor.workspaceId);
  },
});
