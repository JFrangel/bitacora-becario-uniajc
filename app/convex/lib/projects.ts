import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';
import type { Actor } from './actors';
import { logEvent } from './events';
import { normalizeSearch } from './text';

const COLOR_SLOTS = 6;

/**
 * Devuelve el proyecto con ese nombre (sin distinguir mayúsculas, tildes ni espacios repetidos) o lo crea
 * con el siguiente color de la rotación 1 a 6. `name` debe venir ya validado por `validateProjectName`.
 * Con `silent` no deja huella en el historial (la migración desde la hoja de Google crea proyectos sin avisar a nadie).
 */
export async function ensureProject(ctx: MutationCtx, actor: Actor, name: string, options: { silent?: boolean } = {}): Promise<Doc<'projects'>> {
  const nameLower = normalizeSearch(name);
  const existing = await ctx.db.query('projects').withIndex('by_nameLower', (q) => q.eq('nameLower', nameLower)).first();
  if (existing) return existing;
  const count = (await ctx.db.query('projects').collect()).length;
  const id: Id<'projects'> = await ctx.db.insert('projects', { name, nameLower, colorSlot: (count % COLOR_SLOTS) + 1 });
  if (!options.silent) await logEvent(ctx, actor, { type: 'project.created', subjectKind: 'project', subjectId: id, subjectTitle: name });
  return (await ctx.db.get(id))!;
}

/** Proyectos por nombre, para el selector y los filtros. */
export async function listProjects(ctx: QueryCtx): Promise<{ id: Id<'projects'>; name: string; colorSlot: number }[]> {
  const projects = await ctx.db.query('projects').collect();
  return projects.sort((a, b) => a.name.localeCompare(b.name, 'es')).map((p) => ({ id: p._id, name: p.name, colorSlot: p.colorSlot }));
}
