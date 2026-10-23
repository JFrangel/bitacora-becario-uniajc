import { describe, expect, it, vi } from 'vitest';
import { api } from '../../convex/_generated/api';
import { codeOf, enableShare, newTest, setupMember, setupOwner } from './helpers';

const TOKEN = 'tok-lectura';
const JPEG = 'data:image/jpeg;base64,';
const PNG = 'data:image/png;base64,';

/** Una imagen de `bytes` bytes ya codificada: base64 válido de ceros, con su relleno. */
const jpegOf = (bytes: number) => {
  const padding = (3 - (bytes % 3)) % 3;
  return `${JPEG}${'A'.repeat(4 * Math.ceil(bytes / 3) - padding)}${'='.repeat(padding)}`;
};
const pngOf = (bytes: number) => {
  const padding = (3 - (bytes % 3)) % 3;
  return `${PNG}${'A'.repeat(4 * Math.ceil(bytes / 3) - padding)}${'='.repeat(padding)}`;
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
    ['frontDescription', 120],
    ['backTitle', 60],
    ['backDescription', 120],
    ['backFooter', 60],
  ])('%s admits %i characters and rejects one more', async (field, max) => {
    const { owner } = await seed();
    await expect(owner.client.mutation(api.profile.update, { [field]: 'x'.repeat(max) } as never)).resolves.toBeNull();
    const error = await owner.client.mutation(api.profile.update, { [field]: 'x'.repeat(max + 1) } as never).catch((e) => e);
    expect(codeOf(error)).toBe('VALIDATION');
  });

  it('trims the text and clears a field with an empty string', async () => {
    const { owner } = await seed();
    await owner.client.mutation(api.profile.update, { program: '  Ingeniería de Sistemas  ', term: '7.º', frontDescription: ' IA aplicada ' });
    expect(await owner.client.query(api.profile.get, {})).toMatchObject({ program: 'Ingeniería de Sistemas', term: '7.º', frontDescription: 'IA aplicada' });
    await owner.client.mutation(api.profile.update, { program: '   ', frontDescription: '   ' });
    const badge = await owner.client.query(api.profile.get, {});
    expect('program' in badge).toBe(false);
    expect(badge).toMatchObject({ term: '7.º', frontDescription: '' });
  });

  it('only changes the fields that are sent', async () => {
    const { owner } = await seed();
    await owner.client.mutation(api.profile.update, { program: 'Sistemas', group: 'AthenIA', frontDescription: 'IA aplicada' });
    await owner.client.mutation(api.profile.update, { term: '7.º' });
    expect(await owner.client.query(api.profile.get, {})).toMatchObject({ program: 'Sistemas', group: 'AthenIA', frontDescription: 'IA aplicada', term: '7.º' });
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

  it('stores and removes a transparent group logo within its document-safe limit', async () => {
    const { owner } = await seed();
    await owner.client.mutation(api.profile.update, { groupLogoDataUrl: pngOf(184320) });
    expect((await owner.client.query(api.profile.get, {})).groupLogoDataUrl).toBe(pngOf(184320));
    await owner.client.mutation(api.profile.update, { groupLogoDataUrl: null });
    expect('groupLogoDataUrl' in (await owner.client.query(api.profile.get, {}))).toBe(false);
  });

  it('rejects unsupported, malformed or oversized group logos', async () => {
    const { owner } = await seed();
    for (const value of [jpegOf(184321), 'data:image/gif;base64,AAAA', 'data:image/png;base64,AA$A', 'data:image/png;base64,']) {
      expect(codeOf(await owner.client.mutation(api.profile.update, { groupLogoDataUrl: value }).catch((e) => e))).toBe('VALIDATION');
    }
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

  it('lets an invited person edit only their own badge data', async () => {
    const { owner, ana } = await seed();
    await owner.client.mutation(api.profile.update, { program: 'Datos de la propietaria', group: 'Equipo principal' });
    await ana.client.mutation(api.profile.update, { program: 'Ingeniería de Sistemas', term: '8.º semestre', group: 'AthenIA', photoDataUrl: jpegOf(30) });

    expect(await ana.client.query(api.profile.get, {})).toMatchObject({
      name: 'Ana', roleLabel: 'Directora', isOwner: false, program: 'Ingeniería de Sistemas', term: '8.º semestre', group: 'AthenIA', photoDataUrl: jpegOf(30),
    });
    expect(await owner.client.query(api.profile.get, {})).toMatchObject({ program: 'Datos de la propietaria', group: 'Equipo principal' });
  });

  it('links the owner’s legacy single profile on the first edit without losing its data', async () => {
    const { t, owner } = await seed();
    const oldId = await t.run(async (ctx) => {
      const profile = (await ctx.db.query('profile').collect())[0];
      await ctx.db.patch(profile._id, { memberId: undefined, program: 'Datos anteriores', group: 'AthenIA' });
      return profile._id;
    });
    await owner.client.mutation(api.profile.update, { term: '10.º semestre' });
    const profiles = await t.run((ctx) => ctx.db.query('profile').collect());
    expect(profiles).toHaveLength(1);
    expect(profiles[0]).toMatchObject({ _id: oldId, memberId: owner.memberId, program: 'Datos anteriores', group: 'AthenIA', term: '10.º semestre' });
  });

  it('requires an active member and rejects attempts to select someone else’s profile', async () => {
    const { t, ana, owner } = await seed();
    expect(codeOf(await t.mutation(api.profile.update, { program: 'X' }).catch((e) => e))).toBe('UNAUTHENTICATED');
    await expect(ana.client.mutation(api.profile.update, { memberId: owner.memberId, program: 'X' } as never)).rejects.toThrow('Unexpected field `memberId`');
    expect((await owner.client.query(api.profile.get, {})).program).toBeUndefined();
  });
});

describe('profile.get', () => {
  it('gives the owner the whole badge, with the name and role of the member record', async () => {
    const { owner } = await seed();
    await owner.client.mutation(api.profile.update, { program: 'Sistemas', term: '7.º', institution: 'UNIAJC', group: 'AthenIA', frontDescription: 'IA aplicada', badgeDesign: 'suizo', photoDataUrl: jpegOf(30) });
    await owner.client.mutation(api.members.updateSelf, { name: 'Jose Padilla', roleLabel: 'Becario de AthenIA' });
    const badge = await owner.client.query(api.profile.get, {});
    expect(badge).toMatchObject({
      name: 'Jose Padilla', roleLabel: 'Becario de AthenIA', isOwner: true, program: 'Sistemas', term: '7.º', institution: 'UNIAJC',
      group: 'AthenIA', frontDescription: 'IA aplicada', badgeDesign: 'suizo', photoDataUrl: jpegOf(30),
    });
    expect(badge.since).toBeTypeOf('number');
    expect(badge.updatedAt).toBeTypeOf('number');
  });

  it('gives an invited person their own profile and date of joining', async () => {
    const { owner, ana } = await seed();
    await owner.client.mutation(api.profile.update, { program: 'Sistemas', badgeDesign: 'suizo', photoDataUrl: jpegOf(30) });
    await ana.client.mutation(api.profile.update, { program: 'Diseño', group: 'AthenIA' });
    const badge = await ana.client.query(api.profile.get, {});
    expect(badge).toMatchObject({ name: 'Ana', roleLabel: 'Directora', isOwner: false, program: 'Diseño', group: 'AthenIA' });
    expect(badge.since).toBeTypeOf('number');
    expect(JSON.stringify(badge)).not.toContain('suizo');
    expect(JSON.stringify(badge)).not.toContain('Sistemas');
  });

  it('needs an account', async () => {
    const { t } = await seed();
    expect(codeOf(await t.query(api.profile.get, {}).catch((e) => e))).toBe('UNAUTHENTICATED');
  });
});

describe('viewer.profile', () => {
  it('gives the read-only link the owner’s badge, and follows her edits', async () => {
    const { t, owner } = await seed();
    await owner.client.mutation(api.profile.update, { program: 'Sistemas', frontDescription: 'IA aplicada', badgeDesign: 'poster' });
    const before = await t.query(api.viewer.profile, { shareToken: TOKEN });
    expect(before).toMatchObject({ isOwner: true, name: 'Dueña', program: 'Sistemas', frontDescription: 'IA aplicada', badgeDesign: 'poster' });
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

describe('individual profile sharing', () => {
  it('creates a separate hashed link and exposes only the default public fields', async () => {
    const { t, owner } = await seed();
    await owner.client.mutation(api.profile.update, {
      program: 'Ingeniería de Sistemas', term: '10.º semestre', institution: 'UNIAJC', group: 'AthenIA', photoDataUrl: jpegOf(30),
      groupLogoDataUrl: pngOf(30), backTitle: 'AthenIA Centro', backDescription: 'IA aplicada', backFooter: 'Cali, Colombia',
    });
    const { token } = await owner.client.mutation(api.profile.createShareLink, { showPhoto: false, showAcademic: false });
    const shared = await t.query(api.viewer.sharedProfile, { token });
    expect(shared).toEqual({ name: 'Dueña', roleLabel: 'Becaria', institution: 'UNIAJC', group: 'AthenIA' });
    const saved = await t.run((ctx) => ctx.db.query('profile').withIndex('by_memberId', (q) => q.eq('memberId', owner.memberId)).unique());
    expect(saved?.shareTokenHash).not.toBe(token);
    expect(saved).toMatchObject({ shareEnabled: true, sharePhoto: false, shareAcademic: false });
    expect(JSON.stringify(shared)).not.toContain('@');
    expect(JSON.stringify(shared)).not.toContain('Ingeniería');
    expect(JSON.stringify(shared)).not.toContain('data:image');
    expect(JSON.stringify(shared)).not.toContain('AthenIA Centro');
  });

  it('lets the owner opt in to photo and academic data, then hide them without changing the link', async () => {
    const { t, ana } = await seed();
    await ana.client.mutation(api.profile.update, { program: 'Ingeniería de Sistemas', term: '8.º semestre', photoDataUrl: jpegOf(30) });
    const { token } = await ana.client.mutation(api.profile.createShareLink, { showPhoto: true, showAcademic: true });
    expect(await t.query(api.viewer.sharedProfile, { token })).toMatchObject({
      name: 'Ana', program: 'Ingeniería de Sistemas', term: '8.º semestre', photoDataUrl: jpegOf(30),
    });
    await ana.client.mutation(api.profile.updateShareVisibility, { showPhoto: false });
    await ana.client.mutation(api.profile.updateShareVisibility, { showAcademic: false });
    expect(await t.query(api.viewer.sharedProfile, { token })).toEqual({ name: 'Ana', roleLabel: 'Directora' });
    expect((await ana.client.query(api.profile.shareSettings, {}))).toEqual({ enabled: true, showPhoto: false, showAcademic: false });
  });

  it('regeneration and revocation invalidate old links, and unauthenticated callers cannot manage links', async () => {
    const { t, owner } = await seed();
    expect(codeOf(await t.mutation(api.profile.createShareLink, { showPhoto: false, showAcademic: false }).catch((e) => e))).toBe('UNAUTHENTICATED');
    const first = await owner.client.mutation(api.profile.createShareLink, { showPhoto: false, showAcademic: false });
    const second = await owner.client.mutation(api.profile.createShareLink, { showPhoto: false, showAcademic: false });
    expect(second.token).not.toBe(first.token);
    expect(await t.query(api.viewer.sharedProfile, { token: first.token })).toBeNull();
    expect(await t.query(api.viewer.sharedProfile, { token: second.token })).toMatchObject({ name: 'Dueña' });
    await owner.client.mutation(api.profile.revokeShareLink, {});
    expect(await t.query(api.viewer.sharedProfile, { token: second.token })).toBeNull();
    expect(await owner.client.query(api.profile.shareSettings, {})).toEqual({ enabled: false, showPhoto: false, showAcademic: false });
  });

  it('does not let a member edit another person\'s link, and retiring access invalidates their public link', async () => {
    const { t, owner, ana } = await seed();
    const { token } = await ana.client.mutation(api.profile.createShareLink, { showPhoto: false, showAcademic: false });
    const ownerLink = await owner.client.mutation(api.profile.createShareLink, { showPhoto: false, showAcademic: false });
    await owner.client.mutation(api.profile.revokeShareLink, {});
    expect(await t.query(api.viewer.sharedProfile, { token: ownerLink.token })).toBeNull();
    expect(await t.query(api.viewer.sharedProfile, { token })).toMatchObject({ name: 'Ana' });
    await owner.client.mutation(api.members.revoke, { memberId: ana.memberId });
    expect(await t.query(api.viewer.sharedProfile, { token })).toBeNull();
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
