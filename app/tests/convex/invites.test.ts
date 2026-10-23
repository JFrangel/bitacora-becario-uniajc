import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../convex/_generated/api';
import { sha256Hex } from '../../convex/lib/tokens';
import { asUser, codeOf, newTest, setupMember, setupOwner, type Test } from './helpers';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const tokenOf = (link: string) => link.split('#/invitacion/')[1];

async function inviteFrom(client: { mutation: Test['mutation'] }) {
  const { link } = await client.mutation(api.invites.create, {});
  return { link, token: tokenOf(link) };
}

describe('invites.create', () => {
  it('returns the link once and stores only the SHA-256 hash', async () => {
    vi.stubEnv('SITE_URL', 'https://bitacora.example');
    const t = newTest();
    const owner = await setupOwner(t);
    const { link, token } = await inviteFrom(owner.client);
    expect(link).toBe(`https://bitacora.example/#/invitacion/${token}`);
    const rows = await t.run((ctx) => ctx.db.query('invites').collect());
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).toBe(await sha256Hex(token));
    expect(JSON.stringify(rows)).not.toContain(token);
  });

  it('lets invited people invite too, records the event and limits 10 pending per person', async () => {
    const t = newTest();
    await setupOwner(t);
    const ana = await setupMember(t);
    for (let i = 0; i < 10; i += 1) await ana.client.mutation(api.invites.create, {});
    const error = await ana.client.mutation(api.invites.create, {}).catch((e) => e);
    expect(codeOf(error)).toBe('LIMIT');
    const events = await t.run((ctx) => ctx.db.query('events').collect());
    expect(events.filter((e) => e.type === 'invite.created')).toHaveLength(10);
  });

  it('does not count used, revoked or expired invitations as pending', async () => {
    const t = newTest();
    const ana = await setupMember(t);
    for (let i = 0; i < 10; i += 1) await ana.client.mutation(api.invites.create, {});
    const rows = await t.run((ctx) => ctx.db.query('invites').collect());
    await t.run(async (ctx) => {
      await ctx.db.patch(rows[0]._id, { revokedAt: Date.now() });
      await ctx.db.patch(rows[1]._id, { expiresAt: Date.now() - 1 });
    });
    await ana.client.mutation(api.invites.create, {});
    expect(await ana.client.query(api.invites.mine, {})).toHaveLength(9);
  });

  it('requires an account', async () => {
    const t = newTest();
    expect(codeOf(await t.mutation(api.invites.create, {}).catch((e) => e))).toBe('UNAUTHENTICATED');
  });
});

