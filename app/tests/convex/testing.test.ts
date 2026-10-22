import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, internal } from '../../convex/_generated/api';
import { newTest } from './helpers';

afterEach(() => vi.unstubAllEnvs());

describe('testing (only for end-to-end runs)', () => {
  it('refuses to run unless the deployment has E2E_ENABLED=1, so it can never wipe or seed production', async () => {
    const t = newTest();
    await expect(t.mutation(internal.testing.seed, {})).rejects.toThrow(/E2E_ENABLED=1/);
    await expect(t.mutation(internal.testing.reset, {})).rejects.toThrow(/E2E_ENABLED=1/);
    vi.stubEnv('E2E_ENABLED', '0');
    await expect(t.mutation(internal.testing.seed, {})).rejects.toThrow(/E2E_ENABLED=1/);
    expect(await t.run((ctx) => ctx.db.query('members').collect())).toEqual([]);
  });

  it('is not part of the public API: every export is an internal function the browser cannot call', () => {
    const source = readFileSync(join(__dirname, '..', '..', 'convex', 'testing.ts'), 'utf8');
    const exported = [...source.matchAll(/export const (\w+) = (\w+)\(/g)].map((m) => [m[1], m[2]]);
    expect(exported).toEqual([['reset', 'internalMutation'], ['seed', 'internalMutation']]);
    // @ts-expect-error — en los tipos de `api` (solo funciones públicas) no existe `testing`
    void api.testing;
  });

  it('seeds the owner, the board, the Bitácora, an invitation and the read-only link', async () => {
    vi.stubEnv('E2E_ENABLED', '1');
    const t = newTest();
    const { shareToken, inviteToken, ownerEmail } = await t.mutation(internal.testing.seed, {});
    expect(ownerEmail).toBe('e2e-owner@example.com');

    expect(await t.query(api.viewer.access, { shareToken })).toEqual({ includesJournal: true, showsDescriptions: false });
    const board = await t.query(api.viewer.board, { shareToken });
    expect(board.tasks).toHaveLength(35);
    expect(board.tasks.filter((task) => task.status === 'todo')).toHaveLength(30);
    expect(board.projects.map((p) => p.name)).toEqual(['iMujer', 'SECOP II']);
    const journal = await t.query(api.viewer.journal, { shareToken });
    expect(journal.entries).toHaveLength(5);
    expect(journal.entries.filter((e) => e.isDraft)).toHaveLength(1);
    expect((await t.query(api.viewer.profile, { shareToken })).group).toBe('AthenIA');

    expect(await t.query(api.invites.peek, { inviteToken })).toEqual({ valid: true });
    await expect(t.query(api.viewer.access, { shareToken: 'otro' })).rejects.toThrow();
  });

  it('starts from the same state every time: seeding twice does not duplicate anything and replaces the links', async () => {
    vi.stubEnv('E2E_ENABLED', '1');
    const t = newTest();
    const first = await t.mutation(internal.testing.seed, {});
    const second = await t.mutation(internal.testing.seed, {});
    expect(second.shareToken).not.toBe(first.shareToken);
    await expect(t.query(api.viewer.access, { shareToken: first.shareToken })).rejects.toThrow();
    expect(await t.run((ctx) => ctx.db.query('members').collect())).toHaveLength(1);
    expect(await t.run((ctx) => ctx.db.query('tasks').collect())).toHaveLength(35);
    expect(await t.run((ctx) => ctx.db.query('invites').collect())).toHaveLength(1);
  });

  it('«reset» leaves every table empty', async () => {
    vi.stubEnv('E2E_ENABLED', '1');
    const t = newTest();
    await t.mutation(internal.testing.seed, {});
    await t.mutation(internal.testing.reset, {});
    for (const table of ['tasks', 'projects', 'journalEntries', 'members', 'users', 'settings', 'profile', 'invites', 'events'] as const) {
      expect(await t.run((ctx) => ctx.db.query(table).collect()), table).toEqual([]);
    }
  });
});
