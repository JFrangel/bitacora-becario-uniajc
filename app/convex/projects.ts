import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { resolveWorkspaceActor } from './lib/actors';
import { ensureProject, listProjects } from './lib/projects';
import { validateProjectName } from './lib/validate';

/** Crea el proyecto o devuelve el que ya existe con ese nombre (sin distinguir mayúsculas ni tildes). */
export const create = mutation({
  args: { name: v.string(), workspaceId: v.optional(v.id('workspaces')) },
  handler: async (ctx, { name, workspaceId }) => {
    const actor = await resolveWorkspaceActor(ctx, workspaceId);
    return (await ensureProject(ctx, actor, validateProjectName(name)))._id;
  },
});

export const list = query({
  args: { workspaceId: v.optional(v.id('workspaces')) },
  handler: async (ctx, { workspaceId }) => {
    const actor = await resolveWorkspaceActor(ctx, workspaceId);
    return listProjects(ctx, actor.workspaceId);
  },
});