describe('invites.redeem', () => {
  it('requires a Google account', async () => {
    const t = newTest();
    const owner = await setupOwner(t);
    const { token } = await inviteFrom(owner.client);
    const error = await t.mutation(api.invites.redeem, { inviteToken: token, name: 'Laura', roleLabel: 'Directora' }).catch((e) => e);
    expect(codeOf(error)).toBe('UNAUTHENTICATED');
  });

  it('creates the member linked to the account, marks the invitation used and logs member.joined', async () => {
    const t = newTest();
    const owner = await setupOwner(t);
    const { token } = await inviteFrom(owner.client);
    const laura = await asUser(t, 'Laura@Example.com', 'Laura Gómez');
    const { memberId } = await laura.client.mutation(api.invites.redeem, { inviteToken: token, name: '  Laura Gómez ', roleLabel: 'Directora' });

    const member = await t.run((ctx) => ctx.db.get(memberId));
    expect(member).toMatchObject({ name: 'Laura Gómez', roleLabel: 'Directora', isOwner: false, userId: laura.userId, email: 'laura@example.com', invitedBy: owner.memberId });
    expect(await t.run((ctx) => ctx.db.query('profile').withIndex('by_memberId', (q) => q.eq('memberId', memberId)).unique())).toMatchObject({ memberId });
    const invite = (await t.run((ctx) => ctx.db.query('invites').collect()))[0];
    expect(invite.usedBy).toBe(memberId);
    expect(invite.usedAt).toBeTypeOf('number');
    const events = await t.run((ctx) => ctx.db.query('events').collect());
    expect(events.find((e) => e.type === 'member.joined')).toMatchObject({ actorName: 'Laura Gómez', actorRole: 'Directora' });
  });

  it('can only be used once, even with two simultaneous attempts from different accounts', async () => {
    const t = newTest();
    const owner = await setupOwner(t);
    const { token } = await inviteFrom(owner.client);
    const a = await asUser(t, 'a@example.com');
    const b = await asUser(t, 'b@example.com');
    const results = await Promise.allSettled([
      a.client.mutation(api.invites.redeem, { inviteToken: token, name: 'Ana', roleLabel: 'Rol A' }),
      b.client.mutation(api.invites.redeem, { inviteToken: token, name: 'Beto', roleLabel: 'Rol B' }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(codeOf(rejected.reason)).toBe('INVITE_USED');
    expect(await t.run((ctx) => ctx.db.query('members').collect())).toHaveLength(2);
  });

  it('rejects expired, revoked and unknown invitations', async () => {
    const t = newTest();
    const owner = await setupOwner(t);
    const stranger = await asUser(t, 'x@example.com');
    const expired = await inviteFrom(owner.client);
    const revoked = await inviteFrom(owner.client);
    await t.run(async (ctx) => {
      const [first, second] = await ctx.db.query('invites').collect();
      await ctx.db.patch(first._id, { expiresAt: Date.now() - 1 });
      await ctx.db.patch(second._id, { revokedAt: Date.now() });
    });
    const call = (token: string) => stranger.client.mutation(api.invites.redeem, { inviteToken: token, name: 'Equis', roleLabel: 'Rol' }).catch((e) => codeOf(e));
    expect(await call(expired.token)).toBe('INVITE_EXPIRED');
    expect(await call(revoked.token)).toBe('INVITE_REVOKED');
    expect(await call('no-existe')).toBe('INVITE_INVALID');
  });

  it('validates name and role (2 to 60 characters)', async () => {
    const t = newTest();
    const owner = await setupOwner(t);
    const { token } = await inviteFrom(owner.client);
    const x = await asUser(t, 'x@example.com');
    const call = (name: string, roleLabel: string) => x.client.mutation(api.invites.redeem, { inviteToken: token, name, roleLabel }).catch((e) => e);
    expect(codeOf(await call('A', 'Directora'))).toBe('VALIDATION');
    expect(codeOf(await call('Ana', 'D'))).toBe('VALIDATION');
    expect(codeOf(await call('A'.repeat(61), 'Directora'))).toBe('VALIDATION');
    expect((await call('Ana', 'Directora') as { memberId: string }).memberId).toBeTruthy();
  });

  it('does not let the owner or an existing member redeem, and does not consume the invitation', async () => {
    const t = newTest();
    const owner = await setupOwner(t);
    const ana = await setupMember(t);
    const { token } = await inviteFrom(owner.client);
    expect(codeOf(await owner.client.mutation(api.invites.redeem, { inviteToken: token, name: 'Dueña', roleLabel: 'Rol' }).catch((e) => e))).toBe('ALREADY_MEMBER');
    expect(codeOf(await ana.client.mutation(api.invites.redeem, { inviteToken: token, name: 'Ana', roleLabel: 'Rol' }).catch((e) => e))).toBe('ALREADY_MEMBER');
    const invite = (await t.run((ctx) => ctx.db.query('invites').collect()))[0];
    expect(invite.usedAt).toBeUndefined();
  });

  it('reactivates a revoked person who is invited again', async () => {
    const t = newTest();
    const owner = await setupOwner(t);
    const ana = await setupMember(t);
    await t.run((ctx) => ctx.db.patch(ana.memberId, { revokedAt: Date.now() }));
    const { token } = await inviteFrom(owner.client);
    const { memberId } = await ana.client.mutation(api.invites.redeem, { inviteToken: token, name: 'Ana María', roleLabel: 'Supervisora' });
    expect(memberId).toBe(ana.memberId);
    const member = await t.run((ctx) => ctx.db.get(ana.memberId));
    expect(member).toMatchObject({ name: 'Ana María', roleLabel: 'Supervisora' });
    expect(member!.revokedAt).toBeUndefined();
  });

  it('never writes the token to the server logs', async () => {
    const spies = (['log', 'info', 'warn', 'error'] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    const t = newTest();
    const owner = await setupOwner(t);
    const { token } = await inviteFrom(owner.client);
    const x = await asUser(t, 'x@example.com');
    await x.client.mutation(api.invites.redeem, { inviteToken: token, name: 'Equis', roleLabel: 'Rol' });
    const printed = spies.flatMap((s) => s.mock.calls.flat()).map(String).join('\n');
    expect(printed).not.toContain(token);
  });
});

describe('invites.revoke', () => {
  it('lets the creator or the owner revoke, and nobody else', async () => {
    const t = newTest();
    const owner = await setupOwner(t);
    const ana = await setupMember(t, 'ana@example.com', 'Ana');
    const beto = await setupMember(t, 'beto@example.com', 'Beto');
    await ana.client.mutation(api.invites.create, {});
    await ana.client.mutation(api.invites.create, {});
    const [first, second] = await ana.client.query(api.invites.mine, {});

    expect(codeOf(await beto.client.mutation(api.invites.revoke, { inviteId: first.id }).catch((e) => e))).toBe('FORBIDDEN');
    await ana.client.mutation(api.invites.revoke, { inviteId: first.id });
    await owner.client.mutation(api.invites.revoke, { inviteId: second.id });
    expect(await ana.client.query(api.invites.mine, {})).toHaveLength(0);
  });
});
