import { describe, expect, it, vi } from 'vitest';
import { api } from '../../convex/_generated/api';
import { codeOf, enableShare, newTest, setupMember, setupOwner } from './helpers';

const TOKEN = 'tok-lectura';
const JPEG = 'data:image/jpeg;base64,';

/** Una imagen de `bytes` bytes ya codificada: base64 válido de ceros, con su relleno. */
const jpegOf = (bytes: number) => {
  const padding = (3 - (bytes % 3)) % 3;
  return `${JPEG}${'A'.repeat(4 * Math.ceil(bytes / 3) - padding)}${'='.repeat(padding)}`;
};

async function seed() {
  const t = newTest();
  const owner = await setupOwner(t, 'dueña@ejemplo.co');
  const ana = await setupMember(t, 'ana@ejemplo.co');
  await enableShare(t, TOKEN);
  return { t, owner, ana };
}

describe('profile.update', () => {
  it.each([
    ['program', 80],
    ['term', 30],
    ['institution', 100],
    ['group', 60],
  ])('%s admits %i characters and rejects one more', async (field, max) => {
    const { owner } = await seed();
    await expect(owner.client.mutation(api.profile.update, { [field]: 'x'.repeat(max) } as never)).resolves.toBeNull();
    const error = await owner.client.mutation(api.profile.update, { [field]: 'x'.repeat(max + 1) } as never).catch((e) => e);
    expect(codeOf(error)).toBe('VALIDATION');
  });

  it('trims the text and clears a field with an empty string', async () => {
    const { owner } = await seed();
    await owner.client.mutation(api.profile.update, { program: '  Ingeniería de Sistemas  ', term: '7.º' });
    expect(await owner.client.query(api.profile.get, {})).toMatchObject({ program: 'Ingeniería de Sistemas', term: '7.º' });
    await owner.client.mutation(api.profile.update, { program: '   ' });
    const badge = await owner.client.query(api.profile.get, {});
    expect('program' in badge).toBe(false);
    expect(badge).toMatchObject({ term: '7.º' });
  });

  it('only changes the fields that are sent', async () => {
    const { owner } = await seed();
    await owner.client.mutation(api.profile.update, { program: 'Sistemas', group: 'AthenIA' });
    await owner.client.mutation(api.profile.update, { term: '7.º' });
    expect(await owner.client.query(api.profile.get, {})).toMatchObject({ program: 'Sistemas', group: 'AthenIA', term: '7.º' });
  });

  it('accepts the five badge designs and rejects any other id', async () => {
    const { owner } = await seed();
    for (const id of ['olimpo', 'circuito', 'poster', 'suizo', 'clasico']) {
      await owner.client.mutation(api.profile.update, { badgeDesign: id });
      expect((await owner.client.query(api.profile.get, {})).badgeDesign).toBe(id);
    }
    for (const id of ['holo', 'OLIMPO', '', '__proto__']) {
      expect(codeOf(await owner.client.mutation(api.profile.update, { badgeDesign: id }).catch((e) => e)), id).toBe('VALIDATION');
    }
    expect((await owner.client.query(api.profile.get, {})).badgeDesign).toBe('clasico');
  });

  it('accepts a JPEG data URL up to 409 600 decoded bytes, and removes it with null', async () => {
    const { owner } = await seed();
    await owner.client.mutation(api.profile.update, { photoDataUrl: jpegOf(409600) });
    expect((await owner.client.query(api.profile.get, {})).photoDataUrl).toBe(jpegOf(409600));
    await owner.client.mutation(api.profile.update, { photoDataUrl: null });
    expect('photoDataUrl' in (await owner.client.query(api.profile.get, {}))).toBe(false);
  });

  it.each([
    ['one byte over the limit', jpegOf(409601)],
    ['a PNG', 'data:image/png;base64,AAAA'],
    ['plain text', 'hola'],
    ['an external address', 'https://example.com/foto.jpg'],
    ['no payload', JPEG],
    ['characters outside base64', `${JPEG}AA$A`],
    ['a malformed length', `${JPEG}AAAAA`],
  ])('rejects a photo that is %s', async (_name, photoDataUrl) => {
    const { owner } = await seed();
    expect(codeOf(await owner.client.mutation(api.profile.update, { photoDataUrl }).catch((e) => e))).toBe('VALIDATION');
    expect('photoDataUrl' in (await owner.client.query(api.profile.get, {}))).toBe(false);
  });

  it('refreshes updatedAt only when something changes', async () => {
    const { owner } = await seed();
    const first = (await owner.client.query(api.profile.get, {})).updatedAt!;
    await owner.client.mutation(api.profile.update, { program: 'Sistemas' });
    const second = (await owner.client.query(api.profile.get, {})).updatedAt!;
    expect(second).toBeGreaterThanOrEqual(first);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 60_000);
    try {
      await owner.client.mutation(api.profile.update, { program: 'Sistemas' });
      expect((await owner.client.query(api.profile.get, {})).updatedAt).toBe(second);
      await owner.client.mutation(api.profile.update, { program: 'Software' });
      expect((await owner.client.query(api.profile.get, {})).updatedAt).toBeGreaterThan(second);
    } finally {
      vi.useRealTimers();
    }
  });

  it('is owner-only', async () => {
    const { t, ana } = await seed();
    expect(codeOf(await ana.client.mutation(api.profile.update, { program: 'X' }).catch((e) => e))).toBe('FORBIDDEN');
    expect(codeOf(await t.mutation(api.profile.update, { program: 'X' }).catch((e) => e))).toBe('UNAUTHENTICATED');
  });
});

