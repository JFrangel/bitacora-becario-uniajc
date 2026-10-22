import { describe, expect, it } from 'vitest';
import { api } from '../../convex/_generated/api';
import { HOURS_MESSAGE } from '../../convex/lib/hours';
import { codeOf, newTest, setupMember, setupOwner } from './helpers';

const messageOf = (e: unknown) => (e as { data?: { message?: string } }).data?.message;

const base = {
  date: '2026-10-20',
  hours: '2',
  projectName: 'iMujer',
  activity: 'Revisión inicial de la plataforma',
  result: 'Identifiqué los documentos pendientes',
  activityStatus: 'Completada' as const,
};

async function seed() {
  const t = newTest();
  const owner = await setupOwner(t);
  const ana = await setupMember(t);
  const create = (fields: Record<string, unknown> = {}) => owner.client.mutation(api.journal.createManual, { fields: { ...base, ...fields } as never });
  const list = (args: Record<string, unknown> = {}) => owner.client.query(api.journal.list, args as never);
  const entry = (id: unknown) => t.run((ctx) => ctx.db.get(id as never)) as Promise<Record<string, any> | null>;
  const events = async (type: string) => (await t.run((ctx) => ctx.db.query('events').collect())).filter((e) => e.type === type);
  const upload = (type = 'image/jpeg', size = 10) => t.run((ctx) => ctx.storage.store(new Blob(['x'.repeat(size)], { type })));
  const stored = (id: unknown) => t.run(async (ctx) => (await ctx.db.system.get(id as never)) !== null);
  /** Un borrador como el que crea la Tarea A10: tarea de la dueña que se completa. */
  const draft = async (title = 'Tarea completada') => {
    const taskId = await owner.client.mutation(api.tasks.create, { title, projectName: 'iMujer', assigneeId: owner.memberId, description: 'Objetivo copiado' });
    await owner.client.mutation(api.tasks.move, { id: taskId, status: 'done' });
    const found = (await list({ onlyDrafts: true })).find((e) => e.taskId === taskId)!;
    return { taskId, id: found.id };
  };
  return { t, owner, ana, create, list, entry, events, upload, stored, draft };
}

describe('journal.createManual', () => {
  it('is born complete, with a parsed number of hours and the next position of its day', async () => {
    const { create, list, owner } = await seed();
    const first = await create({ hours: '0,5' });
    const second = await create({ objective: 'Meta', development: 'Pasos', observations: 'Nota' });
    const entries = await list();
    expect(entries).toHaveLength(2);
    const a = entries.find((e) => e.id === first)!;
    const b = entries.find((e) => e.id === second)!;
    expect(a).toMatchObject({ docStatus: 'complete', isDraft: false, hours: 0.5, projectName: 'iMujer', date: '2026-10-20', activityStatus: 'Completada', links: [], photos: [] });
    expect(b).toMatchObject({ objective: 'Meta', development: 'Pasos', observations: 'Nota' });
    expect(b.dayOrder).toBeGreaterThan(a.dayOrder);
    expect(Object.keys(a)).not.toContain('objective');
    expect(owner.memberId).toBeDefined();
  });

  it.each(['0,25', '0.5', '1,75', '2', '24'])('accepts %s hours', async (hours) => {
    const { create } = await seed();
    await expect(create({ hours })).resolves.toBeDefined();
  });

  it.each(['0', '0,1', '0,3', '24,25', '25', 'abc', '', '-1', '1,2,3'])('rejects %s hours with the exact message', async (hours) => {
    const { create, list } = await seed();
    const error = await create({ hours }).catch((e) => e);
    expect(codeOf(error)).toBe('VALIDATION');
    expect(messageOf(error)).toBe(HOURS_MESSAGE);
    expect(await list()).toHaveLength(0);
  });

  it.each([
    ['empty result', { result: '   ' }],
    ['empty activity', { activity: '' }],
    ['empty project', { projectName: '  ' }],
    ['impossible date', { date: '2026-02-30' }],
  ])('rejects %s with the required-fields message', async (_name, patch) => {
    const { create } = await seed();
    expect(messageOf(await create(patch).catch((e) => e))).toBe(HOURS_MESSAGE);
  });

  it('limits each text field to 1500 characters and the project to 100', async () => {
    const { create } = await seed();
    for (const field of ['activity', 'objective', 'development', 'result', 'observations']) {
      expect(codeOf(await create({ [field]: 'x'.repeat(1501) }).catch((e) => e)), field).toBe('VALIDATION');
      await expect(create({ [field]: 'x'.repeat(1500) })).resolves.toBeDefined();
    }
    expect(codeOf(await create({ projectName: 'p'.repeat(101) }).catch((e) => e))).toBe('VALIDATION');
  });
});

