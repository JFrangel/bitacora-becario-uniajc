import { describe, expect, it } from 'vitest';
import { api } from '../../convex/_generated/api';
import { getActor } from '../../convex/lib/actors';
import { codeOf, newTest, setupMember, setupOwner } from './helpers';

describe('members.list', () => {
  it('is owner-only and includes the account email and who invited whom', async () => {
    const t = newTest();
    const owner = await setupOwner(t);
    const ana = await setupMember(t, 'ana@example.com', 'Ana', 'Directora');
    await t.run((ctx) => ctx.db.patch(ana.memberId, { invitedBy: owner.memberId }));

    expect(codeOf(await ana.client.query(api.members.list, {}).catch((e) => e))).toBe('FORBIDDEN');
    const list = await owner.client.query(api.members.list, {});
    expect(list).toHaveLength(2);
    const anaRow = list.find((m) => m.id === ana.memberId)!;
    expect(anaRow).toMatchObject({ name: 'Ana', roleLabel: 'Directora', email: 'ana@example.com', invitedByName: 'Dueña', revoked: false });
  });
});

describe('members.revoke', () => {
  it('revokes access at once and revokes pending invitations but not people who already joined through them', async () => {
    const t = newTest();
    const owner = await setupOwner(t);
    const ana = await setupMember(t, 'ana@example.com', 'Ana');
    const beto = await setupMember(t, 'beto@example.com', 'Beto');
    await t.run((ctx) => ctx.db.patch(beto.memberId, { invitedBy: ana.memberId }));
    await ana.client.mutation(api.invites.create, {});
    expect(await ana.client.query(api.invites.mine, {})).toHaveLength(1);

    await owner.client.mutation(api.members.revoke, { memberId: ana.memberId });

    expect(await ana.client.run((ctx) => getActor(ctx))).toBeNull();
    expect(await beto.client.run((ctx) => getActor(ctx))).not.toBeNull();
    const invites = await t.run((ctx) => ctx.db.query('invites').collect());
    expect(invites.every((i) => i.revokedAt !== undefined)).toBe(true);
    const events = await t.run((ctx) => ctx.db.query('events').collect());
    expect(events.find((e) => e.type === 'member.revoked')).toMatchObject({ subjectTitle: 'Ana' });
  });

  it('is owner-only and the owner cannot remove herself', async () => {
    const t = newTest();
    const owner = await setupOwner(t);
    const ana = await setupMember(t);
    expect(codeOf(await ana.client.mutation(api.members.revoke, { memberId: owner.memberId }).catch((e) => e))).toBe('FORBIDDEN');
    expect(codeOf(await owner.client.mutation(api.members.revoke, { memberId: owner.memberId }).catch((e) => e))).toBe('VALIDATION');
  });
});

describe('members.updateSelf', () => {
  it('lets anyone edit their own name and role (2 to 60) and logs member.updated', async () => {
    const t = newTest();
    await setupOwner(t);
    const ana = await setupMember(t);
    await ana.client.mutation(api.members.updateSelf, { name: ' Ana María ', roleLabel: 'Supervisora' });
    expect(await t.run((ctx) => ctx.db.get(ana.memberId))).toMatchObject({ name: 'Ana María', roleLabel: 'Supervisora' });
    expect(codeOf(await ana.client.mutation(api.members.updateSelf, { name: 'A', roleLabel: 'Rol' }).catch((e) => e))).toBe('VALIDATION');
    expect(codeOf(await ana.client.mutation(api.members.updateSelf, { name: 'Ana', roleLabel: 'R'.repeat(61) }).catch((e) => e))).toBe('VALIDATION');
    const events = await t.run((ctx) => ctx.db.query('events').collect());
    expect(events.filter((e) => e.type === 'member.updated')).toHaveLength(1);
  });

  it('is not available to a revoked person', async () => {
    const t = newTest();
    const ana = await setupMember(t);
    await t.run((ctx) => ctx.db.patch(ana.memberId, { revokedAt: Date.now() }));
    expect(codeOf(await ana.client.mutation(api.members.updateSelf, { name: 'Ana', roleLabel: 'Rol' }).catch((e) => e))).toBe('UNAUTHENTICATED');
  });
});

describe('members.directory', () => {
  it('lists the people with current access, by name, without e-mail addresses', async () => {
    const t = newTest();
    const owner = await setupOwner(t, 'dueña@ejemplo.co');
    const ana = await setupMember(t, 'ana@ejemplo.co', 'Ana', 'Directora');
    const luis = await setupMember(t, 'luis@ejemplo.co', 'Luis', 'Supervisor');
    await owner.client.mutation(api.members.revoke, { memberId: luis.memberId });
    const list = await ana.client.query(api.members.directory, {});
    expect(list.map((m) => m.name)).toEqual(['Ana', 'Dueña']);
    expect(list.find((m) => m.name === 'Dueña')).toMatchObject({ isOwner: true, roleLabel: 'Becaria' });
    expect(JSON.stringify(list)).not.toContain('@');
  });

  it('needs an account', async () => {
    const t = newTest();
    await setupOwner(t);
    expect(codeOf(await t.query(api.members.directory, {}).catch((e) => e))).toBe('UNAUTHENTICATED');
  });
});