describe('profile.get', () => {
  it('gives the owner the whole badge, with the name and role of the member record', async () => {
    const { owner } = await seed();
    await owner.client.mutation(api.profile.update, { program: 'Sistemas', term: '7.º', institution: 'UNIAJC', group: 'AthenIA', badgeDesign: 'suizo', photoDataUrl: jpegOf(30) });
    await owner.client.mutation(api.members.updateSelf, { name: 'Jose Padilla', roleLabel: 'Becario de AthenIA' });
    const badge = await owner.client.query(api.profile.get, {});
    expect(badge).toMatchObject({
      name: 'Jose Padilla', roleLabel: 'Becario de AthenIA', isOwner: true, program: 'Sistemas', term: '7.º', institution: 'UNIAJC',
      group: 'AthenIA', badgeDesign: 'suizo', photoDataUrl: jpegOf(30),
    });
    expect(badge.since).toBeTypeOf('number');
    expect(badge.updatedAt).toBeTypeOf('number');
  });

  it('gives an invited person only their own name, role and date of joining', async () => {
    const { owner, ana } = await seed();
    await owner.client.mutation(api.profile.update, { program: 'Sistemas', badgeDesign: 'suizo', photoDataUrl: jpegOf(30) });
    const badge = await ana.client.query(api.profile.get, {});
    expect(badge).toMatchObject({ name: 'Ana', roleLabel: 'Directora', isOwner: false });
    expect(badge.since).toBeTypeOf('number');
    expect(Object.keys(badge).sort()).toEqual(['isOwner', 'name', 'roleLabel', 'since']);
  });

  it('needs an account', async () => {
    const { t } = await seed();
    expect(codeOf(await t.query(api.profile.get, {}).catch((e) => e))).toBe('UNAUTHENTICATED');
  });
});

describe('viewer.profile', () => {
  it('gives the read-only link the owner’s badge, and follows her edits', async () => {
    const { t, owner } = await seed();
    await owner.client.mutation(api.profile.update, { program: 'Sistemas', badgeDesign: 'poster' });
    const before = await t.query(api.viewer.profile, { shareToken: TOKEN });
    expect(before).toMatchObject({ isOwner: true, name: 'Dueña', program: 'Sistemas', badgeDesign: 'poster' });
    await owner.client.mutation(api.profile.update, { program: 'Software' });
    const after = await t.query(api.viewer.profile, { shareToken: TOKEN });
    expect(after.program).toBe('Software');
    expect(after.updatedAt).toBeGreaterThanOrEqual(before.updatedAt!);
  });

  it('rejects a wrong or disabled token without data', async () => {
    const { t, owner } = await seed();
    expect(codeOf(await t.query(api.viewer.profile, { shareToken: 'otro' }).catch((e) => e))).toBe('FORBIDDEN');
    await owner.client.mutation(api.settings.setShare, { enabled: false });
    expect(codeOf(await t.query(api.viewer.profile, { shareToken: TOKEN }).catch((e) => e))).toBe('FORBIDDEN');
  });
});

describe('privacy', () => {
  it('never puts an e-mail address in any badge', async () => {
    const { t, owner, ana } = await seed();
    await owner.client.mutation(api.profile.update, { program: 'Sistemas', group: 'AthenIA', institution: 'UNIAJC', photoDataUrl: jpegOf(300) });
    const badges = [
      await owner.client.query(api.profile.get, {}),
      await ana.client.query(api.profile.get, {}),
      await t.query(api.viewer.profile, { shareToken: TOKEN }),
    ];
    for (const badge of badges) expect(JSON.stringify(badge)).not.toContain('@');
  });
});
