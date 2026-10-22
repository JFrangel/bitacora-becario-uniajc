import type { Doc, Id } from '../_generated/dataModel';
import type { QueryCtx } from '../_generated/server';
import { journalDto } from './journalDto';
import type { JournalDto } from './journalDto';
import { normalizeSearch } from './text';
import type { ActivityStatus } from './types';

export type JournalFilters = { q?: string; projectId?: Id<'projects'>; activityStatus?: ActivityStatus; onlyDrafts?: boolean };

/** Fecha descendente; dentro del día, orden manual y luego última actualización (la más reciente primero). */
export async function listJournal(ctx: QueryCtx, filters: JournalFilters = {}, opts: { forViewer?: boolean } = {}): Promise<JournalDto[]> {
  const words = normalizeSearch(filters.q ?? '').split(' ').filter(Boolean);
  const entries = await ctx.db.query('journalEntries').withIndex('by_date').order('desc').collect();
  const visible = entries
    .filter((e) => {
      if (filters.projectId && e.projectId !== filters.projectId) return false;
      if (filters.activityStatus && e.activityStatus !== filters.activityStatus) return false;
      if (filters.onlyDrafts && e.docStatus !== 'draft') return false;
      if (words.length === 0) return true;
      const haystack = normalizeSearch([e.activity, e.objective, e.development, e.result, e.observations].filter(Boolean).join(' '));
      return words.every((word) => haystack.includes(word));
    })
    .sort((a, b) => (a.date === b.date ? a.dayOrder - b.dayOrder || b.updatedAt - a.updatedAt : a.date < b.date ? 1 : -1));
  const projects = new Map<Id<'projects'>, Doc<'projects'> | null>();
  return Promise.all(
    visible.map(async (entry) => {
      if (!projects.has(entry.projectId)) projects.set(entry.projectId, await ctx.db.get(entry.projectId));
      return journalDto(ctx, entry, projects.get(entry.projectId) ?? null, opts);
    }),
  );
}

/** Indicadores de la Bitácora: solo los registros completos cuentan y suman horas; los borradores se cuentan aparte. */
export async function journalSummary(ctx: QueryCtx): Promise<{ activities: number; hours: number; completed: number; drafts: number }> {
  const entries = await ctx.db.query('journalEntries').collect();
  const complete = entries.filter((e) => e.docStatus === 'complete');
  return {
    activities: complete.length,
    hours: complete.reduce((sum, e) => sum + (e.hours ?? 0), 0),
    completed: complete.filter((e) => e.activityStatus === 'Completada').length,
    drafts: entries.length - complete.length,
  };
}
