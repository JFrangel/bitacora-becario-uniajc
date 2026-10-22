import { describe, expect, it } from 'vitest';
import type { TaskDto } from '../../../convex/lib/audience';
import { boardStats, filterTasks, splitCompleted, visibleCount } from './filters';

const day = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)), 17);

let seq = 0;
const task = (patch: Record<string, unknown> & { title: string }): TaskDto =>
  ({
    id: `t${++seq}`,
    projectId: 'p1',
    projectName: 'iMujer',
    projectColorSlot: 1,
    priority: 2,
    status: 'todo',
    order: seq,
    subtasks: [],
    ...patch,
  }) as unknown as TaskDto;

const TODAY = '2026-10-21';

describe('filterTasks', () => {
  const tasks = [
    task({ title: 'Análisis Jurídico revisión', projectId: 'p1', assigneeId: 'me', priority: 3, description: 'Contrato marco' }),
    task({ title: 'Landing', projectId: 'p2', assigneeId: 'ana', priority: 1 }),
    task({ title: 'Sin responsable', projectId: 'p2', priority: 2 }),
  ];

  it('returns everything when no filter is set (an empty filter means all)', () => {
    expect(filterTasks(tasks, {}, 'me')).toHaveLength(3);
    expect(filterTasks(tasks, { projectId: '', assigneeId: '', q: '   ' }, 'me')).toHaveLength(3);
  });

  it('filters by project, assignee and priority', () => {
    expect(filterTasks(tasks, { projectId: 'p2' }, 'me').map((t) => t.title)).toEqual(['Landing', 'Sin responsable']);
    expect(filterTasks(tasks, { assigneeId: 'ana' }, 'me').map((t) => t.title)).toEqual(['Landing']);
    expect(filterTasks(tasks, { priority: 3 }, 'me').map((t) => t.title)).toEqual(['Análisis Jurídico revisión']);
  });

  it('searches title and description ignoring accents and case, and needs every word', () => {
    expect(filterTasks(tasks, { q: 'analisis' }, 'me')).toHaveLength(1);
    expect(filterTasks(tasks, { q: 'JURÍDICO contrato' }, 'me')).toHaveLength(1);
    expect(filterTasks(tasks, { q: 'jurídico landing' }, 'me')).toHaveLength(0);
  });

  it('«Solo mías» keeps only the tasks assigned to the person looking', () => {
    expect(filterTasks(tasks, { onlyMine: true }, 'me').map((t) => t.title)).toEqual(['Análisis Jurídico revisión']);
    expect(filterTasks(tasks, { onlyMine: true }, null)).toHaveLength(3);
  });

  it('combines the filters', () => {
    expect(filterTasks(tasks, { projectId: 'p2', priority: 2, q: 'responsable' }, 'me').map((t) => t.title)).toEqual(['Sin responsable']);
    expect(filterTasks(tasks, { projectId: 'p1', priority: 1 }, 'me')).toHaveLength(0);
  });
});

describe('splitCompleted', () => {
  it('keeps the last 30 days as recent and the rest as older', () => {
    const done = [
      task({ title: 'hoy', status: 'done', completedAt: day('2026-10-21') }),
      task({ title: 'hace 30', status: 'done', completedAt: day('2026-09-21') }),
      task({ title: 'hace 31', status: 'done', completedAt: day('2026-09-20') }),
      task({ title: 'sin fecha', status: 'done' }),
    ];
    const { recent, older } = splitCompleted(done, TODAY);
    expect(recent.map((t) => t.title)).toEqual(['hoy', 'hace 30', 'sin fecha']);
    expect(older.map((t) => t.title)).toEqual(['hace 31']);
  });

  it('accepts another window', () => {
    const done = [task({ title: 'a', status: 'done', completedAt: day('2026-10-14') }), task({ title: 'b', status: 'done', completedAt: day('2026-10-13') })];
    expect(splitCompleted(done, TODAY, 7).older.map((t) => t.title)).toEqual(['b']);
  });
});

describe('visibleCount', () => {
  it('shows everything on a desktop, 5 on a phone, and everything again once expanded', () => {
    expect(visibleCount(false, false, 40)).toBe(40);
    expect(visibleCount(true, false, 40)).toBe(5);
    expect(visibleCount(true, true, 40)).toBe(40);
    expect(visibleCount(true, false, 3)).toBe(3);
  });
});

describe('boardStats', () => {
  const tasks = [
    task({ title: 'a', status: 'todo', dueDate: '2026-10-19' }),
    task({ title: 'b', status: 'doing', dueDate: '2026-10-28' }),
    task({ title: 'c', status: 'review', dueDate: '2026-10-29' }),
    task({ title: 'd', status: 'todo' }),
    task({ title: 'e', status: 'done', dueDate: '2026-10-20' }),
  ];

  it('counts the active ones and the ones due within 7 days or already late (never the completed)', () => {
    expect(boardStats(tasks, TODAY)).toEqual({ active: 4, dueThisWeek: 2 });
  });

  it('counts a task due exactly in 7 days but not in 8', () => {
    expect(boardStats([task({ title: 'x', dueDate: '2026-10-28' })], TODAY).dueThisWeek).toBe(1);
    expect(boardStats([task({ title: 'x', dueDate: '2026-10-29' })], TODAY).dueThisWeek).toBe(0);
  });
});
