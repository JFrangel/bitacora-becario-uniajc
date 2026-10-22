import { describe, expect, it } from 'vitest';
import { api } from '../../convex/_generated/api';
import { codeOf, newTest, setupMember } from './helpers';

const DAY = 24 * 60 * 60 * 1000;

describe('members.touch', () => {
  it('updates lastSeenAt at most once per 24 hours', async () => {
    const t = newTest();
    const ana = await setupMember(t);
    await t.run((ctx) => ctx.db.patch(ana.memberId, { lastSeenAt: Date.now() - 2 * DAY }));

    await ana.client.mutation(api.members.touch, {});
    const first = (await t.run((ctx) => ctx.db.get(ana.memberId)))!.lastSeenAt;
    expect(Date.now() - first).toBeLessThan(5000);

    await new Promise((r) => setTimeout(r, 15));
    await ana.client.mutation(api.members.touch, {});
    const second = (await t.run((ctx) => ctx.db.get(ana.memberId)))!.lastSeenAt;
    expect(second).toBe(first);
  });

  it('requires a member account', async () => {
    const t = newTest();
    const error = await t.mutation(api.members.touch, {}).catch((e) => e);
    expect(codeOf(error)).toBe('UNAUTHENTICATED');
  });
});
