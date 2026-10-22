import type { QueryCtx } from '../_generated/server';
import { loadTaskDtos } from './audience';
import type { TaskDto, View } from './audience';
import { monthRange } from './dates';
import { fail } from './errors';

export type MonthData = { tasks: TaskDto[]; hoursByDay?: Record<string, number> };

/**
 * Tareas con fecha límite dentro del mes (`month` de 0 a 11; las que no tienen fecha no aparecen) y, solo para quien ve la
 * Bitácora, las horas de los registros **completos** por día. Los borradores no suman.
 */
export async function monthData(ctx: QueryCtx, view: View, year: number, month: number): Promise<MonthData> {
  if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(month) || month < 0 || month > 11) {
    throw fail('VALIDATION', 'El mes no es válido.');
  }
  const { from, to } = monthRange(year, month);
  const tasks = await ctx.db.query('tasks').withIndex('by_due', (q) => q.gte('dueDate', from).lte('dueDate', to)).collect();
  const data: MonthData = { tasks: await loadTaskDtos(ctx, tasks, view) };
  if (view.showJournal) {
    const entries = await ctx.db.query('journalEntries').withIndex('by_date', (q) => q.gte('date', from).lte('date', to)).collect();
    const hoursByDay: Record<string, number> = {};
    for (const entry of entries) {
      if (entry.docStatus === 'complete' && entry.hours !== undefined) hoursByDay[entry.date] = (hoursByDay[entry.date] ?? 0) + entry.hours;
    }
    data.hoursByDay = hoursByDay;
  }
  return data;
}
