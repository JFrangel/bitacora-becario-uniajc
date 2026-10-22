import { describe, expect, it } from 'vitest';
import { api } from '../../convex/_generated/api';
import * as eventsModule from '../../convex/events';
import { logEvent } from '../../convex/lib/events';
import { codeOf, enableShare, newTest, setupMember, setupOwner } from './helpers';

async function seed() {
  const t = newTest();
  const owner = await setupOwner(t);
  const ana = await setupMember(t);
  const ownerActor = { memberId: owner.memberId, isOwner: true, name: 'Dueña', roleLabel: 'Becaria' };
  const anaActor = { memberId: ana.memberId, isOwner: false, name: 'Ana', roleLabel: 'Directora' };
  await t.run(async (ctx) => {
    await logEvent(ctx, anaActor, { type: 'task.created', subjectKind: 'task', subjectTitle: 'Tarea de Ana' });
    await logEvent(ctx, ownerActor, { type: 'journal.draft_created', subjectKind: 'journal', subjectTitle: 'Borrador' });
    await logEvent(ctx, ownerActor, { type: 'task.moved', subjectKind: 'task', subjectTitle: 'Tarea de la dueña' });
  });
  return { t, owner, ana, ownerActor, anaActor };
}

describe('events', () => {
  it('exposes no way to edit or delete events: the module only exports `list`', () => {
    expect(Object.keys(eventsModule)).toEqual(['list']);
  });

  it('marks journal.* events as owner-only and the rest as team', async () => {
    const { t } = await seed();
    const rows = await t.run((ctx) => ctx.db.query('events').collect());
    expect(Object.fromEntries(rows.map((r) => [r.type, r.visibility]))).toEqual({
      'task.created': 'team',
      'journal.draft_created': 'owner',
      'task.moved': 'team',
    });
  });

  it('shows every event to the owner, newest first', async () => {
    const { owner } = await seed();
    const page = await owner.client.query(api.events.list, {});
    expect(page.items.map((e) => e.type)).toEqual(['task.moved', 'journal.draft_created', 'task.created']);
    expect(page.nextCursor).toBeNull();
  });

  it('hides owner events from invited people', async () => {
    const { ana } = await seed();
    const page = await ana.client.query(api.events.list, {});
    expect(page.items.map((e) => e.type)).toEqual(['task.moved', 'task.created']);
  });

  it('gives the read-only link owner events only when the journal is included', async () => {
    const { t } = await seed();
    await enableShare(t, 'tok', { includesJournal: true });
    expect((await t.query(api.events.list, { shareToken: 'tok' })).items).toHaveLength(3);
    await enableShare(t, 'tok', { includesJournal: false });
    expect((await t.query(api.events.list, { shareToken: 'tok' })).items).toHaveLength(2);
    const bad = await t.query(api.events.list, { shareToken: 'otro' }).catch((e) => e);
    expect(codeOf(bad)).toBe('FORBIDDEN');
  });

  it('pages 50 at a time and filters by person', async () => {
    const { t, owner, ana, anaActor } = await seed();
    await t.run(async (ctx) => {
      for (let i = 0; i < 52; i += 1) await logEvent(ctx, anaActor, { type: 'task.edited', subjectKind: 'task', subjectTitle: `t${i}` });
    });
    const first = await owner.client.query(api.events.list, {});
    expect(first.items).toHaveLength(50);
    expect(first.nextCursor).not.toBeNull();
    const second = await owner.client.query(api.events.list, { cursor: first.nextCursor });
    expect(second.items).toHaveLength(5);
    expect(second.nextCursor).toBeNull();
    const onlyAna = await owner.client.query(api.events.list, { actorId: ana.memberId });
    expect(onlyAna.items.length).toBeGreaterThan(0);
    expect(onlyAna.items.every((e) => e.actorId === ana.memberId)).toBe(true);
  });

  it('keeps the name and role of the moment even if the person changes later', async () => {
    const { t, owner, ana } = await seed();
    await t.run((ctx) => ctx.db.patch(ana.memberId, { name: 'Ana María', roleLabel: 'Supervisora' }));
    const page = await owner.client.query(api.events.list, {});
    const created = page.items.find((e) => e.type === 'task.created')!;
    expect([created.actorName, created.actorRole]).toEqual(['Ana', 'Directora']);
  });

  it('requires an account', async () => {
    const { t } = await seed();
    const error = await t.query(api.events.list, {}).catch((e) => e);
    expect(codeOf(error)).toBe('UNAUTHENTICATED');
  });
});

describe('events.list by subject', () => {
  it('returns only the events of one task, newest first, for members and for the read-only link', async () => {
    const t = newTest();
    const owner = await setupOwner(t);
    await enableShare(t, 'tok');
    const a = await owner.client.mutation(api.tasks.create, { title: 'A', projectName: 'P', assigneeId: owner.memberId, dueDate: '2026-11-03' });
    const b = await owner.client.mutation(api.tasks.create, { title: 'B', projectName: 'P' });
    await owner.client.mutation(api.tasks.update, { id: a, patch: { priority: 3 } });
    await owner.client.mutation(api.tasks.move, { id: b, status: 'doing' });
    const own = await owner.client.query(api.events.list, { subjectId: a });
    expect(own.items.map((e) => e.type)).toEqual(['task.edited', 'task.created']);
    expect(own.items[1].detail).toMatchObject({ projectName: 'P', status: 'todo', assigneeName: 'Dueña', dueDate: '2026-11-03' });
    const viewer = await t.query(api.viewer.events, { shareToken: 'tok', subjectId: b });
    expect(viewer.items.map((e) => e.type)).toEqual(['task.moved', 'task.created']);
  });
});
