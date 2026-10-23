import { describe, expect, it } from 'vitest';
import schema from '../../convex/schema';
import { newTest } from './helpers';
import { LIMITS } from '../../convex/lib/limits';

describe('schema', () => {
  it('accepts one valid document per table', async () => {
    const t = newTest();
    const counts = await t.run(async (ctx) => {
      const now = Date.now();
      const userId = await ctx.db.insert('users', { email: 'dueña@example.com' });
      const ownerId = await ctx.db.insert('members', { name: 'Ana', roleLabel: 'Becaria', isOwner: true, userId, email: 'dueña@example.com', createdAt: now, lastSeenAt: now });
      await ctx.db.insert('invites', { tokenHash: 'h', createdBy: ownerId, createdAt: now, expiresAt: now + 1000 });
      await ctx.db.insert('settings', { shareEnabled: false, shareIncludesJournal: true, shareShowsDescriptions: false, timezone: 'America/Bogota' });
      await ctx.db.insert('profile', { updatedAt: now });
      const projectId = await ctx.db.insert('projects', { name: 'iMujer', nameLower: 'imujer', colorSlot: 1 });
      const taskId = await ctx.db.insert('tasks', { title: 'T', projectId, priority: 2, status: 'todo', order: 1, createdBy: ownerId, createdAt: now, updatedAt: now, subtasks: [], searchText: 't' });
      await ctx.db.insert('journalEntries', { taskId, date: '2026-10-21', projectId, activity: 'A', docStatus: 'draft', activityStatus: 'Completada', links: [], photos: [], dayOrder: 0, createdAt: now, updatedAt: now });
      await ctx.db.insert('events', { at: now, actorId: ownerId, actorName: 'Ana', actorRole: 'Becaria', type: 'task.created', subjectKind: 'task', visibility: 'team' });
      return {
        members: (await ctx.db.query('members').collect()).length,
        tasks: (await ctx.db.query('tasks').collect()).length,
        events: (await ctx.db.query('events').collect()).length,
      };
    });
    expect(counts).toEqual({ members: 1, tasks: 1, events: 1 });
  });

  it('rejects a task with an invalid status', async () => {
    const t = newTest();
    await expect(
      t.run(async (ctx) => {
        const now = Date.now();
        const userId = await ctx.db.insert('users', {});
        const ownerId = await ctx.db.insert('members', { name: 'Ana', roleLabel: 'B', isOwner: true, userId, email: 'a@b.c', createdAt: now, lastSeenAt: now });
        const projectId = await ctx.db.insert('projects', { name: 'P', nameLower: 'p', colorSlot: 1 });
        // @ts-expect-error estado inválido a propósito
        await ctx.db.insert('tasks', { title: 'T', projectId, priority: 2, status: 'archived', order: 1, createdBy: ownerId, createdAt: now, updatedAt: now, subtasks: [], searchText: 't' });
      }),
    ).rejects.toThrow();
  });

  it('has no sessions table (Convex Auth owns sessions)', () => {
    expect(Object.keys(schema.tables)).not.toContain('sessions');
    expect(Object.keys(schema.tables)).toEqual(expect.arrayContaining(['members', 'invites', 'settings', 'profile', 'projects', 'tasks', 'journalEntries', 'events', 'users']));
  });
});

describe('LIMITS', () => {
  it('has the spec values', () => {
    expect(LIMITS).toEqual({
      title: 200,
      description: 2000,
      subtasks: 20,
      subtaskText: 200,
      projectName: 100,
      journalField: 1500,
      photos: 4,
      links: 12,
      pendingInvites: 10,
      inviteDays: 7,
      nameMin: 2,
      nameMax: 60,
      photoBytes: 409600,
      badgeLogoBytes: 184320,
      eventsPage: 50,
    });
  });
});
