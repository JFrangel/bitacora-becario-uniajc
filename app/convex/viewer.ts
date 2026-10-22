import { v } from 'convex/values';
import { query } from './_generated/server';
import { requireViewer } from './lib/actors';
import { viewerView } from './lib/audience';
import { monthData } from './lib/calendar';
import { fail } from './lib/errors';
import { pageEvents } from './lib/eventPages';
import { journalSummary, listJournal } from './lib/journalQueries';
import { ownerBadge } from './lib/profile';
import { listProjects } from './lib/projects';
import { listTasks } from './lib/taskQueries';
import { activityStatus } from './lib/validators';

/**
 * Funciones del enlace de solo lectura. Todas exigen el token del enlace activo (si no, FORBIDDEN «Este enlace ya no
 * está activo») y nunca reciben una sesión: lo que devuelven depende solo de las dos opciones que fijó la dueña.
 */

/** Qué puede mostrar la página: sirve para ocultar la pestaña Bitácora y para detectar un enlace inactivo. */
export const access = query({
  args: { shareToken: v.string() },
  handler: async (ctx, { shareToken }) => {
    const settings = await requireViewer(ctx, shareToken);
    return { includesJournal: settings.shareIncludesJournal, showsDescriptions: settings.shareShowsDescriptions };
  },
});

export const board = query({
  args: { shareToken: v.string() },
  handler: async (ctx, { shareToken }) => {
    const view = await viewerView(ctx, shareToken);
    const board = { tasks: await listTasks(ctx, view), projects: await listProjects(ctx) };
    // Los indicadores de horas y borradores solo viajan si el enlace incluye la Bitácora.
    return view.showJournal ? { ...board, summary: await journalSummary(ctx) } : board;
  },
});

export const calendar = query({
  args: { shareToken: v.string(), year: v.number(), month: v.number() },
  handler: async (ctx, { shareToken, year, month }) => monthData(ctx, await viewerView(ctx, shareToken), year, month),
});

/** La Bitácora con sus indicadores, sin identificadores de almacenamiento. Solo si el enlace la incluye. */
export const journal = query({
  args: {
    shareToken: v.string(),
    q: v.optional(v.string()),
    projectId: v.optional(v.id('projects')),
    activityStatus: v.optional(activityStatus),
    onlyDrafts: v.optional(v.boolean()),
  },
  handler: async (ctx, { shareToken, ...filters }) => {
    const view = await viewerView(ctx, shareToken);
    if (!view.showJournal) throw fail('FORBIDDEN', 'Este enlace no incluye la Bitácora.');
    return { entries: await listJournal(ctx, filters, { forViewer: true }), summary: await journalSummary(ctx) };
  },
});

/** El carné de la dueña: siempre sus datos actuales (la página redibuja el carné cuando cambia `updatedAt`). */
export const profile = query({
  args: { shareToken: v.string() },
  handler: async (ctx, { shareToken }) => {
    await requireViewer(ctx, shareToken);
    return ownerBadge(ctx);
  },
});

export const events = query({
  args: { shareToken: v.string(), cursor: v.optional(v.union(v.string(), v.null())), actorId: v.optional(v.id('members')), subjectId: v.optional(v.string()) },
  handler: async (ctx, { shareToken, cursor, actorId, subjectId }) => {
    const view = await viewerView(ctx, shareToken);
    return pageEvents(ctx, { withOwnerEvents: view.showJournal, cursor, actorId, subjectId });
  },
});
