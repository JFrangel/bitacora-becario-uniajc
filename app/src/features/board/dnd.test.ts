import { describe, expect, it } from 'vitest';
import type { TaskDto } from '../../../convex/lib/audience';
import type { TaskStatus } from '../../../convex/lib/types';
import { applyMove, columnDropId, computeDrop, idsByColumn, moveAnnouncement } from './dnd';

const cols = (todo: string[] = [], doing: string[] = [], review: string[] = [], done: string[] = []): Record<TaskStatus, string[]> => ({ todo, doing, review, done });

describe('computeDrop', () => {
  const columns = cols(['a', 'b', 'c'], ['d', 'e'], [], ['f']);

  it('dropping on a card in another column puts the card just before it', () => {
    expect(computeDrop(columns, 'a', 'e')).toEqual({ status: 'doing', beforeId: 'e' });
    expect(computeDrop(columns, 'a', 'd')).toEqual({ status: 'doing', beforeId: 'd' });
  });

  it('dropping on an empty column, or on the column itself, appends to its end', () => {
    expect(computeDrop(columns, 'a', columnDropId('review'))).toEqual({ status: 'review' });
    expect(computeDrop(columns, 'a', columnDropId('doing'))).toEqual({ status: 'doing' });
  });

  it('inside the same column, moving up puts the card before the one it lands on', () => {
    expect(computeDrop(columns, 'c', 'a')).toEqual({ status: 'todo', beforeId: 'a' });
    expect(computeDrop(columns, 'c', 'b')).toEqual({ status: 'todo', beforeId: 'b' });
  });

  it('inside the same column, moving down puts the card after the one it lands on', () => {
    expect(computeDrop(columns, 'a', 'b')).toEqual({ status: 'todo', beforeId: 'c' });
    expect(computeDrop(columns, 'a', 'c')).toEqual({ status: 'todo' });
  });

  it('does nothing when dropped outside, on itself, or when the card is unknown', () => {
    expect(computeDrop(columns, 'a', null)).toBeNull();
    expect(computeDrop(columns, 'a', 'a')).toBeNull();
    expect(computeDrop(columns, 'zzz', 'b')).toBeNull();
    expect(computeDrop(columns, 'a', 'desconocida')).toBeNull();
  });

  it('dropping the last card on its own column changes nothing', () => {
    expect(computeDrop(cols(['a']), 'a', columnDropId('todo'))).toBeNull();
    expect(computeDrop(cols(['a', 'b']), 'a', columnDropId('todo'))).toEqual({ status: 'todo' });
  });
});

describe('idsByColumn', () => {
  it('groups the displayed tasks by column keeping their order', () => {
    const task = (id: string, status: TaskStatus) => ({ id, status }) as TaskDto;
    expect(idsByColumn([task('a', 'todo'), task('b', 'done'), task('c', 'todo')])).toEqual(cols(['a', 'c'], [], [], ['b']));
  });
});

describe('applyMove (optimistic update with the same rules as the server)', () => {
  const t = (id: string, status: TaskStatus, order: number, extra: Partial<TaskDto> = {}) => ({ id, status, order, title: id, ...extra }) as TaskDto;
  const base = [t('a', 'todo', 1), t('b', 'todo', 2), t('c', 'todo', 3), t('d', 'doing', 1)];
  const order = (tasks: TaskDto[], status: TaskStatus) => tasks.filter((x) => x.status === status).sort((x, y) => x.order - y.order).map((x) => x.id);

  it('puts the card before beforeId', () => {
    expect(order(applyMove(base, { id: 'c', status: 'todo', beforeId: 'b' }), 'todo')).toEqual(['a', 'c', 'b']);
    expect(order(applyMove(base, { id: 'c', status: 'doing', beforeId: 'd' }), 'doing')).toEqual(['c', 'd']);
  });

  it('puts it last when there is no beforeId, or beforeId is missing from the column', () => {
    expect(order(applyMove(base, { id: 'a', status: 'todo' }), 'todo')).toEqual(['b', 'c', 'a']);
    expect(order(applyMove(base, { id: 'a', status: 'doing', beforeId: 'b' }), 'doing')).toEqual(['d', 'a']);
  });

  it('sets completedAt on entering Completada and clears it on leaving, and leaves the rest untouched', () => {
    const done = applyMove(base, { id: 'a', status: 'done' });
    expect(done.find((x) => x.id === 'a')!.completedAt).toBeTypeOf('number');
    const back = applyMove([{ ...done.find((x) => x.id === 'a')! }], { id: 'a', status: 'doing' });
    expect('completedAt' in back[0]).toBe(false);
    expect(done.filter((x) => x.id !== 'a')).toEqual(base.filter((x) => x.id !== 'a'));
  });

  it('ignores a task that is not there', () => {
    expect(applyMove(base, { id: 'zzz', status: 'done' })).toBe(base);
  });
});

describe('moveAnnouncement', () => {
  it('speaks in Spanish', () => {
    expect(moveAnnouncement('Revisar convenio', 'doing')).toBe('Moviste «Revisar convenio» a «En curso».');
    expect(moveAnnouncement('Informe', 'done')).toBe('Moviste «Informe» a «Completada».');
  });
});
