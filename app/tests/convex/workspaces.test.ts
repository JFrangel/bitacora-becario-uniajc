import { describe, expect, it } from 'vitest';
import { api } from '../../convex/_generated/api';
import { requireWorkspaceActor } from '../../convex/lib/actors';
import { newTest, setupMember, setupOwner } from './helpers';

describe('workspaces', () => {
  it('lets one account create and list multiple independent spaces without duplicating its profile', async () => {
    const t = newTest();
    const owner = await setupOwner(t);

    const firstId = await owner.client.mutation(api.workspaces.create, { name: 'Bitácora personal' });
    const secondId = await owner.client.mutation(api.workspaces.create, { name: 'Proyecto de investigación' });
    const spaces = await owner.client.query(api.workspaces.listMine, {});
    const profiles = await t.run((ctx) => ctx.db.query('profile').collect());
    const settings = await t.run((ctx) => ctx.db.query('settings').collect());

    expect(spaces.items.map(({ id }) => id)).toEqual(expect.arrayContaining([firstId, secondId]));
    expect(spaces.items).toHaveLength(2);
    expect(spaces.items.map(({ role }) => role)).toEqual(['owner', 'owner']);
    expect(spaces.workspaceMode).toBe(true);
    expect(profiles).toHaveLength(1);
    expect(settings.filter((row) => row.workspaceId === firstId)).toHaveLength(1);
    expect(settings.filter((row) => row.workspaceId === secondId)).toHaveLength(1);
  });

  it('lists a shared space with its role and owner name, but not unrelated spaces', async () => {
    const t = newTest();
    const owner = await setupOwner(t);
    const ownerSpaceId = await owner.client.mutation(api.workspaces.create, { name: 'Bitácora compartida' });
    const editor = await setupMember(t, 'editora@example.com', 'Editora');
    const unrelated = await setupMember(t, 'otra@example.com', 'Otra persona');
    await t.run((ctx) =>
      ctx.db.insert('workspaceMembers', {
        workspaceId: ownerSpaceId,
        memberId: editor.memberId,
        role: 'editor',
        createdAt: Date.now(),
      }),
    );

    expect(await editor.client.query(api.workspaces.listMine, {})).toMatchObject({ items: [
      { id: ownerSpaceId, name: 'Bitácora compartida', role: 'editor', ownerName: 'Dueña' },
    ], workspaceMode: true });
    expect(await unrelated.client.query(api.workspaces.listMine, {})).toEqual({ items: [], workspaceMode: true });
  });

  it('requires an authenticated member to create a space', async () => {
    const t = newTest();
    const error = await t.mutation(api.workspaces.create, { name: 'Sin sesión' }).catch((e) => e);
    expect((error as { data?: { code?: string } }).data?.code).toBe('UNAUTHENTICATED');
  });

  it('rejects a signed-in account that is not a member of the requested space', async () => {
    const t = newTest();
    const owner = await setupOwner(t);
    const stranger = await setupMember(t, 'stranger@example.com', 'Desconocida');
    const workspaceId = await owner.client.mutation(api.workspaces.create, { name: 'Privada' });

    const error = await stranger.client.run((ctx) => requireWorkspaceActor(ctx, workspaceId)).catch((e) => e);
    expect((error as { data?: { code?: string } }).data?.code).toBe('FORBIDDEN');
  });

  it('rejects blank and overlong workspace names', async () => {
    const t = newTest();
    const owner = await setupOwner(t);

    await expect(owner.client.mutation(api.workspaces.create, { name: '  ' })).rejects.toMatchObject({ data: { code: 'VALIDATION' } });
    await expect(owner.client.mutation(api.workspaces.create, { name: 'x'.repeat(101) })).rejects.toMatchObject({ data: { code: 'VALIDATION' } });
  });
});
