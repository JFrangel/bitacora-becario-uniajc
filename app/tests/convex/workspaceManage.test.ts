import { describe, expect, it } from 'vitest';
import { api } from '../../convex/_generated/api';
import { codeOf, newTest, setupMember, setupOwner } from './helpers';

async function fixture() {
  const t = newTest();
  const owner = await setupOwner(t);
  const editor = await setupMember(t, 'editora@example.com', 'Editora');
  const space = await owner.client.mutation(api.workspaces.create, { name: 'Proyecto A' });
  const other = await owner.client.mutation(api.workspaces.create, { name: 'Proyecto B' });
  await t.run((ctx) => ctx.db.insert('workspaceMembers', { workspaceId: space, memberId: editor.memberId, role: 'editor', createdAt: Date.now() }));
  return { t, owner, editor, space, other };
}

const addTask = (t: Awaited<ReturnType<typeof fixture>>['t'], workspaceId: Parameters<typeof Object>[0], memberId: unknown) =>
  t.run(async (ctx) => {
    const projectId = await ctx.db.insert('projects', { workspaceId: workspaceId as never, name: 'P', nameLower: 'p', colorSlot: 1 });
    return ctx.db.insert('tasks', {
      workspaceId: workspaceId as never, title: 'Tarea', projectId, priority: 2, status: 'todo', order: 1,
      createdBy: memberId as never, createdAt: 1, updatedAt: 1, subtasks: [], searchText: 'tarea',
    });
  });

describe('workspaces.rename', () => {
  it('lets the owner of a space rename it, trimming the name and updating the sort key', async () => {
    const { t, owner, space } = await fixture();
    await owner.client.mutation(api.workspaces.rename, { workspaceId: space, name: '  Investigación 2026  ' });
    const row = await t.run((ctx) => ctx.db.get(space));
    expect(row).toMatchObject({ name: 'Investigación 2026', nameLower: 'investigación 2026' });
    const mine = await owner.client.query(api.workspaces.listMine, {});
    expect(mine.items.find(({ id }) => id === space)?.name).toBe('Investigación 2026');
  });

  it('rejects names that are too short or too long', async () => {
    const { owner, space } = await fixture();
    expect(codeOf(await owner.client.mutation(api.workspaces.rename, { workspaceId: space, name: ' a ' }).catch((e) => e))).toBe('VALIDATION');
    expect(codeOf(await owner.client.mutation(api.workspaces.rename, { workspaceId: space, name: 'x'.repeat(101) }).catch((e) => e))).toBe('VALIDATION');
  });

  it('does not let an editor or a stranger rename it', async () => {
    const { t, editor, space } = await fixture();
    const stranger = await setupMember(t, 'otra@example.com', 'Otra');
    expect(codeOf(await editor.client.mutation(api.workspaces.rename, { workspaceId: space, name: 'Cambio' }).catch((e) => e))).toBe('FORBIDDEN');
    expect(codeOf(await stranger.client.mutation(api.workspaces.rename, { workspaceId: space, name: 'Cambio' }).catch((e) => e))).toBe('FORBIDDEN');
    expect((await t.run((ctx) => ctx.db.get(space)))?.name).toBe('Proyecto A');
  });
});

describe('workspaces.remove', () => {
  it('deletes an empty space with its memberships, settings, pending invites and read-only link', async () => {
    const { t, owner, editor, space, other } = await fixture();
    await t.run(async (ctx) => {
      await ctx.db.insert('invites', { workspaceId: space, tokenHash: 'h', createdBy: owner.memberId, createdAt: 1, expiresAt: Date.now() + 1000 });
      const settings = (await ctx.db.query('settings').collect()).find((row) => row.workspaceId === space)!;
      await ctx.db.patch(settings._id, { shareToken: 'enlace-a', shareEnabled: true });
    });
    await owner.client.mutation(api.workspaces.remove, { workspaceId: space });
    const left = await t.run(async (ctx) => ({
      space: await ctx.db.get(space),
      members: (await ctx.db.query('workspaceMembers').collect()).filter((row) => row.workspaceId === space),
      settings: (await ctx.db.query('settings').collect()).filter((row) => row.workspaceId === space),
      invites: (await ctx.db.query('invites').collect()).filter((row) => row.workspaceId === space),
      otherSpace: await ctx.db.get(other),
    }));
    expect(left.space).toBeNull();
    expect(left.members).toHaveLength(0);
    expect(left.settings).toHaveLength(0);
    expect(left.invites).toHaveLength(0);
    expect(left.otherSpace).not.toBeNull();
    const viewer = t.withIdentity({ subject: 'anonimo' });
    await expect(viewer.query(api.viewer.board, { shareToken: 'enlace-a' })).rejects.toThrow();
    expect((await editor.client.query(api.workspaces.listMine, {})).items.map(({ id }) => id)).not.toContain(space);
  });

  it('refuses to delete a space that still has tasks or Bitácora records, and keeps everything', async () => {
    const { t, owner, space } = await fixture();
    await addTask(t, space, owner.memberId);
    const error = await owner.client.mutation(api.workspaces.remove, { workspaceId: space }).catch((e) => e);
    expect(codeOf(error)).toBe('VALIDATION');
    expect(await t.run((ctx) => ctx.db.get(space))).not.toBeNull();
    expect(await t.run((ctx) => ctx.db.query('tasks').collect())).toHaveLength(1);
  });

  it('refuses to delete a space with Bitácora records', async () => {
    const { t, owner, space } = await fixture();
    await t.run(async (ctx) => {
      const projectId = await ctx.db.insert('projects', { workspaceId: space, name: 'P', nameLower: 'p', colorSlot: 1 });
      await ctx.db.insert('journalEntries', {
        workspaceId: space, date: '2026-10-20', projectId, activity: 'Algo', hours: 1, docStatus: 'complete', activityStatus: 'Completada',
        links: [], photos: [], dayOrder: 1, createdAt: 1, updatedAt: 1,
      });
    });
    expect(codeOf(await owner.client.mutation(api.workspaces.remove, { workspaceId: space }).catch((e) => e))).toBe('VALIDATION');
  });

  it('never deletes the original Bitácora', async () => {
    const { t, owner } = await fixture();
    const initial = await t.run((ctx) => ctx.db.insert('workspaces', {
      name: 'Bitácora principal', nameLower: 'bitácora principal', ownerMemberId: owner.memberId, legacyKey: 'initial', createdAt: 1, updatedAt: 1,
    }));
    await t.run((ctx) => ctx.db.insert('workspaceMembers', { workspaceId: initial, memberId: owner.memberId, role: 'owner', createdAt: 1 }));
    expect(codeOf(await owner.client.mutation(api.workspaces.remove, { workspaceId: initial }).catch((e) => e))).toBe('FORBIDDEN');
    expect(await t.run((ctx) => ctx.db.get(initial))).not.toBeNull();
  });

  it('does not let an editor or a stranger delete it', async () => {
    const { t, editor, space } = await fixture();
    const stranger = await setupMember(t, 'otra@example.com', 'Otra');
    expect(codeOf(await editor.client.mutation(api.workspaces.remove, { workspaceId: space }).catch((e) => e))).toBe('FORBIDDEN');
    expect(codeOf(await stranger.client.mutation(api.workspaces.remove, { workspaceId: space }).catch((e) => e))).toBe('FORBIDDEN');
    expect(await t.run((ctx) => ctx.db.get(space))).not.toBeNull();
  });
});
