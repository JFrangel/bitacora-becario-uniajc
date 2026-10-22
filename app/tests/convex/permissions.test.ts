import { describe, expect, it } from 'vitest';
import { api } from '../../convex/_generated/api';
import { codeOf, enableShare, newTest, setupMember, setupOwner } from './helpers';

type Who = 'owner' | 'member' | 'viewer';
const WHO: Who[] = ['owner', 'member', 'viewer'];
const TOKEN = 'tok-lectura';

const form = (patch: Record<string, unknown> = {}) => ({
  date: '2026-10-15', hours: '2', projectName: 'iMujer', activity: 'Actividad', result: 'Resultado', activityStatus: 'Completada' as const, ...patch,
});

/**
 * Una dueña, una persona invitada y un enlace de solo lectura (por defecto: con Bitácora, sin descripciones).
 * La dueña tiene dos tareas completadas: una con borrador y otra ya documentada (1,5 h); la persona invitada, una completada.
 */
async function seed(share: { includesJournal?: boolean; showsDescriptions?: boolean } = {}) {
  const t = newTest();
  const owner = await setupOwner(t);
  const ana = await setupMember(t);
  await enableShare(t, TOKEN, share);
  const done = async (client: typeof owner.client, args: Record<string, unknown>) => {
    const id = await client.mutation(api.tasks.create, { projectName: 'iMujer', ...args } as never);
    await client.mutation(api.tasks.move, { id, status: 'done' });
    return id;
  };
  const withDraft = await done(owner.client, { title: 'Con borrador', assigneeId: owner.memberId, description: 'Secreta' });
  const documented = await done(owner.client, { title: 'Documentada', assigneeId: owner.memberId });
  const entry = (await owner.client.query(api.journal.list, { onlyDrafts: true })).find((e) => e.taskId === documented)!;
  await owner.client.mutation(api.journal.documentDraft, { id: entry.id, fields: form({ hours: '1,5', activity: 'Documentada' }) });
  const anas = await done(ana.client, { title: 'De Ana', assigneeId: ana.memberId });
  return { t, owner, ana, token: TOKEN, withDraft, documented, anas };
}
type S = Awaited<ReturnType<typeof seed>>;
type Cell = () => Promise<unknown>;

const denied = (error: unknown) => ['FORBIDDEN', 'UNAUTHENTICATED'].includes(codeOf(error) ?? '');

