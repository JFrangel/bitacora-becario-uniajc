import { v } from 'convex/values';
import type { Doc } from './_generated/dataModel';
import { internalMutation, internalQuery } from './_generated/server';
import type { Actor } from './lib/actors';
import { fail } from './lib/errors';
import { validateJournalFields } from './lib/journalFields';
import { LIMITS } from './lib/limits';
import { ensureProject } from './lib/projects';
import { activityStatus, journalLink, journalPhoto } from './lib/validators';

/**
 * Migración desde la hoja de Google (Tarea C3). Son funciones **internas**: solo se llaman desde `scripts/migrate-legacy.ts`
 * con la clave de despliegue (`npx convex run legacyImport:…`), nunca desde el navegador. No se ejecutan hasta el corte.
 */

/** El registro ya mapeado por `mapLegacyEntry` (`convex/lib/legacy.ts`). */
const legacyInsert = v.object({
  legacyId: v.string(),
  date: v.string(),
  hours: v.number(),
  projectName: v.string(),
  activity: v.string(),
  objective: v.optional(v.string()),
  development: v.optional(v.string()),
  result: v.optional(v.string()),
  observations: v.optional(v.string()),
  activityStatus,
  docStatus: v.literal('complete'),
  dayOrder: v.number(),
  links: v.array(journalLink),
  photos: v.array(journalPhoto),
  createdAt: v.number(),
  updatedAt: v.number(),
});

const normalizeEmail = (email: string | undefined) => (email ?? '').trim().toLowerCase();

/**
 * La Bitácora migrada es **de la dueña y de nadie más**: la dueña ya debe haber entrado una vez con Google (así existe su
 * registro) y su correo debe ser exactamente el que se indica en la migración (y, si está definido, `OWNER_EMAIL` del
 * despliegue). Si no coincide, no se importa nada: así los datos nunca quedan enlazados a otra cuenta por error.
 */
async function ownerActor(ctx: { db: { query: (table: 'members') => { collect: () => Promise<Doc<'members'>[]> } } }, ownerEmail: string): Promise<Actor> {
  const owner = (await ctx.db.query('members').collect()).find((member) => member.isOwner);
  if (!owner) throw fail('NOT_FOUND', 'Primero la dueña debe entrar una vez con Google: así se crea su cuenta.');
  const wanted = normalizeEmail(ownerEmail);
  const configured = normalizeEmail(process.env.OWNER_EMAIL);
  if (!wanted || normalizeEmail(owner.email) !== wanted || (configured && configured !== wanted)) {
    throw fail('FORBIDDEN', 'El correo de la dueña de este despliegue no coincide con el que indicaste: no se importó nada.');
  }
  return { memberId: owner._id, isOwner: true, name: owner.name, roleLabel: owner.roleLabel };
}

/** Una dirección de subida del almacenamiento de Convex, para copiar las imágenes de Drive. */
export const uploadUrl = internalMutation({
  args: {},
  handler: async (ctx) => ctx.storage.generateUploadUrl(),
});

/**
 * Agrega o actualiza registros completos por su `legacyId`: importar dos veces deja las mismas filas. Los proyectos se
 * normalizan en `projects` (sin distinguir mayúsculas, tildes ni espacios repetidos) y no dejan huella en el historial.
 * Valida con las mismas reglas del formulario; si un registro no es válido no se guarda ninguno del lote.
 */
export const upsertBatch = internalMutation({
  args: { ownerEmail: v.string(), entries: v.array(legacyInsert) },
  handler: async (ctx, { ownerEmail, entries }) => {
    const actor = await ownerActor(ctx, ownerEmail);
    let created = 0;
    let updated = 0;
    for (const item of entries) {
      let valid;
      try {
        valid = validateJournalFields({
          date: item.date,
          hours: String(item.hours),
          projectName: item.projectName,
          activity: item.activity,
          objective: item.objective,
          development: item.development,
          result: item.result ?? '',
          observations: item.observations,
          activityStatus: item.activityStatus,
          links: item.links,
          photos: [],
        });
      } catch (error) {
        const message = (error as { data?: { message?: string } }).data?.message ?? (error as Error).message;
        throw fail('VALIDATION', `Registro ${item.legacyId}: ${message}`);
      }
      if (item.photos.length > LIMITS.photos) throw fail('VALIDATION', `Registro ${item.legacyId}: tiene más de ${LIMITS.photos} imágenes.`);

      const project = await ensureProject(ctx, actor, valid.projectName, { silent: true });
      const fields = {
        date: valid.date,
        projectId: project._id,
        activity: valid.activity,
        objective: valid.objective,
        development: valid.development,
        result: valid.result,
        observations: valid.observations,
        hours: valid.hours,
        docStatus: 'complete' as const,
        activityStatus: valid.activityStatus,
        links: valid.links,
        photos: item.photos,
        dayOrder: item.dayOrder,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
      const existing = await ctx.db.query('journalEntries').withIndex('by_legacyId', (q) => q.eq('legacyId', item.legacyId)).first();
      if (existing) {
        await ctx.db.patch(existing._id, fields);
        updated += 1;
      } else {
        await ctx.db.insert('journalEntries', { legacyId: item.legacyId, ...fields });
        created += 1;
      }
    }
    return { created, updated };
  },
});

/** Las cifras de lo importado, para compararlas con las del origen en el informe del script. */
export const report = internalQuery({
  args: {},
  handler: async (ctx) => {
    const imported = (await ctx.db.query('journalEntries').collect()).filter((entry) => entry.legacyId !== undefined);
    const dates = imported.map((entry) => entry.date).sort();
    const projects = new Map((await ctx.db.query('projects').collect()).map((project) => [project._id, project.name]));
    return {
      count: imported.length,
      hours: imported.reduce((sum, entry) => sum + (entry.hours ?? 0), 0),
      completed: imported.filter((entry) => entry.activityStatus === 'Completada').length,
      firstDate: dates[0],
      lastDate: dates[dates.length - 1],
      projects: [...new Set(imported.map((entry) => projects.get(entry.projectId) ?? ''))].sort((a, b) => a.localeCompare(b, 'es')),
      photosInStorage: imported.reduce((sum, entry) => sum + entry.photos.filter((photo) => photo.storageId).length, 0),
      photosStillOnDrive: imported.reduce((sum, entry) => sum + entry.photos.filter((photo) => !photo.storageId).length, 0),
    };
  },
});
