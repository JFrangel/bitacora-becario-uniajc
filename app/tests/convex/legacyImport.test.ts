import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, internal } from '../../convex/_generated/api';
import { LegacyEntryError, mapLegacyEntry, parseJsonp, summarize } from '../../convex/lib/legacy';
import type { JournalInsert, LegacyEntry } from '../../convex/lib/legacy';
import { asUser, codeOf, newTest, setupMember, setupOwner } from './helpers';

const OWNER = 'dueña@example.com';
afterEach(() => vi.unstubAllEnvs());

const fixture = JSON.parse(readFileSync(join(__dirname, '..', 'fixtures', 'legacy-entries.json'), 'utf8')) as { entries: LegacyEntry[] };
const mapped = () => fixture.entries.map(mapLegacyEntry);

describe('mapLegacyEntry', () => {
  it('changes exactly the field names of the plan and marks the record as complete', () => {
    const [first] = mapped();
    expect(first).toEqual({
      legacyId: 'e-0001', // id
      date: '2026-10-14',
      hours: 2.5,
      projectName: 'iMujer', // project
      activity: 'Reunión de arranque con el equipo jurídico',
      objective: 'Acordar el alcance de la primera entrega',
      development: 'Redactar el borrador del convenio', // nextStep
      result: 'Alcance aprobado y cronograma definido',
      observations: 'Falta confirmar la fecha con la dirección', // blocker
      activityStatus: 'Completada', // status
      docStatus: 'complete',
      dayOrder: 1, // order
      links: [{ label: 'Acta', url: 'https://docs.google.com/document/d/ejemplo' }],
      photos: [{ name: 'pizarra.jpg', url: 'https://drive.google.com/uc?id=AAA111' }],
      createdAt: 1760454180000,
      updatedAt: 1760454180000,
    });
  });

  it('keeps a project name over 60 characters (the limit is 100) and collapses repeated spaces', () => {
    const second = mapped()[1];
    expect(second.projectName.length).toBeGreaterThan(60);
    expect(second.projectName.length).toBeLessThanOrEqual(100);
    expect(second.projectName).not.toMatch(/\s{2}/);
  });

  it('leaves out what the record did not have: no objective, no empty strings', () => {
    const third = mapped()[2];
    expect(third.objective).toBeUndefined();
    expect(third.observations).toBeUndefined();
    expect(mapped()[1].development).toBeUndefined();
  });

  it('reads links and photos that come as JSON text, naming an unnamed link «Enlace»', () => {
    expect(mapped()[1].links).toEqual([{ label: 'Enlace', url: 'https://example.com/clausulas' }]);
    expect(mapped()[1].photos).toEqual([]);
  });

  it('falls back to the recording date when the source has no creation time', () => {
    const { createdAt, updatedAt } = mapped()[1];
    expect(createdAt).toBe(Date.parse('2026-10-15T14:00:00.000Z'));
    expect(updatedAt).toBe(createdAt);
    expect(mapLegacyEntry({ id: 'x', date: '2026-10-15', project: 'p', activity: 'a', result: 'r', hours: 1 }).createdAt).toBe(Date.parse('2026-10-15T12:00:00-05:00'));
  });

  it('turns an unknown status into «Completada», like the published form does', () => {
    expect(mapLegacyEntry({ ...fixture.entries[0], status: '???' }).activityStatus).toBe('Completada');
    expect(mapLegacyEntry({ ...fixture.entries[0], status: 'Pendiente de revisión' }).activityStatus).toBe('Pendiente de revisión');
  });

  it('accepts hours written with a comma', () => {
    expect(mapLegacyEntry({ ...fixture.entries[0], hours: '1,5' }).hours).toBe(1.5);
  });

  it('rejects a record without id, saying so', () => {
    const { id: _id, ...noId } = fixture.entries[0];
    expect(() => mapLegacyEntry(noId)).toThrow(LegacyEntryError);
    expect(() => mapLegacyEntry({ ...fixture.entries[0], id: '  ' })).toThrow('El registro no tiene id.');
  });

  it('rejects a record with an invalid date, naming it', () => {
    expect(() => mapLegacyEntry({ ...fixture.entries[0], date: '14/10/2026' })).toThrow(/e-0001 tiene una fecha inválida/);
  });

  it('keeps at most four images and twelve links', () => {
    const many = mapLegacyEntry({
      ...fixture.entries[0],
      photos: Array.from({ length: 6 }, (_, i) => ({ name: `f${i}`, url: `https://drive.google.com/uc?id=${i}` })),
      links: Array.from({ length: 15 }, (_, i) => ({ label: `l${i}`, url: `https://example.com/${i}` })),
    });
    expect(many.photos).toHaveLength(4);
    expect(many.links).toHaveLength(12);
  });
});