/** Tabla 3.1 de la especificación. «viewer» llama sin sesión y con el token del enlace donde existe `viewer.*`. */
const ACCESS: Array<{ name: string; allow: Record<Who, boolean>; calls: (s: S) => Record<Who, Cell> }> = [
  {
    name: 'ver el tablero',
    allow: { owner: true, member: true, viewer: true },
    calls: (s) => ({
      owner: () => s.owner.client.query(api.tasks.list, {}),
      member: () => s.ana.client.query(api.tasks.list, {}),
      viewer: () => s.t.query(api.viewer.board, { shareToken: s.token }),
    }),
  },
  {
    name: 'ver el calendario',
    allow: { owner: true, member: true, viewer: true },
    calls: (s) => ({
      owner: () => s.owner.client.query(api.calendar.month, { year: 2026, month: 9 }),
      member: () => s.ana.client.query(api.calendar.month, { year: 2026, month: 9 }),
      viewer: () => s.t.query(api.viewer.calendar, { shareToken: s.token, year: 2026, month: 9 }),
    }),
  },
  {
    name: 'crear tareas y proyectos',
    allow: { owner: true, member: true, viewer: false },
    calls: (s) => {
      const create = (c: { mutation: typeof s.t.mutation }) => () => c.mutation(api.tasks.create, { title: 'Nueva', projectName: 'Otro' });
      return { owner: create(s.owner.client), member: create(s.ana.client), viewer: create(s.t) };
    },
  },
  {
    name: 'editar y asignar tareas',
    allow: { owner: true, member: true, viewer: false },
    calls: (s) => {
      const edit = (c: { mutation: typeof s.t.mutation }) => () => c.mutation(api.tasks.update, { id: s.anas, patch: { assigneeId: s.owner.memberId, priority: 3 } });
      return { owner: edit(s.owner.client), member: edit(s.ana.client), viewer: edit(s.t) };
    },
  },
  {
    name: 'mover tareas',
    allow: { owner: true, member: true, viewer: false },
    calls: (s) => {
      const move = (c: { mutation: typeof s.t.mutation }) => () => c.mutation(api.tasks.move, { id: s.anas, status: 'review' });
      return { owner: move(s.owner.client), member: move(s.ana.client), viewer: move(s.t) };
    },
  },
  {
    name: 'eliminar tareas',
    allow: { owner: true, member: false, viewer: false },
    calls: (s) => {
      const remove = (c: { mutation: typeof s.t.mutation }) => () => c.mutation(api.tasks.remove, { id: s.anas });
      return { owner: remove(s.owner.client), member: remove(s.ana.client), viewer: remove(s.t) };
    },
  },
  {
    name: 'ver el historial',
    allow: { owner: true, member: true, viewer: true },
    calls: (s) => ({
      owner: () => s.owner.client.query(api.events.list, {}),
      member: () => s.ana.client.query(api.events.list, {}),
      viewer: () => s.t.query(api.viewer.events, { shareToken: s.token }),
    }),
  },
  {
    name: 'ver la Bitácora, horas y borradores',
    allow: { owner: true, member: false, viewer: true },
    calls: (s) => ({
      owner: () => s.owner.client.query(api.journal.list, {}),
      member: () => s.ana.client.query(api.journal.list, {}),
      viewer: () => s.t.query(api.viewer.journal, { shareToken: s.token }),
    }),
  },
  {
    name: 'ver el resumen de horas',
    allow: { owner: true, member: false, viewer: false },
    calls: (s) => ({
      owner: () => s.owner.client.query(api.journal.summary, {}),
      member: () => s.ana.client.query(api.journal.summary, {}),
      viewer: () => s.t.query(api.journal.summary, {}),
    }),
  },
  {
    name: 'escribir en la Bitácora',
    allow: { owner: true, member: false, viewer: false },
    calls: (s) => {
      const write = (c: { mutation: typeof s.t.mutation }) => () => c.mutation(api.journal.createManual, { fields: form() });
      return { owner: write(s.owner.client), member: write(s.ana.client), viewer: write(s.t) };
    },
  },
  {
    name: 'crear invitaciones',
    allow: { owner: true, member: true, viewer: false },
    calls: (s) => {
      const invite = (c: { mutation: typeof s.t.mutation }) => () => c.mutation(api.invites.create, {});
      return { owner: invite(s.owner.client), member: invite(s.ana.client), viewer: invite(s.t) };
    },
  },
  {
    name: 'ver quién invitó a quién',
    allow: { owner: true, member: false, viewer: false },
    calls: (s) => ({
      owner: () => s.owner.client.query(api.members.list, {}),
      member: () => s.ana.client.query(api.members.list, {}),
      viewer: () => s.t.query(api.members.list, {}),
    }),
  },
  {
    name: 'retirar el acceso de una persona',
    allow: { owner: true, member: false, viewer: false },
    calls: (s) => ({
      owner: () => s.owner.client.mutation(api.members.revoke, { memberId: s.ana.memberId }),
      member: () => s.ana.client.mutation(api.members.revoke, { memberId: s.owner.memberId }),
      viewer: () => s.t.mutation(api.members.revoke, { memberId: s.owner.memberId }),
    }),
  },
  {
    name: 'ver las opciones del enlace',
    allow: { owner: true, member: false, viewer: false },
    calls: (s) => ({
      owner: () => s.owner.client.query(api.settings.get, {}),
      member: () => s.ana.client.query(api.settings.get, {}),
      viewer: () => s.t.query(api.settings.get, {}),
    }),
  },
  {
    name: 'cambiar las opciones del enlace',
    allow: { owner: true, member: false, viewer: false },
    calls: (s) => {
      const set = (c: { mutation: typeof s.t.mutation }) => () => c.mutation(api.settings.setShare, { showsDescriptions: true });
      return { owner: set(s.owner.client), member: set(s.ana.client), viewer: set(s.t) };
    },
  },
  {
    name: 'regenerar el enlace',
    allow: { owner: true, member: false, viewer: false },
    calls: (s) => {
      const regenerate = (c: { mutation: typeof s.t.mutation }) => () => c.mutation(api.settings.regenerateShare, {});
      return { owner: regenerate(s.owner.client), member: regenerate(s.ana.client), viewer: regenerate(s.t) };
    },
  },
];

