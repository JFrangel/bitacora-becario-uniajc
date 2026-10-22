import { describe, expect, it } from 'vitest';
import { api } from '../../convex/_generated/api';
import { HOURS_MESSAGE } from '../../convex/lib/hours';
import { codeOf, newTest, setupMember, setupOwner } from './helpers';

const fields = (patch: Record<string, unknown> = {}) => ({
  date: '2026-10-15', hours: '2', projectName: 'iMujer', activity: 'Actividad', result: 'Resultado', activityStatus: 'Completada' as const, ...patch,
});
const entry = (legacyId: string, patch: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => ({ legacyId, fields: fields(patch), ...extra });

async function seed() {
  const t = newTest();
  const owner = await setupOwner(t);
  const ana = await setupMember(t);
  const all = () => t.run((ctx) => ctx.db.query('journalEntries').collect());
  return { t, owner, ana, all };
}

describe('journal.restore (Restaurar copia)', () => {
  it('creates complete records marked with their original id, with the original dates', async () => {
    const { owner, all } = await seed();
    const result = await owner.client.mutation(api.journal.restore, {
      entries: [entry('a', {}, { createdAt: 1_700_000_000_000, updatedAt: 1_700_000_100_000 }), entry('b', { activity: 'Otra', hours: '0,5', links: [{ label: 'Doc', url: 'https://example.com/x' }] })],
    });
    expect(result).toEqual({ created: 2, updated: 0 });
    const rows = await all();
    expect(rows).toHaveLength(2);
    const a = rows.find((r) => r.legacyId === 'a')!;
    expect(a).toMatchObject({ docStatus: 'complete', hours: 2, createdAt: 1_700_000_000_000, updatedAt: 1_700_000_100_000 });
    expect(rows.find((r) => r.legacyId === 'b')).toMatchObject({ hours: 0.5, links: [{ label: 'Doc', url: 'https://example.com/x' }] });
  });

  it('is idempotent: restoring the same copy twice updates instead of duplicating', async () => {
    const { owner, all } = await seed();
    await owner.client.mutation(api.journal.restore, { entries: [entry('a'), entry('b')] });
    const again = await owner.client.mutation(api.journal.restore, { entries: [entry('a', { result: 'Nuevo resultado' }), entry('b')] });
    expect(again).toEqual({ created: 0, updated: 2 });
    const rows = await all();
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.legacyId === 'a')!.result).toBe('Nuevo resultado');
  });

  it('keeps the link to the task of a record that already exists', async () => {
    const { owner, t, all } = await seed();
    const task = await owner.client.mutation(api.tasks.create, { title: 'T', projectName: 'iMujer', assigneeId: owner.memberId });
    await owner.client.mutation(api.tasks.move, { id: task, status: 'done' });
    const [draft] = await all();
    await t.run((ctx) => ctx.db.patch(draft._id, { legacyId: 'x' }));
    await owner.client.mutation(api.journal.restore, { entries: [entry('x')] });
    const [restored] = await all();
    expect(restored).toMatchObject({ taskId: task, docStatus: 'complete', hours: 2 });
  });

  it('rejects the whole batch if one record is invalid, and creates nothing', async () => {
    const { owner, all } = await seed();
    const error = await owner.client.mutation(api.journal.restore, { entries: [entry('a'), entry('b', { hours: '30' })] }).catch((e) => e);
    expect(codeOf(error)).toBe('VALIDATION');
    expect((error as { data: { message: string } }).data.message).toBe(HOURS_MESSAGE);
    expect(await all()).toHaveLength(0);
  });

  it('accepts at most 50 records per call', async () => {
    const { owner } = await seed();
    const many = Array.from({ length: 51 }, (_, i) => entry(`id${i}`));
    expect(codeOf(await owner.client.mutation(api.journal.restore, { entries: many }).catch((e) => e))).toBe('VALIDATION');
  });

  it('is owner-only', async () => {
    const { t, ana } = await seed();
    expect(codeOf(await ana.client.mutation(api.journal.restore, { entries: [entry('a')] }).catch((e) => e))).toBe('FORBIDDEN');
    expect(codeOf(await t.mutation(api.journal.restore, { entries: [entry('a')] }).catch((e) => e))).toBe('UNAUTHENTICATED');
  });
});
