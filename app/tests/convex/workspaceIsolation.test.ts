import { describe, expect, it } from 'vitest';
import { api } from '../../convex/_generated/api';
import { newTest, setupMember, setupOwner } from './helpers';

async function fixture() {
  const t = newTest();
  const owner = await setupOwner(t);
  const first = await owner.client.mutation(api.workspaces.create, { name: 'Bitácora A' });
  const second = await owner.client.mutation(api.workspaces.create, { name: 'Bitácora B' });
  const editor = await setupMember(t, 'editora@example.com', 'Editora');
  await t.run((ctx) => ctx.db.insert('workspaceMembers', {
    workspaceId: first,
    memberId: editor.memberId,
    role: 'editor',
    createdAt: Date.now(),
  }));
  const projects = await t.run(async (ctx) => ({
    first: await ctx.db.insert('projects', { workspaceId: first, name: 'A', nameLower: 'a', colorSlot: 1 }),
    second: await ctx.db.insert('projects', { workspaceId: second, name: 'B', nameLower: 'b', colorSlot: 2 }),
  }));
  const tasks = await t.run(async (ctx) => ({
    first: await ctx.db.insert('tasks', {
      workspaceId: first, title: 'Tarea A', projectId: projects.first, priority: 2, status: 'todo', order: 1,
      createdBy: owner.memberId, createdAt: 1, updatedAt: 1, subtasks: [], searchText: 'tarea a',
    }),
    second: await ctx.db.insert('tasks', {
      workspaceId: second, title: 'Tarea B', projectId: projects.second, priority: 2, status: 'todo', order: 1,
      createdBy: owner.memberId, createdAt: 1, updatedAt: 1, subtasks: [], searchText: 'tarea b',
    }),
  }));
  await t.run(async (ctx) => {
    const settings = await ctx.db.query('settings').collect();
    for (const row of settings) {
      if (row.workspaceId === first) await ctx.db.patch(row._id, { shareToken: 'space-a-read', shareEnabled: true });
      if (row.workspaceId === second) await ctx.db.patch(row._id, { shareToken: 'space-b-read', shareEnabled: true });
    }
  });
  return { t, owner, editor, first, second, tasks };
}

describe('workspace isolation', () => {
  it('filters authenticated task lists and rejects a cross-workspace task mutation', async () => {
    const { editor, first, tasks } = await fixture();
    const list = await editor.client.query(api.tasks.list, { workspaceId: first });
    expect(list.map((task) => task.title)).toEqual(['Tarea A']);

    const error = await editor.client.mutation(api.tasks.update, {
      workspaceId: first,
      id: tasks.second,
      patch: { title: 'Cruce indebido' },
    }).catch((e) => e);
    expect((error as { data?: { code?: string } }).data?.code).toBe('TASK_NOT_FOUND');
  });

  it('resolves a read-only token to its own workspace only', async () => {
    const { t, first } = await fixture();
    const viewer = t.withIdentity({ subject: 'anonymous-viewer' });
    const board = await viewer.query(api.viewer.board, { shareToken: 'space-a-read' });
    expect(board.tasks.map((task) => task.title)).toEqual(['Tarea A']);
    expect(board.tasks.map((task) => task.title)).not.toContain('Tarea B');
    expect(first).toBeTruthy();
  });

  it('does not grant a shared editor access to the journal or workspace settings', async () => {
    const { editor, first } = await fixture();
    const journalError = await editor.client.query(api.journal.list, { workspaceId: first }).catch((e) => e);
    expect((journalError as { data?: { code?: string } }).data?.code).toBe('FORBIDDEN');

    const settingsError = await editor.client.mutation(api.settings.setShare, { workspaceId: first, enabled: false }).catch((e) => e);
    expect((settingsError as { data?: { code?: string } }).data?.code).toBe('FORBIDDEN');
  });

  it('lets an active account accept another workspace invite without replacing its first membership', async () => {
    const { t, owner, editor, first, second } = await fixture();
    const invitation = await owner.client.mutation(api.invites.create, { workspaceId: second });
    const token = invitation.link.split('/invitacion/')[1];

    const accepted = await editor.client.mutation(api.invites.redeem, {
      inviteToken: token,
      name: 'Editora',
      roleLabel: 'Directora',
    });
    const spaces = await editor.client.query(api.workspaces.listMine, {});
    const memberships = await t.run((ctx) => ctx.db.query('workspaceMembers').withIndex('by_member', (q) => q.eq('memberId', editor.memberId)).collect());

    expect(accepted).toMatchObject({ workspaceId: second, isInitial: false });
    expect(spaces.items.map(({ id }) => id)).toEqual(expect.arrayContaining([first, second]));
    expect(memberships.filter((membership) => membership.revokedAt === undefined)).toHaveLength(2);
    expect(await t.run((ctx) => ctx.db.query('profile').withIndex('by_memberId', (q) => q.eq('memberId', editor.memberId)).collect())).toHaveLength(1);
  });

  it('revokes only one workspace membership and preserves the other', async () => {
    const { owner, editor, first, second } = await fixture();
    await owner.client.mutation(api.invites.create, { workspaceId: second }).then(async ({ link }) => {
      const token = link.split('/invitacion/')[1];
      await editor.client.mutation(api.invites.redeem, { inviteToken: token, name: 'Editora', roleLabel: 'Directora' });
    });

    await owner.client.mutation(api.members.revoke, { workspaceId: first, memberId: editor.memberId });
    const remaining = await editor.client.query(api.workspaces.listMine, {});
    const member = await editor.client.run((ctx) => ctx.db.get(editor.memberId));

    expect(remaining.items.map(({ id }) => id)).toEqual([second]);
    expect(member?.revokedAt).toBeUndefined();
  });
});