describe('permission matrix (spec 3.1)', () => {
  describe.each(ACCESS)('$name', ({ allow, calls }) => {
    it.each(WHO)('%s', async (who) => {
      const s = await seed();
      const result = await calls(s)[who]().then(() => 'ok', (e) => e);
      if (allow[who]) expect(result, `${who} debería poder`).toBe('ok');
      else expect(denied(result), `${who} debería recibir FORBIDDEN o UNAUTHENTICATED`).toBe(true);
    });
  });
});

describe('what each audience sees inside the data', () => {
  const titles = (tasks: Array<{ title: string }>) => tasks.map((t) => t.title);
  const byTitle = <T extends { title: string }>(tasks: T[], title: string) => tasks.find((t) => t.title === title)!;
  const boardFor = async (s: S, who: 'owner' | 'member' | 'viewer') =>
    who === 'owner'
      ? s.owner.client.query(api.tasks.list, {})
      : who === 'member'
        ? s.ana.client.query(api.tasks.list, {})
        : (await s.t.query(api.viewer.board, { shareToken: s.token })).tasks;

  it.each([
    ['owner', {}, true],
    ['member', {}, true],
    ['viewer', {}, false],
    ['viewer', { showsDescriptions: true }, true],
  ] as const)('description: %s with %j sees it = %s', async (who, share, sees) => {
    const s = await seed(share);
    const task = byTitle(await boardFor(s, who), 'Con borrador');
    expect(task.description).toBe(sees ? 'Secreta' : undefined);
    expect('description' in task).toBe(sees);
  });

  it('shows hours and the draft marker on completed cards only to the owner and to a link that includes the journal', async () => {
    const s = await seed();
    for (const who of ['owner', 'viewer'] as const) {
      const tasks = await boardFor(s, who);
      expect(byTitle(tasks, 'Con borrador'), who).toMatchObject({ draft: true });
      expect('hours' in byTitle(tasks, 'Con borrador'), who).toBe(false);
      expect(byTitle(tasks, 'Documentada'), who).toMatchObject({ hours: 1.5 });
      expect('draft' in byTitle(tasks, 'Documentada'), who).toBe(false);
      expect('hours' in byTitle(tasks, 'De Ana') || 'draft' in byTitle(tasks, 'De Ana'), who).toBe(false);
    }
  });

  it('omits the keys hours, draft and docStatus for invited people and for a link without the journal', async () => {
    const s = await seed({ includesJournal: false });
    const memberTasks = await boardFor(s, 'member');
    const viewerTasks = await boardFor(s, 'viewer');
    for (const task of [...memberTasks, ...viewerTasks]) {
      expect(Object.keys(task).filter((k) => ['hours', 'draft', 'docStatus'].includes(k))).toEqual([]);
    }
    expect(titles(memberTasks).sort()).toEqual(['Con borrador', 'De Ana', 'Documentada']);
  });

  it('does not show hours on a card that was moved out of Completada', async () => {
    const s = await seed();
    await s.owner.client.mutation(api.tasks.move, { id: s.documented, status: 'doing' });
    expect('hours' in byTitle(await boardFor(s, 'owner'), 'Documentada')).toBe(false);
  });

  it.each([
    ['owner', true],
    ['member', false],
    ['viewer', true],
  ] as const)('history: %s sees owner-only journal events = %s', async (who, sees) => {
    const s = await seed();
    const page =
      who === 'owner'
        ? await s.owner.client.query(api.events.list, {})
        : who === 'member'
          ? await s.ana.client.query(api.events.list, {})
          : await s.t.query(api.viewer.events, { shareToken: s.token });
    const types = page.items.map((e) => e.type);
    expect(types.some((type) => type.startsWith('journal.'))).toBe(sees);
    expect(types).toContain('task.completed');
  });

  it('hides journal events from a link that does not include the journal', async () => {
    const s = await seed({ includesJournal: false });
    const page = await s.t.query(api.viewer.events, { shareToken: s.token });
    expect(page.items.some((e) => e.type.startsWith('journal.'))).toBe(false);
  });
});