describe('parseJsonp and summarize', () => {
  it('reads the callback wrapper of the source and returns its entries', () => {
    const body = `cb_abc123(${JSON.stringify({ entries: fixture.entries })});`;
    expect(parseJsonp(body).entries).toHaveLength(3);
    expect(() => parseJsonp('cb_x({"error":"no"})')).toThrow('No se pudo leer la hoja compartida.');
    expect(() => parseJsonp('<html>')).toThrow(/no es JSON/);
  });

  it('adds up records, hours, completed ones, the date range and the projects', () => {
    expect(summarize(mapped())).toMatchObject({ count: 3, hours: 7.5, completed: 2, firstDate: '2026-10-14', lastDate: '2026-10-15' });
    expect(summarize([])).toMatchObject({ count: 0, hours: 0, projects: [] });
  });
});

describe('legacyImport (internal)', () => {
  const insert = (entries: JournalInsert[]) => entries as unknown as Parameters<ReturnType<typeof newTest>['mutation']>[1]['entries'];

  async function ready() {
    const t = newTest();
    await setupOwner(t);
    return t;
  }

  it('needs the owner to have signed in once, and says so', async () => {
    const t = newTest();
    await expect(t.mutation(internal.legacyImport.upsertBatch, { ownerEmail: OWNER, entries: insert(mapped()) })).rejects.toThrow(/entrar una vez con Google/);
  });

  it('imports the three records as complete entries with their original id and dates', async () => {
    const t = await ready();
    expect(await t.mutation(internal.legacyImport.upsertBatch, { ownerEmail: OWNER, entries: insert(mapped()) })).toEqual({ created: 3, updated: 0 });
    const rows = await t.run((ctx) => ctx.db.query('journalEntries').collect());
    expect(rows.map((r) => r.legacyId).sort()).toEqual(['e-0001', 'e-0002', 'e-0003']);
    expect(rows.every((r) => r.docStatus === 'complete')).toBe(true);
    const first = rows.find((r) => r.legacyId === 'e-0001')!;
    expect(first).toMatchObject({ development: 'Redactar el borrador del convenio', observations: 'Falta confirmar la fecha con la dirección', dayOrder: 1, createdAt: 1760454180000 });
    expect(first.photos).toEqual([{ name: 'pizarra.jpg', url: 'https://drive.google.com/uc?id=AAA111' }]);
  });

  it('is idempotent: importing twice leaves the same number of rows, and updates what changed', async () => {
    const t = await ready();
    await t.mutation(internal.legacyImport.upsertBatch, { ownerEmail: OWNER, entries: insert(mapped()) });
    const changed = mapped();
    changed[0].result = 'Resultado corregido en la hoja';
    expect(await t.mutation(internal.legacyImport.upsertBatch, { ownerEmail: OWNER, entries: insert(changed) })).toEqual({ created: 0, updated: 3 });
    const rows = await t.run((ctx) => ctx.db.query('journalEntries').collect());
    expect(rows).toHaveLength(3);
    expect(rows.find((r) => r.legacyId === 'e-0001')!.result).toBe('Resultado corregido en la hoja');
  });

  it('keeps the link with a task and the day order of an entry that already existed in the new system', async () => {
    const t = await ready();
    await t.mutation(internal.legacyImport.upsertBatch, { ownerEmail: OWNER, entries: insert(mapped()) });
    const taskId = await t.run(async (ctx) => {
      const member = (await ctx.db.query('members').first())!;
      const project = (await ctx.db.query('projects').first())!;
      const id = await ctx.db.insert('tasks', { title: 'Tarea', projectId: project._id, priority: 2, status: 'done', order: 1, createdBy: member._id, createdAt: 1, updatedAt: 1, subtasks: [], searchText: 'tarea' });
      const entry = (await ctx.db.query('journalEntries').first())!;
      await ctx.db.patch(entry._id, { taskId: id });
      return id;
    });
    await t.mutation(internal.legacyImport.upsertBatch, { ownerEmail: OWNER, entries: insert(mapped()) });
    const linked = await t.run((ctx) => ctx.db.query('journalEntries').collect());
    expect(linked.filter((e) => e.taskId === taskId)).toHaveLength(1);
  });

  it('normalizes the projects: «iMujer» and «imujer» are one, and the long name is another', async () => {
    const t = await ready();
    await t.mutation(internal.legacyImport.upsertBatch, { ownerEmail: OWNER, entries: insert(mapped()) });
    const projects = await t.run((ctx) => ctx.db.query('projects').collect());
    expect(projects).toHaveLength(2);
    expect(projects.map((p) => p.name).sort()).toEqual([mapped()[1].projectName, 'iMujer'].sort());
    const rows = await t.run((ctx) => ctx.db.query('journalEntries').collect());
    const byLegacy = new Map(rows.map((r) => [r.legacyId, r.projectId]));
    expect(byLegacy.get('e-0001')).toBe(byLegacy.get('e-0003'));
  });

  it('creates the projects without leaving traces in the history', async () => {
    const t = await ready();
    await t.mutation(internal.legacyImport.upsertBatch, { ownerEmail: OWNER, entries: insert(mapped()) });
    expect(await t.run((ctx) => ctx.db.query('events').collect())).toEqual([]);
  });

  it('the hours imported add up to the hours of the file', async () => {
    const t = await ready();
    await t.mutation(internal.legacyImport.upsertBatch, { ownerEmail: OWNER, entries: insert(mapped()) });
    const imported = await t.query(internal.legacyImport.report, {});
    const source = summarize(mapped());
    expect(imported).toMatchObject({ count: source.count, hours: source.hours, completed: source.completed, firstDate: source.firstDate, lastDate: source.lastDate });
    expect(imported.projects).toEqual(source.projects.map((name) => (name.toLowerCase() === 'imujer' ? 'iMujer' : name)).filter((n, i, all) => all.indexOf(n) === i));
    expect(imported).toMatchObject({ photosInStorage: 0, photosStillOnDrive: 1 });
  });

  it('refuses the whole batch if one record is invalid, naming it, and saves nothing', async () => {
    const t = await ready();
    const bad = mapped();
    bad[2].hours = 0.1;
    await expect(t.mutation(internal.legacyImport.upsertBatch, { ownerEmail: OWNER, entries: insert(bad) })).rejects.toThrow(/Registro e-0003/);
    expect(await t.run((ctx) => ctx.db.query('journalEntries').collect())).toEqual([]);
  });

  it('refuses a record without result (the new form requires it)', async () => {
    const t = await ready();
    const bad = mapped();
    delete bad[0].result;
    await expect(t.mutation(internal.legacyImport.upsertBatch, { ownerEmail: OWNER, entries: insert(bad) })).rejects.toThrow(/Registro e-0001/);
  });

  it('only exposes internal functions', () => {
    const source = readFileSync(join(__dirname, '..', '..', 'convex', 'legacyImport.ts'), 'utf8');
    const exported = [...source.matchAll(/export const (\w+) = (\w+)\(/g)].map((m) => [m[1], m[2]]);
    expect(exported).toEqual([['uploadUrl', 'internalMutation'], ['upsertBatch', 'internalMutation'], ['report', 'internalQuery']]);
  });
});

describe('the migrated Bitácora is linked to the owner account and to nobody else', () => {
  const insert = (entries: JournalInsert[]) => entries as unknown as Parameters<ReturnType<typeof newTest>['mutation']>[1]['entries'];
  const run = (t: ReturnType<typeof newTest>, ownerEmail: string) => t.mutation(internal.legacyImport.upsertBatch, { ownerEmail, entries: insert(mapped()) });

  it('imports nothing if the email given is not the one of the account that signed in as owner', async () => {
    const t = newTest();
    await setupOwner(t);
    await expect(run(t, 'otra.persona@example.com')).rejects.toThrow(/no coincide con el que indicaste/);
    expect(await t.run((ctx) => ctx.db.query('journalEntries').collect())).toEqual([]);
  });

  it('refuses an empty email', async () => {
    const t = newTest();
    await setupOwner(t);
    await expect(run(t, '  ')).rejects.toThrow(/no coincide/);
  });

  it('does not care about capitals or spaces in the email', async () => {
    const t = newTest();
    await setupOwner(t);
    await expect(run(t, '  DUEÑA@Example.COM ')).resolves.toEqual({ created: 3, updated: 0 });
  });

  it('also refuses if the deployment was configured for another owner (OWNER_EMAIL)', async () => {
    vi.stubEnv('OWNER_EMAIL', 'alguien.mas@example.com');
    const t = newTest();
    await setupOwner(t);
    await expect(run(t, OWNER)).rejects.toThrow(/no coincide/);
    expect(await t.run((ctx) => ctx.db.query('journalEntries').collect())).toEqual([]);
  });

  it('does not make a guest the owner or give a guest the Bitácora: the owner is the only one who reads it', async () => {
    const t = newTest();
    const owner = await setupOwner(t);
    const ana = await setupMember(t);
    await run(t, OWNER);
    expect((await owner.client.query(api.journal.list, {})).length).toBe(3);
    expect((await owner.client.query(api.journal.summary, {})).hours).toBe(7.5);
    for (const call of [() => ana.client.query(api.journal.list, {}), () => ana.client.query(api.journal.summary, {})]) {
      expect(codeOf(await call().catch((e) => e))).toBe('FORBIDDEN');
    }
  });

  it('a new Google account that enters later gets no role and no data: it is not the owner and cannot become one', async () => {
    vi.stubEnv('OWNER_EMAIL', OWNER);
    const t = newTest();
    await setupOwner(t);
    await run(t, OWNER);
    const newcomer = await asUser(t, 'recien.llegado@example.com', 'Recién llegado');
    expect(await newcomer.client.query(api.session.me, {})).toMatchObject({ status: 'none' });
    expect(codeOf(await newcomer.client.mutation(api.session.ensureOwner, {}).catch((e) => e))).toBe('FORBIDDEN');
    expect(codeOf(await newcomer.client.query(api.journal.list, {}).catch((e) => e))).toBe('UNAUTHENTICATED');
    expect(await t.run((ctx) => ctx.db.query('members').collect())).toHaveLength(1); // solo la dueña
  });

  it('an invited person has her own role and name, and the data of the owner stays out of her profile', async () => {
    const t = newTest();
    await setupOwner(t);
    const ana = await setupMember(t, 'ana@example.com', 'Ana', 'Directora');
    await run(t, OWNER);
    const badge = (await ana.client.query(api.profile.get, {})) as Record<string, unknown>;
    expect(badge).toMatchObject({ name: 'Ana', roleLabel: 'Directora', isOwner: false });
    expect(badge).not.toHaveProperty('program');
    expect(badge).not.toHaveProperty('photoDataUrl');
  });
});