describe('links and images', () => {
  it('keeps up to 12 links, rejects the 13th, and only accepts http or https', async () => {
    const { create, list } = await seed();
    const links = (n: number) => Array.from({ length: n }, (_, i) => ({ label: `L${i}`, url: `https://example.com/${i}` }));
    await create({ links: links(12) });
    expect((await list())[0].links).toHaveLength(12);
    expect(codeOf(await create({ links: links(13) }).catch((e) => e))).toBe('VALIDATION');
    for (const url of ['javascript:alert(1)', 'ftp://example.com/a', 'example.com', 'data:text/html,hola', '//example.com']) {
      expect(messageOf(await create({ links: [{ label: 'x', url }] }).catch((e) => e)), url).toBe('Usa un enlace que comience con http:// o https://.');
    }
    expect(messageOf(await create({ links: [{ label: 'x', url: '  ' }] }).catch((e) => e))).toBe('Completa la dirección web del enlace.');
  });

  it('uses the domain when the link name is empty and limits names to 80 characters', async () => {
    const { create, list } = await seed();
    await create({ links: [{ url: 'https://www.secop.gov.co/ruta?x=1' }, { label: '   ', url: 'http://docs.example.com/a' }] });
    expect((await list())[0].links.map((l) => l.label)).toEqual(['www.secop.gov.co', 'docs.example.com']);
    expect(codeOf(await create({ links: [{ label: 'n'.repeat(81), url: 'https://example.com' }] }).catch((e) => e))).toBe('VALIDATION');
  });

  it('allows 4 images, rejects the 5th, and rejects files that are not images', async () => {
    const { create, list, upload } = await seed();
    const photo = async (name: string) => ({ storageId: await upload(), thumbStorageId: await upload(), name });
    const four = await Promise.all(['a', 'b', 'c', 'd'].map(photo));
    await create({ photos: four });
    const saved = (await list())[0].photos;
    expect(saved).toHaveLength(4);
    expect(saved[0]).toMatchObject({ name: 'a', storageId: four[0].storageId, thumbStorageId: four[0].thumbStorageId });
    expect(saved[0].url).toMatch(/^https?:\/\//);
    expect(saved[0].thumbUrl).toMatch(/^https?:\/\//);
    const five = [...four, await photo('e')];
    expect(messageOf(await create({ photos: five }).catch((e) => e))).toBe('Puedes adjuntar hasta 4 imágenes por registro.');
    const pdf = { storageId: await upload('application/pdf'), name: 'doc.pdf' };
    expect(messageOf(await create({ photos: [pdf] }).catch((e) => e))).toBe('Se omitió un archivo que no es una imagen.');
    const huge = { storageId: await upload('image/jpeg', 5 * 1024 * 1024 + 1), name: 'grande.jpg' };
    expect(messageOf(await create({ photos: [huge] }).catch((e) => e))).toBe('grande.jpg supera el límite de 5 MB.');
  });
});

describe('drafts: documentDraft and summary', () => {
  it('turns a draft into a complete record and only then counts its hours', async () => {
    const { owner, list, draft, events } = await seed();
    const { id } = await draft('Redactar informe');
    const before = await owner.client.query(api.journal.summary, {});
    expect(before).toEqual({ activities: 0, hours: 0, completed: 0, drafts: 1 });
    const [entry] = await list();
    expect(entry).toMatchObject({ isDraft: true, docStatus: 'draft', activity: 'Redactar informe', objective: 'Objetivo copiado' });
    expect(entry.hours).toBeUndefined();

    await owner.client.mutation(api.journal.documentDraft, { id, fields: { ...base, hours: '1,5', activity: 'Redactar informe', objective: 'Objetivo copiado' } });
    const [done] = await list();
    expect(done).toMatchObject({ isDraft: false, docStatus: 'complete', hours: 1.5, result: base.result });
    expect(await owner.client.query(api.journal.summary, {})).toEqual({ activities: 1, hours: 1.5, completed: 1, drafts: 0 });
    const documented = await events('journal.documented');
    expect(documented).toHaveLength(1);
    expect(documented[0].visibility).toBe('owner');
  });

  it('keeps the draft untouched when hours or result are missing, and refuses to document a complete record', async () => {
    const { owner, list, draft, create } = await seed();
    const { id } = await draft();
    for (const patch of [{ result: '' }, { hours: '' }, { hours: '30' }]) {
      const error = await owner.client.mutation(api.journal.documentDraft, { id, fields: { ...base, ...patch } }).catch((e) => e);
      expect(messageOf(error)).toBe(HOURS_MESSAGE);
    }
    expect((await list())[0].isDraft).toBe(true);
    const complete = await create();
    const error = await owner.client.mutation(api.journal.documentDraft, { id: complete, fields: base }).catch((e) => e);
    expect(codeOf(error)).toBe('VALIDATION');
  });

  it('counts activities and completed only for complete records, and sums hours of complete ones', async () => {
    const { owner, create, draft } = await seed();
    await create({ hours: '2' });
    await create({ hours: '1,25', activityStatus: 'En progreso' });
    await create({ hours: '0,5', activityStatus: 'Pendiente de revisión' });
    await draft('Uno');
    await draft('Dos');
    expect(await owner.client.query(api.journal.summary, {})).toEqual({ activities: 3, hours: 3.75, completed: 1, drafts: 2 });
  });
});

describe('journal.update and journal.remove', () => {
  it('edits a complete record, logs journal.edited with the changed fields, and does nothing when nothing changed', async () => {
    const { owner, create, list, events } = await seed();
    const id = await create();
    await owner.client.mutation(api.journal.update, { id, fields: { ...base, hours: '3', result: 'Resultado nuevo' } });
    const [entry] = await list();
    expect(entry).toMatchObject({ hours: 3, result: 'Resultado nuevo' });
    const edits = await events('journal.edited');
    expect(edits).toHaveLength(1);
    expect(edits[0].visibility).toBe('owner');
    expect(edits[0].detail.fields.sort()).toEqual(['hours', 'result']);
    await owner.client.mutation(api.journal.update, { id, fields: { ...base, hours: '3', result: 'Resultado nuevo' } });
    expect(await events('journal.edited')).toHaveLength(1);
  });

  it('refuses to update a draft (it is completed with documentDraft)', async () => {
    const { owner, draft } = await seed();
    const { id } = await draft();
    expect(codeOf(await owner.client.mutation(api.journal.update, { id, fields: base }).catch((e) => e))).toBe('VALIDATION');
  });

  it('puts a record moved to another date at the end of that day', async () => {
    const { owner, create, list } = await seed();
    const moved = await create();
    await create({ date: '2026-10-21' });
    const last = await create({ date: '2026-10-21' });
    await owner.client.mutation(api.journal.update, { id: moved, fields: { ...base, date: '2026-10-21' } });
    const day = (await list()).filter((e) => e.date === '2026-10-21');
    expect(day.map((e) => e.id).at(-1)).toBe(moved);
    expect(day.find((e) => e.id === last)!.dayOrder).toBeLessThan(day.find((e) => e.id === moved)!.dayOrder);
  });

  it('deletes the files of images that are removed from a record', async () => {
    const { owner, create, upload, stored, list } = await seed();
    const keep = { storageId: await upload(), thumbStorageId: await upload(), name: 'keep.jpg' };
    const drop = { storageId: await upload(), thumbStorageId: await upload(), name: 'drop.jpg' };
    const id = await create({ photos: [keep, drop] });
    await owner.client.mutation(api.journal.update, { id, fields: { ...base, photos: [keep] } });
    expect((await list())[0].photos.map((p) => p.name)).toEqual(['keep.jpg']);
    expect(await stored(keep.storageId)).toBe(true);
    expect(await stored(drop.storageId)).toBe(false);
    expect(await stored(drop.thumbStorageId)).toBe(false);
  });

  it('removes the record, its files, logs journal.deleted, and does not bring the draft back', async () => {
    const { owner, t, create, upload, stored, events, entry } = await seed();
    const photo = { storageId: await upload(), thumbStorageId: await upload(), name: 'a.jpg' };
    const id = await create({ photos: [photo] });
    await owner.client.mutation(api.journal.remove, { id });
    expect(await entry(id)).toBeNull();
    expect(await stored(photo.storageId)).toBe(false);
    expect(await stored(photo.thumbStorageId)).toBe(false);
    const deleted = await events('journal.deleted');
    expect(deleted).toHaveLength(1);
    expect(deleted[0]).toMatchObject({ visibility: 'owner', subjectTitle: base.activity });
    expect(await t.run((ctx) => ctx.db.query('journalEntries').collect())).toHaveLength(0);
  });

  it('reports NOT_FOUND for a record that no longer exists', async () => {
    const { owner, t, create } = await seed();
    const id = await create();
    await t.run((ctx) => ctx.db.delete(id));
    for (const call of [
      () => owner.client.mutation(api.journal.update, { id, fields: base }),
      () => owner.client.mutation(api.journal.remove, { id }),
      () => owner.client.mutation(api.journal.documentDraft, { id, fields: base }),
    ]) {
      expect(codeOf(await call().catch((e) => e))).toBe('NOT_FOUND');
    }
  });
});

describe('journal.list', () => {
  it('orders by date descending, then manual order, then last update', async () => {
    const { owner, create, list } = await seed();
    const old = await create({ date: '2026-10-18', activity: 'Antigua' });
    const a = await create({ date: '2026-10-20', activity: 'A' });
    const b = await create({ date: '2026-10-20', activity: 'B' });
    const recent = await create({ date: '2026-10-21', activity: 'Reciente' });
    expect((await list()).map((e) => e.id)).toEqual([recent, a, b, old]);
    await owner.client.mutation(api.journal.reorder, { date: '2026-10-20', orderedIds: [b, a] });
    expect((await list()).map((e) => e.id)).toEqual([recent, b, a, old]);
  });

  it('filters by text (ignoring accents), project, activity status and drafts', async () => {
    const { create, list, draft } = await seed();
    await create({ activity: 'Análisis Jurídico', projectName: 'Legal', result: 'Contrato revisado' });
    await create({ activity: 'Landing', projectName: 'Web', activityStatus: 'En progreso', observations: 'pendiente de logo' });
    await draft('Borrador de prueba');
    expect((await list({ q: 'analisis' })).map((e) => e.activity)).toEqual(['Análisis Jurídico']);
    expect((await list({ q: 'contrato revisado' })).map((e) => e.activity)).toEqual(['Análisis Jurídico']);
    expect((await list({ q: 'LOGO' })).map((e) => e.activity)).toEqual(['Landing']);
    expect((await list({ activityStatus: 'En progreso' })).map((e) => e.activity)).toEqual(['Landing']);
    expect((await list({ onlyDrafts: true })).map((e) => e.activity)).toEqual(['Borrador de prueba']);
    const projects = await list();
    const web = projects.find((e) => e.projectName === 'Web')!;
    expect((await list({ projectId: web.projectId })).map((e) => e.activity)).toEqual(['Landing']);
  });

  it('shows a note when the linked task was deleted, and keeps the title', async () => {
    const { owner, draft, list } = await seed();
    const { taskId } = await draft('Se borrará');
    await owner.client.mutation(api.tasks.remove, { id: taskId });
    const [entry] = await list();
    expect(entry).toMatchObject({ taskDeleted: true, taskTitle: 'Se borrará', activity: 'Se borrará' });
    expect(entry.taskId).toBeUndefined();
  });
});

describe('journal.reorder', () => {
  it('only reorders inside one day and needs exactly that day’s records', async () => {
    const { owner, create } = await seed();
    const a = await create({ date: '2026-10-20' });
    const b = await create({ date: '2026-10-20' });
    const other = await create({ date: '2026-10-21' });
    const run = (orderedIds: unknown[]) => owner.client.mutation(api.journal.reorder, { date: '2026-10-20', orderedIds: orderedIds as never }).catch((e) => e);
    expect(codeOf(await run([a, other]))).toBe('VALIDATION');
    expect(codeOf(await run([a]))).toBe('VALIDATION');
    expect(codeOf(await run([a, a]))).toBe('VALIDATION');
    expect(await run([b, a])).toBeNull();
  });
});

describe('permissions: only the owner', () => {
  it('rejects invited people with FORBIDDEN and anonymous callers with UNAUTHENTICATED on every function', async () => {
    const { t, ana, create, draft } = await seed();
    const id = await create();
    const { id: draftId } = await draft();
    const calls: Array<[string, (c: typeof ana.client) => Promise<unknown>]> = [
      ['createManual', (c) => c.mutation(api.journal.createManual, { fields: base })],
      ['update', (c) => c.mutation(api.journal.update, { id, fields: base })],
      ['documentDraft', (c) => c.mutation(api.journal.documentDraft, { id: draftId, fields: base })],
      ['remove', (c) => c.mutation(api.journal.remove, { id })],
      ['reorder', (c) => c.mutation(api.journal.reorder, { date: base.date, orderedIds: [id] })],
      ['list', (c) => c.query(api.journal.list, {})],
      ['summary', (c) => c.query(api.journal.summary, {})],
      ['generateUploadUrl', (c) => c.mutation(api.files.generateUploadUrl, {})],
    ];
    for (const [name, call] of calls) {
      expect(codeOf(await call(ana.client).catch((e) => e)), `${name} (invitada)`).toBe('FORBIDDEN');
      expect(codeOf(await call(t as never).catch((e) => e)), `${name} (sin sesión)`).toBe('UNAUTHENTICATED');
    }
  });

  it('gives the owner an upload URL', async () => {
    const { owner } = await seed();
    expect(await owner.client.mutation(api.files.generateUploadUrl, {})).toMatch(/^https?:\/\//);
  });
});
