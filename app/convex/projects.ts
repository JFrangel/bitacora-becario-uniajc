import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { requireMember } from './lib/actors';
import { ensureProject, listProjects } from './lib/projects';
import { validateProjectName } from './lib/validate';

/** Crea el proyecto o devuelve el que ya existe con ese nombre (sin distinguir mayúsculas ni tildes). */
export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const actor = await requireMember(ctx);
    return (await ensureProject(ctx, actor, validateProjectName(name)))._id;
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireMember(ctx);
    return listProjects(ctx);
  },
});