describe('viewer.* needs a valid link', () => {
  const calls = (s: S, shareToken: string): Array<[string, () => Promise<unknown>]> => [
    ['board', () => s.t.query(api.viewer.board, { shareToken })],
    ['calendar', () => s.t.query(api.viewer.calendar, { shareToken, year: 2026, month: 9 })],
    ['journal', () => s.t.query(api.viewer.journal, { shareToken })],
    ['events', () => s.t.query(api.viewer.events, { shareToken })],
    ['access', () => s.t.query(api.viewer.access, { shareToken })],
  ];

  it('answers a wrong token with FORBIDDEN and no data', async () => {
    const s = await seed();
    for (const [name, call] of calls(s, 'otro')) {
      const error = await call().then(() => null, (e) => e);
      expect(codeOf(error), name).toBe('FORBIDDEN');
      expect(JSON.stringify(error?.data ?? {}), name).not.toContain('Informe');
    }
  });

  it('answers an empty token the same way', async () => {
    const s = await seed();
    for (const [name, call] of calls(s, '')) expect(codeOf(await call().catch((e) => e)), name).toBe('FORBIDDEN');
  });

  it('stops working when the link is disabled', async () => {
    const s = await seed();
    await s.owner.client.mutation(api.settings.setShare, { enabled: false });
    for (const [name, call] of calls(s, s.token)) expect(codeOf(await call().catch((e) => e)), name).toBe('FORBIDDEN');
  });

  it('tells the page what it can show', async () => {
    const s = await seed({ includesJournal: true, showsDescriptions: false });
    expect(await s.t.query(api.viewer.access, { shareToken: s.token })).toEqual({ includesJournal: true, showsDescriptions: false });
    const t2 = await seed({ includesJournal: false, showsDescriptions: true });
    expect(await t2.t.query(api.viewer.access, { shareToken: t2.token })).toEqual({ includesJournal: false, showsDescriptions: true });
  });

  it('returns the board with its projects', async () => {
    const s = await seed();
    const board = await s.t.query(api.viewer.board, { shareToken: s.token });
    expect(board.projects.map((p) => p.name)).toEqual(['iMujer']);
    expect(board.tasks).toHaveLength(3);
  });

  it('adds the hours indicators to the board only when the link includes the journal', async () => {
    const s = await seed();
    expect(((await s.t.query(api.viewer.board, { shareToken: s.token })) as { summary?: unknown }).summary).toEqual({ activities: 1, hours: 1.5, completed: 1, drafts: 1 });
    const closed = await seed({ includesJournal: false });
    expect('summary' in (await closed.t.query(api.viewer.board, { shareToken: closed.token }))).toBe(false);
  });

  it('returns the journal with its summary and without storage ids; refuses it when the link excludes the journal', async () => {
    const s = await seed();
    const file = await s.t.run((ctx) => ctx.storage.store(new Blob(['x'], { type: 'image/jpeg' })));
    await s.owner.client.mutation(api.journal.createManual, { fields: form({ activity: 'Con foto', photos: [{ storageId: file, name: 'a.jpg' }] }) });
    const view = await s.t.query(api.viewer.journal, { shareToken: s.token });
    expect(view.summary).toEqual({ activities: 2, hours: 3.5, completed: 2, drafts: 1 });
    const withPhoto = view.entries.find((e) => e.activity === 'Con foto')!;
    expect(withPhoto.photos[0].url).toMatch(/^https?:\/\//);
    expect(Object.keys(withPhoto.photos[0])).not.toContain('storageId');
    expect((await s.t.query(api.viewer.journal, { shareToken: s.token, onlyDrafts: true })).entries).toHaveLength(1);

    const closed = await seed({ includesJournal: false });
    const error = await closed.t.query(api.viewer.journal, { shareToken: closed.token }).catch((e) => e);
    expect(codeOf(error)).toBe('FORBIDDEN');
  });
});

describe('calendar.month', () => {
  async function dated() {
    const s = await seed();
    const create = (title: string, dueDate?: string) => s.owner.client.mutation(api.tasks.create, { title, projectName: 'iMujer', dueDate });
    await create('Primer día', '2026-10-01');
    await create('Último día', '2026-10-31');
    await create('Mes siguiente', '2026-11-01');
    await create('Mes anterior', '2026-09-30');
    await create('Sin fecha');
    await s.owner.client.mutation(api.journal.createManual, { fields: form({ date: '2026-10-15', hours: '2' }) });
    await s.owner.client.mutation(api.journal.createManual, { fields: form({ date: '2026-10-15', hours: '1,25' }) });
    await s.owner.client.mutation(api.journal.createManual, { fields: form({ date: '2026-10-16', hours: '0,5' }) });
    await s.owner.client.mutation(api.journal.createManual, { fields: form({ date: '2026-11-02', hours: '4' }) });
    return s;
  }

  it('lists only the tasks due inside the month', async () => {
    const s = await dated();
    const month = await s.ana.client.query(api.calendar.month, { year: 2026, month: 9 });
    expect(month.tasks.map((t) => t.title).sort()).toEqual(['Primer día', 'Último día'].sort());
  });

  it('adds hours per day for the owner and for a link with the journal, without drafts or other months', async () => {
    const s = await dated();
    // 2 + 1,25 horas de dos registros manuales + 1,5 h de la tarea documentada en el sembrado (todos del 15 de octubre).
    const expected = { '2026-10-15': 4.75, '2026-10-16': 0.5 };
    expect((await s.owner.client.query(api.calendar.month, { year: 2026, month: 9 })).hoursByDay).toEqual(expected);
    expect((await s.t.query(api.viewer.calendar, { shareToken: s.token, year: 2026, month: 9 })).hoursByDay).toEqual(expected);
  });

  it('omits the hours key for invited people and for a link without the journal', async () => {
    const s = await dated();
    expect('hoursByDay' in (await s.ana.client.query(api.calendar.month, { year: 2026, month: 9 }))).toBe(false);
    const closed = await seed({ includesJournal: false });
    expect('hoursByDay' in (await closed.t.query(api.viewer.calendar, { shareToken: closed.token, year: 2026, month: 9 }))).toBe(false);
  });

  it('rejects impossible months', async () => {
    const s = await seed();
    for (const args of [{ year: 2026, month: 12 }, { year: 2026, month: -1 }, { year: 1800, month: 3 }, { year: 2026, month: 1.5 }]) {
      expect(codeOf(await s.owner.client.query(api.calendar.month, args).catch((e) => e)), JSON.stringify(args)).toBe('VALIDATION');
    }
  });
});

describe('settings: the read-only link', () => {
  async function fresh() {
    const t = newTest();
    const owner = await setupOwner(t);
    return { t, owner };
  }
  const tokenOf = (link: string) => link.split('#/ver/')[1];

  it('starts disabled, with the defaults of the spec and no link', async () => {
    const { owner } = await fresh();
    expect(await owner.client.query(api.settings.get, {})).toEqual({ enabled: false, includesJournal: true, showsDescriptions: false });
  });

  it('enabling creates a link that works, and the owner can read it again', async () => {
    const { t, owner } = await fresh();
    await owner.client.mutation(api.settings.setShare, { enabled: true });
    const settings = await owner.client.query(api.settings.get, {});
    expect(settings).toMatchObject({ enabled: true, includesJournal: true, showsDescriptions: false });
    expect(settings.link).toMatch(/#\/ver\/[A-Za-z0-9_-]{43}$/);
    await expect(t.query(api.viewer.access, { shareToken: tokenOf(settings.link!) })).resolves.toBeDefined();
  });

  it('changes only the options that are sent', async () => {
    const { owner } = await fresh();
    await owner.client.mutation(api.settings.setShare, { enabled: true });
    await owner.client.mutation(api.settings.setShare, { showsDescriptions: true });
    expect(await owner.client.query(api.settings.get, {})).toMatchObject({ enabled: true, includesJournal: true, showsDescriptions: true });
    await owner.client.mutation(api.settings.setShare, { includesJournal: false });
    expect(await owner.client.query(api.settings.get, {})).toMatchObject({ includesJournal: false, showsDescriptions: true });
  });

  it('disabling kills the link for good: enabling again gives a different one', async () => {
    const { t, owner } = await fresh();
    await owner.client.mutation(api.settings.setShare, { enabled: true });
    const first = tokenOf((await owner.client.query(api.settings.get, {})).link!);
    await owner.client.mutation(api.settings.setShare, { enabled: false });
    expect('link' in (await owner.client.query(api.settings.get, {}))).toBe(false);
    expect(codeOf(await t.query(api.viewer.access, { shareToken: first }).catch((e) => e))).toBe('FORBIDDEN');
    await owner.client.mutation(api.settings.setShare, { enabled: true });
    const second = tokenOf((await owner.client.query(api.settings.get, {})).link!);
    expect(second).not.toBe(first);
    expect(codeOf(await t.query(api.viewer.access, { shareToken: first }).catch((e) => e))).toBe('FORBIDDEN');
    await expect(t.query(api.viewer.access, { shareToken: second })).resolves.toBeDefined();
  });

  it('regenerating returns the new link and invalidates the old one; it needs the link to be enabled', async () => {
    const { t, owner } = await fresh();
    expect(codeOf(await owner.client.mutation(api.settings.regenerateShare, {}).catch((e) => e))).toBe('VALIDATION');
    await owner.client.mutation(api.settings.setShare, { enabled: true });
    const old = tokenOf((await owner.client.query(api.settings.get, {})).link!);
    const { link } = await owner.client.mutation(api.settings.regenerateShare, {});
    expect(tokenOf(link)).not.toBe(old);
    expect(tokenOf(link)).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(codeOf(await t.query(api.viewer.access, { shareToken: old }).catch((e) => e))).toBe('FORBIDDEN');
    await expect(t.query(api.viewer.access, { shareToken: tokenOf(link) })).resolves.toBeDefined();
    expect((await owner.client.query(api.settings.get, {})).link).toBe(link);
  });

  it('logs share.changed for the team, without the token', async () => {
    const { t, owner } = await fresh();
    await owner.client.mutation(api.settings.setShare, { enabled: true });
    await owner.client.mutation(api.settings.regenerateShare, {});
    const events = (await t.run((ctx) => ctx.db.query('events').collect())).filter((e) => e.type === 'share.changed');
    expect(events).toHaveLength(2);
    expect(events.every((e) => e.visibility === 'team')).toBe(true);
    expect(JSON.stringify(events)).not.toMatch(/[A-Za-z0-9_-]{43}/);
  });

  it('does not log anything when nothing changes', async () => {
    const { t, owner } = await fresh();
    await owner.client.mutation(api.settings.setShare, { includesJournal: true, showsDescriptions: false, enabled: false });
    expect((await t.run((ctx) => ctx.db.query('events').collect())).filter((e) => e.type === 'share.changed')).toHaveLength(0);
  });
});
