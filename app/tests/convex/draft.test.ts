import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../convex/_generated/api';
import { codeOf, newTest, setupMember, setupOwner } from './helpers';

afterEach(() => vi.useRealTimers());

/** Fija el reloj (solo `Date`) para que las funciones de Convex vean esa hora. */
const clockAt = (ms: number) => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(ms);
};

async function seed() {
  const t = newTest();
  const owner = await setupOwner(t);
  const ana = await setupMember(t);
  const entries = () => t.run((ctx) => ctx.db.query('journalEntries').collect());
  const events = async (type: string) => (await t.run((ctx) => ctx.db.query('events').collect())).filter((e) => e.type === type);
  const make = (args: Record<string, unknown> = {}) =>
    owner.client.mutation(api.tasks.create, { title: 'Redactar informe', projectName: 'iMujer', assigneeId: owner.memberId, ...args } as never);
  return { t, owner, ana, entries, events, make };
}

describe('single draft on completion (rules 1 to 6)', () => {
  it('creates one draft when the owner’s task is completed, with the exact fields and both events', async () => {
    const { t, owner, ana, entries, events, make } = await seed();
    clockAt(Date.UTC(2026, 10, 5, 15, 0));
    const id = await make({ description: 'Revisar el documento final' });
    await ana.client.mutation(api.tasks.move, { id, status: 'done' });
    const [entry] = await entries();
    expect(await entries()).toHaveLength(1);
    expect(entry).toMatchObject({
      taskId: id, taskTitleSnapshot: 'Redactar informe', date: '2026-11-05', activity: 'Redactar informe',
      objective: 'Revisar el documento final', docStatus: 'draft', activityStatus: 'Completada', links: [], photos: [],
    });
    expect(entry.hours).toBeUndefined();
    const task = await t.run((ctx) => ctx.db.get(id));
    expect(entry.projectId).toBe(task!.projectId);
    const completed = await events('task.completed');
    const drafted = await events('journal.draft_created');
    expect(completed).toHaveLength(1);
    expect(completed[0]).toMatchObject({ visibility: 'team', actorId: ana.memberId, subjectTitle: 'Redactar informe' });
    expect(drafted).toHaveLength(1);
    expect(drafted[0]).toMatchObject({ visibility: 'owner', subjectId: entry._id });
    expect(owner.memberId).toBeDefined();
  });

  it('leaves objective empty when the task has no description', async () => {
    const { entries, make, owner } = await seed();
    const id = await make();
    await owner.client.mutation(api.tasks.move, { id, status: 'done' });
    const [entry] = await entries();
    expect(entry.objective).toBeUndefined();
  });

  it('creates nothing for someone else’s task or an unassigned one, but still logs the completion', async () => {
    const { owner, ana, entries, events, make } = await seed();
    const others = await make({ assigneeId: ana.memberId });
    const nobody = await owner.client.mutation(api.tasks.create, { title: 'Sin responsable', projectName: 'iMujer' });
    await owner.client.mutation(api.tasks.move, { id: others, status: 'done' });
    await owner.client.mutation(api.tasks.move, { id: nobody, status: 'done' });
    expect(await entries()).toHaveLength(0);
    expect(await events('task.completed')).toHaveLength(2);
    expect(await events('journal.draft_created')).toHaveLength(0);
  });

  it('keeps a single record when reopened and completed again, without overwriting what was written', async () => {
    const { t, owner, entries, make } = await seed();
    const id = await make();
    await owner.client.mutation(api.tasks.move, { id, status: 'done' });
    const [entry] = await entries();
    await t.run((ctx) => ctx.db.patch(entry._id, { result: 'Escribí esto', hours: 2, docStatus: 'complete' }));
    await owner.client.mutation(api.tasks.move, { id, status: 'doing' });
    await owner.client.mutation(api.tasks.move, { id, status: 'done' });
    const after = await entries();
    expect(after).toHaveLength(1);
    expect(after[0]).toMatchObject({ _id: entry._id, result: 'Escribí esto', hours: 2, docStatus: 'complete' });
  });

  it('creates one draft even when two moves to done run at the same time', async () => {
    const { owner, ana, entries, make } = await seed();
    const id = await make();
    await Promise.all([owner.client.mutation(api.tasks.move, { id, status: 'done' }), ana.client.mutation(api.tasks.move, { id, status: 'done' })]);
    expect(await entries()).toHaveLength(1);
  });

  it('creates the draft when a completed task is reassigned to the owner, and not before', async () => {
    const { owner, ana, entries, make } = await seed();
    const id = await make({ assigneeId: ana.memberId });
    await owner.client.mutation(api.tasks.update, { id, patch: { assigneeId: owner.memberId } });
    expect(await entries()).toHaveLength(0);
    await owner.client.mutation(api.tasks.move, { id, status: 'done' });
    expect(await entries()).toHaveLength(1);

    const other = await make({ assigneeId: ana.memberId });
    await owner.client.mutation(api.tasks.move, { id: other, status: 'done' });
    expect(await entries()).toHaveLength(1);
    await ana.client.mutation(api.tasks.update, { id: other, patch: { assigneeId: owner.memberId } });
    expect(await entries()).toHaveLength(2);
  });

  it('creates the draft when a task is created directly in the Completada column for the owner', async () => {
    const { entries, make } = await seed();
    await make({ status: 'done' });
    expect(await entries()).toHaveLength(1);
  });

  it('uses the Bogotá day at 23:30 (UTC−5), not the UTC day (punto 3)', async () => {
    // El reloj de convex-test nunca retrocede respecto de la última escritura: se fija antes de crear nada.
    clockAt(Date.UTC(2026, 9, 22, 4, 30));
    const { owner, entries, make } = await seed();
    const id = await make();
    await owner.client.mutation(api.tasks.move, { id, status: 'done' });
    expect((await entries())[0].date).toBe('2026-10-21');
  });

  it('numbers drafts of the same day one after another', async () => {
    const { owner, entries, make } = await seed();
    for (const title of ['A', 'B', 'C']) {
      const id = await make({ title });
      await owner.client.mutation(api.tasks.move, { id, status: 'done' });
    }
    expect((await entries()).map((e) => e.dayOrder).sort()).toEqual([1, 2, 3]);
  });

  it('keeps the record when its task is deleted, with no taskId and the title as snapshot', async () => {
    const { t, owner, entries, make } = await seed();
    const id = await make({ title: 'Se borrará' });
    await owner.client.mutation(api.tasks.move, { id, status: 'done' });
    await owner.client.mutation(api.tasks.update, { id, patch: { title: 'Título final' } });
    await owner.client.mutation(api.tasks.remove, { id });
    const [entry] = await entries();
    expect(entry.taskId).toBeUndefined();
    expect(entry.taskTitleSnapshot).toBe('Título final');
    expect(await t.run((ctx) => ctx.db.get(id))).toBeNull();
  });

  it('does not bring the draft back when the record is deleted and the task is edited or moved inside Completada', async () => {
    const { t, owner, entries, make } = await seed();
    const id = await make();
    const other = await make({ title: 'Otra' });
    await owner.client.mutation(api.tasks.move, { id, status: 'done' });
    await owner.client.mutation(api.tasks.move, { id: other, status: 'done' });
    const [entry] = await entries();
    await t.run((ctx) => ctx.db.delete(entry._id));
    await owner.client.mutation(api.tasks.update, { id, patch: { title: 'Cambio', priority: 3 } });
    await owner.client.mutation(api.tasks.move, { id, status: 'done', beforeId: other });
    await owner.client.mutation(api.tasks.move, { id, status: 'done' });
    expect((await entries()).filter((e) => e.taskId === id)).toHaveLength(0);
  });
});

