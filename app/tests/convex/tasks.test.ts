import { describe, expect, it } from 'vitest';
import { api } from '../../convex/_generated/api';
import { codeOf, newTest, setupMember, setupOwner } from './helpers';

const messageOf = (e: unknown) => (e as { data?: { message?: string } }).data?.message;

async function seed() {
  const t = newTest();
  const owner = await setupOwner(t);
  const ana = await setupMember(t);
  return { t, owner, ana };
}

describe('tasks.create', () => {
  it('needs only a title and a project and puts the new task on top of its column', async () => {
    const { t, ana } = await seed();
    const first = await ana.client.mutation(api.tasks.create, { title: 'Primera', projectName: 'iMujer' });
    const second = await ana.client.mutation(api.tasks.create, { title: 'Segunda', projectName: 'iMujer' });
    const [a, b] = await t.run(async (ctx) => [await ctx.db.get(first), await ctx.db.get(second)]);
    expect(a).toMatchObject({ title: 'Primera', priority: 2, status: 'todo', createdBy: ana.memberId, subtasks: [] });
    expect(a!.assigneeId).toBeUndefined();
    expect(b!.order).toBeLessThan(a!.order);
  });

  it('rejects a blank title without creating anything (punto 2)', async () => {
    const { t, ana } = await seed();
    const error = await ana.client.mutation(api.tasks.create, { title: '   ', projectName: 'iMujer' }).catch((e) => e);
    expect(codeOf(error)).toBe('VALIDATION');
    expect(messageOf(error)).toBe('Escribe el nombre de la tarea.');
    expect(await t.run((ctx) => ctx.db.query('tasks').collect())).toHaveLength(0);
    expect(await t.run((ctx) => ctx.db.query('projects').collect())).toHaveLength(0);
  });

  it('validates lengths, project, priority, due date and assignee', async () => {
    const { t, ana } = await seed();
    const call = (args: Record<string, unknown>) => ana.client.mutation(api.tasks.create, { title: 'T', projectName: 'P', ...args } as never).catch((e) => e);
    expect(codeOf(await call({ title: 'x'.repeat(201) }))).toBe('VALIDATION');
    expect(codeOf(await call({ description: 'x'.repeat(2001) }))).toBe('VALIDATION');
    expect(messageOf(await call({ projectName: '  ' }))).toBe('Elige o escribe un proyecto.');
    expect(codeOf(await call({ priority: 4 }))).toBe('VALIDATION');
    expect(codeOf(await call({ dueDate: '2026-13-40' }))).toBe('VALIDATION');
    const gone = await t.run(async (ctx) => {
      const userId = await ctx.db.insert('users', {});
      return ctx.db.insert('members', { name: 'Fuera', roleLabel: 'X', isOwner: false, userId, email: 'f@x.co', createdAt: 1, lastSeenAt: 1, revokedAt: 2 });
    });
    expect(codeOf(await call({ assigneeId: gone }))).toBe('VALIDATION');
    expect(await t.run((ctx) => ctx.db.query('tasks').collect())).toHaveLength(0);
  });

  it('keeps up to 20 subtasks, ignores empty rows and rejects the 21st', async () => {
    const { t, ana } = await seed();
    const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ text: `Paso ${i + 1}` }));
    const id = await ana.client.mutation(api.tasks.create, { title: 'T', projectName: 'P', subtasks: [{ text: 'a' }, { text: '   ' }, { text: 'b', done: true }] });
    const task = await t.run((ctx) => ctx.db.get(id));
    expect(task!.subtasks.map((s) => [s.text, s.done])).toEqual([['a', false], ['b', true]]);
    expect(task!.subtasks.every((s) => s.id.length > 0)).toBe(true);
    await ana.client.mutation(api.tasks.create, { title: 'T20', projectName: 'P', subtasks: rows(20) });
    const error = await ana.client.mutation(api.tasks.create, { title: 'T21', projectName: 'P', subtasks: rows(21) }).catch((e) => e);
    expect(messageOf(error)).toBe('Máximo 20 subtareas.');
  });

  it('creates projects once per name (any capitalization) and rotates colors 1 to 6', async () => {
    const { t, ana } = await seed();
    for (const name of ['iMujer', 'SECOP II', 'CALIFRESCA', 'Landing', 'Portal', 'Otro', 'Séptimo']) {
      await ana.client.mutation(api.tasks.create, { title: `T ${name}`, projectName: name });
    }
    await ana.client.mutation(api.tasks.create, { title: 'Otra', projectName: '  IMUJER ' });
    const projects = await t.run((ctx) => ctx.db.query('projects').collect());
    expect(projects).toHaveLength(7);
    expect(projects.map((p) => p.colorSlot)).toEqual([1, 2, 3, 4, 5, 6, 1]);
    const events = await t.run((ctx) => ctx.db.query('events').collect());
    expect(events.filter((e) => e.type === 'project.created')).toHaveLength(7);
  });

  it('requires an account', async () => {
    const { t } = await seed();
    const error = await t.mutation(api.tasks.create, { title: 'T', projectName: 'P' }).catch((e) => e);
    expect(codeOf(error)).toBe('UNAUTHENTICATED');
  });
});

