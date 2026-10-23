import { v } from 'convex/values';
import type { Doc } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
import type { QueryCtx } from './_generated/server';
import { requireWorkspaceOwner } from './lib/actors';
import { fail } from './lib/errors';
import { logEvent } from './lib/events';
import { newToken } from './lib/tokens';

const linkFor = (token: string) => `${(process.env.SITE_URL ?? '').replace(/\/$/, '')}/ver/${token}`;

async function loadSettings(ctx: QueryCtx, workspaceId?: Doc<'workspaces'>['_id']): Promise<Doc<'settings'>> {
  const settings = workspaceId
    ? await ctx.db.query('settings').withIndex('by_workspace', (q) => q.eq('workspaceId', workspaceId)).unique()
    : await ctx.db.query('settings').first();
  if (!settings) throw fail('NOT_FOUND', 'Falta la configuración inicial.');
  return settings;
}

/** Solo la dueña. El enlace se devuelve únicamente mientras está activo. */
export const get = query({
  args: { workspaceId: v.optional(v.id('workspaces')) },
  handler: async (ctx, { workspaceId }) => {
    const actor = await requireWorkspaceOwner(ctx, workspaceId);
    const settings = await loadSettings(ctx, actor.workspaceId);
    const out: { enabled: boolean; includesJournal: boolean; showsDescriptions: boolean; link?: string } = {
      enabled: settings.shareEnabled,
      includesJournal: settings.shareIncludesJournal,
      showsDescriptions: settings.shareShowsDescriptions,
    };
    if (settings.shareEnabled && settings.shareToken) out.link = linkFor(settings.shareToken);
    return out;
  },
});

/**
 * Activa o desactiva el enlace y fija sus dos opciones; solo cambia lo que se envía. Desactivarlo borra el token, así que
 * volver a activarlo crea un enlace distinto: el anterior no revive.
 */
export const setShare = mutation({
  args: { workspaceId: v.optional(v.id('workspaces')), enabled: v.optional(v.boolean()), includesJournal: v.optional(v.boolean()), showsDescriptions: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const actor = await requireWorkspaceOwner(ctx, args.workspaceId);
    const settings = await loadSettings(ctx, actor.workspaceId);
    const patch: Partial<Doc<'settings'>> = {};
    const detail: Record<string, boolean> = {};
    if (args.enabled !== undefined && args.enabled !== settings.shareEnabled) {
      patch.shareEnabled = args.enabled;
      patch.shareToken = args.enabled ? newToken() : undefined;
      detail.enabled = args.enabled;
    }
    if (args.includesJournal !== undefined && args.includesJournal !== settings.shareIncludesJournal) {
      patch.shareIncludesJournal = args.includesJournal;
      detail.includesJournal = args.includesJournal;
    }
    if (args.showsDescriptions !== undefined && args.showsDescriptions !== settings.shareShowsDescriptions) {
      patch.shareShowsDescriptions = args.showsDescriptions;
      detail.showsDescriptions = args.showsDescriptions;
    }
    if (Object.keys(detail).length === 0) return;
    await ctx.db.patch(settings._id, patch);
    await logEvent(ctx, actor, { type: 'share.changed', subjectKind: 'share', detail }, { workspaceId: actor.workspaceId });
  },
});

/** Crea un token nuevo (el anterior deja de funcionar al instante) y devuelve el enlace. Solo con el enlace activo. */
export const regenerateShare = mutation({
  args: { workspaceId: v.optional(v.id('workspaces')) },
  handler: async (ctx, { workspaceId }) => {
    const actor = await requireWorkspaceOwner(ctx, workspaceId);
    const settings = await loadSettings(ctx, actor.workspaceId);
    if (!settings.shareEnabled) throw fail('VALIDATION', 'Activa el enlace antes de regenerarlo.');
    const token = newToken();
    await ctx.db.patch(settings._id, { shareToken: token });
    await logEvent(ctx, actor, { type: 'share.changed', subjectKind: 'share', detail: { regenerated: true } }, { workspaceId: actor.workspaceId });
    return { link: linkFor(token) };
  },
});