describe('tasks.move', () => {
  it('sets completedAt on entering Completada and clears it on leaving', async () => {
    const { t, owner, make } = await seed();
    const id = await make();
    await owner.client.mutation(api.tasks.move, { id, status: 'done' });
    expect((await t.run((ctx) => ctx.db.get(id)))!.completedAt).toBeTypeOf('number');
    await owner.client.mutation(api.tasks.move, { id, status: 'review' });
    expect((await t.run((ctx) => ctx.db.get(id)))!.completedAt).toBeUndefined();
  });

  it('logs task.moved with before and after, and nothing for a reorder inside the same column', async () => {
    const { owner, ana, events, make } = await seed();
    const a = await make({ title: 'A' });
    const b = await make({ title: 'B' });
    await ana.client.mutation(api.tasks.move, { id: a, status: 'doing' });
    await ana.client.mutation(api.tasks.move, { id: b, status: 'doing' });
    await ana.client.mutation(api.tasks.move, { id: b, status: 'doing', beforeId: a });
    const moved = await events('task.moved');
    expect(moved).toHaveLength(2);
    expect(moved[0].detail).toEqual({ from: 'todo', to: 'doing' });
    expect(moved[0]).toMatchObject({ actorId: ana.memberId, subjectTitle: 'A' });
    expect(owner.memberId).toBeDefined();
  });

  it('computes the position on the server: before a card, at the top, and at the end', async () => {
    const { owner, make } = await seed();
    const a = await make({ title: 'A' });
    const b = await make({ title: 'B' });
    const c = await make({ title: 'C' });
    const x = await make({ title: 'X' });
    const titles = async (status: 'todo' | 'doing') => (await owner.client.query(api.tasks.list, {})).filter((t) => t.status === status).map((t) => t.title);
    expect(await titles('todo')).toEqual(['X', 'C', 'B', 'A']);
    await owner.client.mutation(api.tasks.move, { id: x, status: 'todo', beforeId: b });
    expect(await titles('todo')).toEqual(['C', 'X', 'B', 'A']);
    await owner.client.mutation(api.tasks.move, { id: a, status: 'todo', beforeId: c });
    expect(await titles('todo')).toEqual(['A', 'C', 'X', 'B']);
    await owner.client.mutation(api.tasks.move, { id: a, status: 'doing' });
    await owner.client.mutation(api.tasks.move, { id: b, status: 'doing', beforeId: a });
    expect(await titles('doing')).toEqual(['B', 'A']);
    await owner.client.mutation(api.tasks.move, { id: c, status: 'doing' });
    expect(await titles('doing')).toEqual(['B', 'A', 'C']);
  });

  it('ignores a beforeId that does not exist or is in another column, and puts the card last', async () => {
    const { t, owner, make } = await seed();
    const a = await make({ title: 'A' });
    const b = await make({ title: 'B' });
    const gone = await make({ title: 'Gone' });
    await t.run((ctx) => ctx.db.delete(gone));
    await owner.client.mutation(api.tasks.move, { id: a, status: 'doing' });
    await owner.client.mutation(api.tasks.move, { id: b, status: 'doing', beforeId: gone });
    const doing = (await owner.client.query(api.tasks.list, {})).filter((x) => x.status === 'doing').map((x) => x.title);
    expect(doing).toEqual(['A', 'B']);
    await owner.client.mutation(api.tasks.move, { id: a, status: 'review', beforeId: b });
    expect((await owner.client.query(api.tasks.list, {})).filter((x) => x.status === 'review').map((x) => x.title)).toEqual(['A']);
  });

  it('keeps the card where it is when dropped on itself', async () => {
    const { owner, make } = await seed();
    const a = await make({ title: 'A' });
    await make({ title: 'B' });
    await owner.client.mutation(api.tasks.move, { id: a, status: 'todo', beforeId: a });
    expect((await owner.client.query(api.tasks.list, {})).map((x) => x.title)).toEqual(['B', 'A']);
  });

  it('reports TASK_NOT_FOUND when the task was deleted meanwhile (punto 1)', async () => {
    const { t, ana, make } = await seed();
    const id = await make();
    await t.run((ctx) => ctx.db.delete(id));
    const error = await ana.client.mutation(api.tasks.move, { id, status: 'done' }).catch((e) => e);
    expect(codeOf(error)).toBe('TASK_NOT_FOUND');
  });

  it('requires an account', async () => {
    const { t, make } = await seed();
    const id = await make();
    expect(codeOf(await t.mutation(api.tasks.move, { id, status: 'done' }).catch((e) => e))).toBe('UNAUTHENTICATED');
  });
});
