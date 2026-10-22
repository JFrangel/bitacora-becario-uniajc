import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../../convex/_generated/api';
import { getActor, requireMember, requireOwner } from '../../convex/lib/actors';
import { addMember, asUser, newTest } from './helpers';

afterEach(() => vi.unstubAllEnvs());

const code = (e: unknown) => (e as { data?: { code?: string } }).data?.code;

describe('getActor', () => {
  it('returns null and requireMember throws UNAUTHENTICATED without credentials', async () => {
    const t = newTest();
    expect(await t.run((ctx) => getActor(ctx))).toBeNull();
    const error = await t.run((ctx) => requireMember(ctx)).catch((e) => e);
    expect(code(error)).toBe('UNAUTHENTICATED');
  });

  it('resolves a member by Google account and ignores revoked people', async () => {
    const t = newTest();
    const ana = await asUser(t, 'ana@example.com');
    const memberId = await addMember(t, ana.userId, { name: 'Ana', roleLabel: 'Directora' });
    expect(await ana.client.run((ctx) => getActor(ctx))).toEqual({ memberId, isOwner: false, name: 'Ana', roleLabel: 'Directora' });

    await t.run((ctx) => ctx.db.patch(memberId, { revokedAt: Date.now() }));
    expect(await ana.client.run((ctx) => getActor(ctx))).toBeNull();
  });

  it('returns null for a signed-in account without a member record', async () => {
    const t = newTest();
    const stranger = await asUser(t, 'stranger@example.com');
    expect(await stranger.client.run((ctx) => getActor(ctx))).toBeNull();
  });

  it('requireOwner throws FORBIDDEN for a regular member', async () => {
    const t = newTest();
    const ana = await asUser(t, 'ana@example.com');
    await addMember(t, ana.userId);
    const error = await ana.client.run((ctx) => requireOwner(ctx)).catch((e) => e);
    expect(code(error)).toBe('FORBIDDEN');
  });
});

describe('session.ensureOwner', () => {
  it('creates exactly one owner, one settings row and one profile row, idempotently', async () => {
    vi.stubEnv('OWNER_EMAIL', 'dueña@example.com');
    const t = newTest();
    const owner = await asUser(t, 'dueña@example.com', 'Dueña');
    await owner.client.mutation(api.session.ensureOwner, {});
    await owner.client.mutation(api.session.ensureOwner, {});
    const counts = await t.run(async (ctx) => ({
      members: await ctx.db.query('members').collect(),
      settings: (await ctx.db.query('settings').collect()).length,
      profile: (await ctx.db.query('profile').collect()).length,
    }));
    expect(counts.members).toHaveLength(1);
    expect(counts.members[0]).toMatchObject({ isOwner: true, name: 'Dueña', email: 'dueña@example.com' });
    expect(counts.settings).toBe(1);
    expect(counts.profile).toBe(1);
    expect(await owner.client.run((ctx) => getActor(ctx))).toMatchObject({ isOwner: true });
  });

  it('rejects any other Google account', async () => {
    vi.stubEnv('OWNER_EMAIL', 'dueña@example.com');
    const t = newTest();
    const other = await asUser(t, 'otra@example.com');
    const error = await other.client.mutation(api.session.ensureOwner, {}).catch((e) => e);
    expect(code(error)).toBe('FORBIDDEN');
    expect(await other.client.run((ctx) => getActor(ctx))).toBeNull();
    expect(await t.run((ctx) => ctx.db.query('members').collect())).toHaveLength(0);
  });

  it('fails closed when OWNER_EMAIL is not defined (punto 4)', async () => {
    vi.stubEnv('OWNER_EMAIL', '');
    const t = newTest();
    const anyone = await asUser(t, 'cualquiera@example.com');
    const error = await anyone.client.mutation(api.session.ensureOwner, {}).catch((e) => e);
    expect(code(error)).toBe('FORBIDDEN');
  });

  it('matches the owner email ignoring case (punto 4)', async () => {
    vi.stubEnv('OWNER_EMAIL', 'jose@gmail.com');
    const t = newTest();
    const owner = await asUser(t, 'Jose@Gmail.com');
    await owner.client.mutation(api.session.ensureOwner, {});
    expect(await owner.client.run((ctx) => getActor(ctx))).toMatchObject({ isOwner: true });
  });

  it('requires a signed-in account', async () => {
    vi.stubEnv('OWNER_EMAIL', 'dueña@example.com');
    const t = newTest();
    const error = await t.mutation(api.session.ensureOwner, {}).catch((e) => e);
    expect(code(error)).toBe('UNAUTHENTICATED');
  });
});
