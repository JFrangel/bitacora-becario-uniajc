import { describe, expect, it } from 'vitest';
import type { TaskDto } from '../../../convex/lib/audience';
import { buildMonthGrid, isoDay, shiftMonth, tasksOn, upcoming } from './month';

describe('buildMonthGrid', () => {
  it('October 2026 starts on a Thursday: 3 blanks, the 1st at index 3 and the 31st at index 33 of 35 cells', () => {
    const grid = buildMonthGrid(2026, 9);
    expect(grid).toHaveLength(35);
    expect(grid.slice(0, 4)).toEqual([null, null, null, '2026-10-01']);
    expect(grid[33]).toBe('2026-10-31');
    expect(grid[34]).toBeNull();
  });

  it('starts on Monday: a month whose 1st is a Monday has no leading blanks', () => {
    const grid = buildMonthGrid(2026, 5); // junio de 2026 empieza en lunes
    expect(grid[0]).toBe('2026-06-01');
    expect(grid).toHaveLength(35);
  });

  it('a month that starts on Sunday leaves six blanks and spans six weeks when needed', () => {
    const grid = buildMonthGrid(2026, 7); // agosto de 2026 empieza en sábado y tiene 31 días
    expect(grid.slice(0, 6)).toEqual([null, null, null, null, null, '2026-08-01']);
    expect(grid).toHaveLength(42);
    expect(grid.filter(Boolean)).toHaveLength(31);
  });

  it('knows leap years', () => {
    expect(buildMonthGrid(2028, 1).filter(Boolean)).toHaveLength(29);
    expect(buildMonthGrid(2026, 1).filter(Boolean)).toHaveLength(28);
  });

  it('always fills whole weeks', () => {
    for (let month = 0; month < 12; month += 1) expect(buildMonthGrid(2026, month).length % 7).toBe(0);
  });
});

describe('shiftMonth', () => {
  it('goes over the year boundaries in both directions', () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
    expect(shiftMonth(2026, 9, 1)).toEqual({ year: 2026, month: 10 });
  });
});

describe('isoDay', () => {
  it('pads month and day', () => {
    expect(isoDay(2026, 0, 5)).toBe('2026-01-05');
  });
});

const task = (id: string, patch: Partial<TaskDto> = {}): TaskDto => ({ id, title: id, status: 'todo', order: Number(id.slice(1)) || 0, ...patch }) as unknown as TaskDto;

describe('upcoming', () => {
  it('returns at most 6 open tasks with a date, overdue ones first, ordered by date', () => {
    const tasks = [
      task('t1', { dueDate: '2026-10-30' }),
      task('t2', { dueDate: '2026-10-19' }),
      task('t3', { dueDate: '2026-10-25', status: 'done' }),
      task('t4'),
      task('t5', { dueDate: '2026-10-22' }),
      task('t6', { dueDate: '2026-11-01' }),
      task('t7', { dueDate: '2026-11-02' }),
      task('t8', { dueDate: '2026-11-03' }),
      task('t9', { dueDate: '2026-11-04' }),
    ];
    expect(upcoming(tasks).map((t) => t.id)).toEqual(['t2', 't5', 't1', 't6', 't7', 't8']);
  });

  it('is empty when nothing has a date', () => {
    expect(upcoming([task('t1')])).toEqual([]);
  });
});

describe('tasksOn', () => {
  it('lists the tasks of one day', () => {
    const tasks = [task('t2', { dueDate: '2026-10-20' }), task('t1', { dueDate: '2026-10-20' }), task('t3', { dueDate: '2026-10-21' })];
    expect(tasksOn(tasks, '2026-10-20').map((t) => t.id)).toEqual(['t1', 't2']);
  });
});