describe('tasks.update', () => {
  it('keeps both changes when two people edit different fields at once', async () => {
    const { t, owner, ana } = await seed();
    const id = await ana.client.mutation(api.tasks.create, { title: 'Original', projectName: 'P' });
    await Promise.all([
      ana.client.mutation(api.tasks.update, { id, patch: { title: 'Nuevo título' } }),
      owner.client.mutation(api.tasks.update, { id, patch: { dueDate: '2026-11-05' } }),
    ]);
    expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({ title: 'Nuevo título', dueDate: '2026-11-05' });
  });

  it('writes task.edited with changed fields and before/after for assignee, date and priority; no event when nothing changes', async () => {
    const { t, owner, ana } = await seed();
    const id = await ana.client.mutation(api.tasks.create, { title: 'T', projectName: 'P' });
    await ana.client.mutation(api.tasks.update, { id, patch: { dueDate: '2026-11-05', priority: 3, assigneeId: owner.memberId, title: 'T2' } });
    await ana.client.mutation(api.tasks.update, { id, patch: { title: 'T2' } });
    const edits = (await t.run((ctx) => ctx.db.query('events').collect())).filter((e) => e.type === 'task.edited');
    expect(edits).toHaveLength(1);
    expect(edits[0].detail.fields.sort()).toEqual(['assigneeId', 'dueDate', 'priority', 'title']);
    expect(edits[0].detail.changes.dueDate).toEqual({ from: null, to: '2026-11-05' });
    expect(edits[0].detail.changes.priority).toEqual({ from: 2, to: 3 });
    expect(edits[0].detail.changes.assigneeId).toEqual({ from: null, to: owner.memberId });
  });

  it('clears optional fields with null and refreshes the search text', async () => {
    const { t, ana } = await seed();
    const id = await ana.client.mutation(api.tasks.create, { title: 'Revisar', projectName: 'P', description: 'Detalle útil', dueDate: '2026-11-01' });
    await ana.client.mutation(api.tasks.update, { id, patch: { dueDate: null, description: null, title: 'Análisis nuevo' } });
    const task = await t.run((ctx) => ctx.db.get(id));
    expect(task!.dueDate).toBeUndefined();
    expect(task!.description).toBeUndefined();
    expect(task!.searchText).toBe('analisis nuevo');
  });

  it('moves a task to another project, creating it when needed', async () => {
    const { t, ana } = await seed();
    const id = await ana.client.mutation(api.tasks.create, { title: 'T', projectName: 'Uno' });
    await ana.client.mutation(api.tasks.update, { id, patch: { projectName: 'Dos' } });
    const [task, projects] = await t.run(async (ctx) => [await ctx.db.get(id), await ctx.db.query('projects').collect()]);
    expect(projects.find((p) => p._id === task!.projectId)!.name).toBe('Dos');
  });

  it('reports a clear error when the task no longer exists', async () => {
    const { t, ana } = await seed();
    const id = await ana.client.mutation(api.tasks.create, { title: 'T', projectName: 'P' });
    await t.run((ctx) => ctx.db.delete(id));
    const error = await ana.client.mutation(api.tasks.update, { id, patch: { title: 'X' } }).catch((e) => e);
    expect(codeOf(error)).toBe('TASK_NOT_FOUND');
  });
});

