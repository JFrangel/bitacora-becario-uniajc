import { describe, expect, it } from 'vitest';
import { api } from '../../convex/_generated/api';
import { asUser, newTest, setupMember, setupOwner } from './helpers';

describe('session.me', () => {
  it('says anonymous when nobody is signed in', async () => {
    const t = newTest();
    expect(await t.query(api.session.me, {})).toEqual({ status: 'anonymous' });
  });

  it('says none (with the account e-mail) for a Google account that has no member record', async () => {
    const t = newTest();
    const stranger = await asUser(t, 'carlos.ruiz@gmail.com', 'Carlos Ruiz');
    expect(await stranger.client.query(api.session.me, {})).toEqual({ status: 'none', email: 'carlos.ruiz@gmail.com', name: 'Carlos Ruiz' });
  });

  it('gives an active person their record and never an e-mail address', async () => {
    const t = newTest();
    const owner = await setupOwner(t, 'dueña@ejemplo.co');
    const ana = await setupMember(t, 'ana@ejemplo.co');
    const mine = await ana.client.query(api.session.me, {});
    expect(mine).toMatchObject({ status: 'active', memberId: ana.memberId, name: 'Ana', roleLabel: 'Directora', isOwner: false });
    const owners = await owner.client.query(api.session.me, {});
    expect(owners).toMatchObject({ status: 'active', isOwner: true });
    expect(JSON.stringify([mine, owners])).not.toContain('@');
  });

  it('says revoked as soon as the owner withdraws access, without waiting for anything to expire', async () => {
    const t = newTest();
    const owner = await setupOwner(t);
    const ana = await setupMember(t);
    expect((await ana.client.query(api.session.me, {})).status).toBe('active');
    await owner.client.mutation(api.members.revoke, { memberId: ana.memberId });
    expect(await ana.client.query(api.session.me, {})).toEqual({ status: 'revoked' });
  });
});

describe('invites.peek', () => {
  async function seed() {
    const t = newTest();
    const owner = await setupOwner(t);
    const link = (await owner.client.mutation(api.invites.create, {})).link;
    const token = link.split('#/invitacion/')[1];
    return { t, owner, token };
  }

  it('says valid for a pending invitation, without needing a session, and reveals nothing else', async () => {
    const { t, token } = await seed();
    expect(await t.query(api.invites.peek, { inviteToken: token })).toEqual({ valid: true });
  });

  it('says invalid for an unknown token', async () => {
    const { t } = await seed();
    expect(await t.query(api.invites.peek, { inviteToken: 'no-existe' })).toEqual({ valid: false });
  });

  it('says invalid once the invitation is used, revoked or expired', async () => {
    const { t, owner, token } = await seed();
    const invited = await asUser(t, 'nueva@ejemplo.co', 'Nueva');
    const second = (await owner.client.mutation(api.invites.create, {})).link.split('#/invitacion/')[1];
    const third = (await owner.client.mutation(api.invites.create, {})).link.split('#/invitacion/')[1];

    await invited.client.mutation(api.invites.redeem, { inviteToken: token, name: 'Nueva', roleLabel: 'Directora' });
    expect(await t.query(api.invites.peek, { inviteToken: token })).toEqual({ valid: false });

    const pending = await owner.client.query(api.invites.mine, {});
    await owner.client.mutation(api.invites.revoke, { inviteId: pending[0].id });
    await t.run(async (ctx) => {
      const rows = await ctx.db.query('invites').collect();
      const open = rows.find((r) => r.usedAt === undefined && r.revokedAt === undefined)!;
      await ctx.db.patch(open._id, { expiresAt: Date.now() - 1 });
    });
    expect(await t.query(api.invites.peek, { inviteToken: second })).toEqual({ valid: false });
    expect(await t.query(api.invites.peek, { inviteToken: third })).toEqual({ valid: false });
  });
});
