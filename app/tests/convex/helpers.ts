import { convexTest } from 'convex-test';
import schema from '../../convex/schema';

/** Módulos de Convex para convex-test (sin los `.d.ts`). */
export const modules = import.meta.glob(['../../convex/**/*.ts', '../../convex/**/*.js', '!../../convex/**/*.d.ts']);

export const newTest = () => convexTest(schema, modules);

export type Test = ReturnType<typeof newTest>;

/** Crea un usuario de Convex Auth y devuelve un cliente que actúa como esa cuenta de Google. */
export async function asUser(t: Test, email: string, name?: string) {
  const userId = await t.run((ctx) => ctx.db.insert('users', { email, name }));
  return { userId, client: t.withIdentity({ subject: `${userId}|test-session` }) };
}

/** Añade una persona al equipo (registro de `members`) para las pruebas. */
export async function addMember(
  t: Test,
  userId: Awaited<ReturnType<typeof asUser>>['userId'],
  fields: { name?: string; roleLabel?: string; isOwner?: boolean; email?: string; revokedAt?: number } = {},
) {
  const now = Date.now();
  return t.run((ctx) =>
    ctx.db.insert('members', {
      name: fields.name ?? 'Persona',
      roleLabel: fields.roleLabel ?? 'Colaboradora',
      isOwner: fields.isOwner ?? false,
      userId,
      email: fields.email ?? 'persona@example.com',
      createdAt: now,
      lastSeenAt: now,
      revokedAt: fields.revokedAt,
    }),
  );
}

/** Dueña lista para usar: usuario, registro de `members` (isOwner), ajustes y perfil, y cliente autenticado. */
export async function setupOwner(t: Test, email = 'dueña@example.com') {
  const user = await asUser(t, email, 'Dueña');
  const memberId = await addMember(t, user.userId, { name: 'Dueña', roleLabel: 'Becaria', isOwner: true, email });
  await t.run(async (ctx) => {
    if (!(await ctx.db.query('settings').first())) {
      await ctx.db.insert('settings', { shareEnabled: false, shareIncludesJournal: true, shareShowsDescriptions: false, timezone: 'America/Bogota' });
    }
    if (!(await ctx.db.query('profile').first())) await ctx.db.insert('profile', { memberId, updatedAt: Date.now() });
  });
  return { ...user, memberId };
}

/** Persona invitada (no dueña) lista para usar. */
export async function setupMember(t: Test, email = 'ana@example.com', name = 'Ana', roleLabel = 'Directora') {
  const user = await asUser(t, email, name);
  const memberId = await addMember(t, user.userId, { name, roleLabel, email });
  return { ...user, memberId };
}

/** Activa el enlace de solo lectura con un token conocido. */
export async function enableShare(t: Test, token = 'tok-lectura', opts: { includesJournal?: boolean; showsDescriptions?: boolean } = {}) {
  await t.run(async (ctx) => {
    const settings = await ctx.db.query('settings').first();
    const patch = { shareToken: token, shareEnabled: true, shareIncludesJournal: opts.includesJournal ?? true, shareShowsDescriptions: opts.showsDescriptions ?? false };
    if (settings) await ctx.db.patch(settings._id, patch);
    else await ctx.db.insert('settings', { ...patch, timezone: 'America/Bogota' });
  });
  return token;
}

/** Código de error de aplicación (`fail(...)`) de una excepción capturada. */
export const codeOf = (e: unknown) => (e as { data?: { code?: string } }).data?.code;
