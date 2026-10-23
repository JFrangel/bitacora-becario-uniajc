import { describe, expect, it } from 'vitest';
import { api, internal } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { getActor } from '../../convex/lib/actors';
import { sha256Hex } from '../../convex/lib/tokens';
import { addMember, asUser, newTest, setupOwner } from './helpers';

describe('workspaceMigration', () => {
  it('reports legacy documents before assigning them to a workspace', async () => {
    const t = newTest();
    const owner = await setupOwner(t);
    const projectId = await t.run((ctx) => ctx.db.insert('projects', { name: 'iMujer', nameLower: 'imujer', colorSlot: 1 }));
    await t.run((ctx) => ctx.db.insert('tasks', {
      title: 'Analizar', projectId, priority: 2, status: 'todo', order: 1, createdBy: owner.memberId,
      createdAt: 1, updatedAt: 1, subtasks: [], searchText: 'analizar',
    }));

    await expect(t.query(internal.workspaceMigration.status, {})).resolves.toMatchObject({
      unassigned: { projects: 1, tasks: 1 },
      associated: { projects: 0, tasks: 0 },
    });
  });

  it('backfills in bounded idempotent batches without changing tokens, invite states, or profile data', async () => {
    const t = newTest();
    const owner = await setupOwner(t);
    const editorUser = await t.run((ctx) => ctx.db.insert('users', { email: 'editora@example.com' }));
    const editorId = await addMember(t, editorUser, { name: 'Editora', email: 'editora@example.com' });
    const revokedUser = await t.run((ctx) => ctx.db.insert('users', { email: 'revocada@example.com' }));
    const revokedAt = Date.now() - 1000;
    const revokedId = await addMember(t, revokedUser, { name: 'Revocada', email: 'revocada@example.com', revokedAt });
    const projectId = await t.run((ctx) => ctx.db.insert('projects', { name: 'iMujer', nameLower: 'imujer', colorSlot: 1 }));
    const taskId = await t.run((ctx) => ctx.db.insert('tasks', {
      title: 'Analizar', projectId, priority: 2, status: 'done', order: 1, createdBy: owner.memberId,
      createdAt: 10, updatedAt: 20, subtasks: [], searchText: 'analizar', completedAt: 20,
    }));
    const journalId = await t.run((ctx) => ctx.db.insert('journalEntries', {
      taskId, taskTitleSnapshot: 'Analizar', date: '2026-10-22', projectId, activity: 'Análisis',
      docStatus: 'complete', activityStatus: 'Completada', links: [], photos: [], dayOrder: 0, createdAt: 10, updatedAt: 20,
    }));
    const eventId = await t.run((ctx) => ctx.db.insert('events', {
      at: 20, actorId: owner.memberId, actorName: 'Dueña', actorRole: 'Becaria', type: 'task.created', subjectKind: 'task',
      subjectId: taskId, visibility: 'team',
    }));
    const now = Date.now();
    const pendingToken = 'legacy-pending-invitation-token';
    const pendingHash = await sha256Hex(pendingToken);
    const inviteIds = await t.run(async (ctx) => Promise.all([
      ctx.db.insert('invites', { tokenHash: pendingHash, createdBy: owner.memberId, createdAt: now, expiresAt: now + 60_000 }),
      ctx.db.insert('invites', { tokenHash: 'used-hash', createdBy: owner.memberId, createdAt: now - 5000, expiresAt: now - 1000, usedBy: editorId, usedAt: now - 1000 }),
      ctx.db.insert('invites', { tokenHash: 'revoked-hash', createdBy: owner.memberId, createdAt: now, expiresAt: now + 60_000, revokedAt: now }),
    ]));
    await t.run(async (ctx) => {
      const settings = await ctx.db.query('settings').first();
      if (!settings) throw new Error('setupOwner did not create settings');
      await ctx.db.patch(settings._id, { shareToken: 'existing-reader-token', shareEnabled: true, shareIncludesJournal: true, shareShowsDescriptions: false });
    });

    let cursor: string | null = null;
    let pages = 0;
    do {
      const result: { cursor: string | null; processed: number; workspaceId: Id<'workspaces'> } = await t.mutation(internal.workspaceMigration.runBatch, { cursor: cursor ?? undefined, limit: 2 });
      cursor = result.cursor;
      pages += 1;
      expect(result.processed).toBeLessThanOrEqual(2);
      expect(pages).toBeLessThan(30);
    } while (cursor !== null);

    const migrated = await t.run(async (ctx) => ({
      workspace: await ctx.db.query('workspaces').withIndex('by_legacy_key', (q) => q.eq('legacyKey', 'initial')).unique(),
      project: await ctx.db.get(projectId),
      task: await ctx.db.get(taskId),
      journal: await ctx.db.get(journalId),
      event: await ctx.db.get(eventId),
      settings: await ctx.db.query('settings').first(),
      invites: await Promise.all(inviteIds.map((id) => ctx.db.get(id))),
      workspaceMembers: await ctx.db.query('workspaceMembers').collect(),
      profiles: await ctx.db.query('profile').collect(),
    }));
    const workspaceId = migrated.workspace!._id;
    expect(migrated.project?.workspaceId).toBe(workspaceId);
    expect(migrated.task?.workspaceId).toBe(workspaceId);
    expect(migrated.journal?.workspaceId).toBe(workspaceId);
    expect(migrated.event?.workspaceId).toBe(workspaceId);
    expect(migrated.settings).toMatchObject({ workspaceId, shareToken: 'existing-reader-token', shareEnabled: true });
    expect(migrated.invites).toEqual(expect.arrayContaining([
      expect.objectContaining({ tokenHash: pendingHash, workspaceId }),
      expect.objectContaining({ tokenHash: 'used-hash', workspaceId, usedBy: editorId }),
      expect.objectContaining({ tokenHash: 'revoked-hash', workspaceId, revokedAt: now }),
    ]));
    expect(migrated.invites![0]).not.toHaveProperty('usedAt');
    expect(migrated.workspaceMembers).toEqual(expect.arrayContaining([
      expect.objectContaining({ workspaceId, memberId: owner.memberId, role: 'owner' }),
      expect.objectContaining({ workspaceId, memberId: editorId, role: 'editor' }),
      expect.objectContaining({ workspaceId, memberId: revokedId, role: 'editor', revokedAt }),
    ]));
    expect(migrated.workspaceMembers!.find(({ memberId }) => memberId === owner.memberId)).not.toHaveProperty('revokedAt');
    expect(migrated.workspaceMembers!.find(({ memberId }) => memberId === editorId)).not.toHaveProperty('revokedAt');
    expect(migrated.profiles).toHaveLength(1);
    expect((await t.query(internal.workspaceMigration.status, {}))).toMatchObject({
      unassigned: { projects: 0, tasks: 0, journalEntries: 0, events: 0, invites: 0, settings: 0 },
      inconsistentReferences: 0,
    });
    expect(await owner.client.run((ctx) => getActor(ctx))).toMatchObject({ memberId: owner.memberId, isOwner: true });

    const publicViewer = t.withIdentity({ subject: 'anonymous-after-migration' });
    await expect(publicViewer.query(api.viewer.board, { shareToken: 'existing-reader-token' })).resolves.toMatchObject({
      tasks: [expect.objectContaining({ title: 'Analizar' })],
    });
    const invited = await asUser(t, 'nueva@example.com', 'Nueva');
    const accepted = await invited.client.mutation(api.invites.redeem, {
      inviteToken: pendingToken,
      name: 'Nueva',
      roleLabel: 'Colaboradora',
    });
    expect(accepted).toMatchObject({ workspaceId, isInitial: true });
    expect(await invited.client.query(api.workspaces.listMine, {})).toMatchObject({
      items: [expect.objectContaining({ id: workspaceId, role: 'editor' })],
    });

    let rerunCursor: string | null = null;
    let rerunPages = 0;
    do {
      const result: { cursor: string | null; processed: number; workspaceId: Id<'workspaces'> } = await t.mutation(internal.workspaceMigration.runBatch, { cursor: rerunCursor ?? undefined, limit: 100 });
      rerunCursor = result.cursor;
      rerunPages += 1;
      expect(rerunPages).toBeLessThan(30);
    } while (rerunCursor !== null);
    expect(await t.run((ctx) => ctx.db.query('workspaces').collect())).toHaveLength(1);
    expect(await t.run((ctx) => ctx.db.query('workspaceMembers').collect())).toHaveLength(4);
    const otherWorkspaceId = await owner.client.mutation(api.workspaces.create, { name: 'Otro espacio' });
    await t.run((ctx) => ctx.db.patch(taskId, { workspaceId: otherWorkspaceId }));
    expect((await t.query(internal.workspaceMigration.status, {})).inconsistentReferences).toBeGreaterThan(0);
  });

  it('rejects a batch larger than 100 documents', async () => {
    const t = newTest();
    await expect(t.mutation(internal.workspaceMigration.runBatch, { limit: 101 })).rejects.toMatchObject({ data: { code: 'VALIDATION' } });
  });
});