describe('tasks.remove', () => {
  it('is owner-only and writes task.deleted', async () => {
    const { t, owner, ana } = await seed();
    const id = await ana.client.mutation(api.tasks.create, { title: 'Borrar', projectName: 'P' });
    expect(codeOf(await ana.client.mutation(api.tasks.remove, { id }).catch((e) => e))).toBe('FORBIDDEN');
    await owner.client.mutation(api.tasks.remove, { id });
    expect(await t.run((ctx) => ctx.db.get(id))).toBeNull();
    expect((await t.run((ctx) => ctx.db.query('events').collect())).some((e) => e.type === 'task.deleted' && e.subjectTitle === 'Borrar')).toBe(true);
  });
});

describe('tasks.list and tasks.get', () => {
  it('finds tasks ignoring accents and case (punto 2)', async () => {
    const { ana } = await seed();
    await ana.client.mutation(api.tasks.create, { title: 'Análisis Jurídico revisión', projectName: 'P' });
    await ana.client.mutation(api.tasks.create, { title: 'Otra cosa', projectName: 'P' });
    expect((await ana.client.query(api.tasks.list, { q: 'analisis' })).map((x) => x.title)).toEqual(['Análisis Jurídico revisión']);
    expect((await ana.client.query(api.tasks.list, { q: 'JURÍDICO' })).map((x) => x.title)).toEqual(['Análisis Jurídico revisión']);
  });

  it('filters by project, assignee and priority', async () => {
    const { owner, ana } = await seed();
    await ana.client.mutation(api.tasks.create, { title: 'A', projectName: 'Uno', priority: 3 });
    await ana.client.mutation(api.tasks.create, { title: 'B', projectName: 'Dos', assigneeId: owner.memberId });
    const projects = await ana.client.query(api.projects.list, {});
    const dos = projects.find((p) => p.name === 'Dos')!;
    expect((await ana.client.query(api.tasks.list, { projectId: dos.id })).map((x) => x.title)).toEqual(['B']);
    expect((await ana.client.query(api.tasks.list, { assigneeId: owner.memberId })).map((x) => x.title)).toEqual(['B']);
    expect((await ana.client.query(api.tasks.list, { priority: 3 })).map((x) => x.title)).toEqual(['A']);
  });

  it('returns DTOs (never raw documents) with project and assignee names', async () => {
    const { owner, ana } = await seed();
    const id = await ana.client.mutation(api.tasks.create, { title: 'T', projectName: 'iMujer', assigneeId: owner.memberId, description: 'Privada' });
    const dto = await ana.client.query(api.tasks.get, { id });
    expect(dto).toMatchObject({ id, title: 'T', projectName: 'iMujer', projectColorSlot: 1, assigneeName: 'Dueña', status: 'todo', description: 'Privada' });
    expect(Object.keys(dto).sort()).toEqual(['assigneeId', 'assigneeName', 'description', 'id', 'order', 'priority', 'projectColorSlot', 'projectId', 'projectName', 'status', 'subtasks', 'title']);
  });

  it('marks assignees who lost access (rule 12) and keeps their name', async () => {
    const { t, ana, owner } = await seed();
    const id = await owner.client.mutation(api.tasks.create, { title: 'T', projectName: 'P', assigneeId: ana.memberId });
    await t.run((ctx) => ctx.db.patch(ana.memberId, { revokedAt: Date.now() }));
    expect(await owner.client.query(api.tasks.get, { id })).toMatchObject({ assigneeName: 'Ana', assigneeRevoked: true });
    await owner.client.mutation(api.tasks.update, { id, patch: { title: 'T2' } });
    expect((await owner.client.query(api.tasks.get, { id })).assigneeId).toBe(ana.memberId);
  });
});

describe('projects', () => {
  it('create returns the existing project for the same name and validates the name', async () => {
    const { ana } = await seed();
    const a = await ana.client.mutation(api.projects.create, { name: 'Portal web' });
    const b = await ana.client.mutation(api.projects.create, { name: ' portal WEB ' });
    expect(b).toBe(a);
    expect(messageOf(await ana.client.mutation(api.projects.create, { name: ' ' }).catch((e) => e))).toBe('Elige o escribe un proyecto.');
  });
});
