import { getAuthUserId } from '@convex-dev/auth/server';
import { mutation, query } from './_generated/server';
import { fail } from './lib/errors';

/**
 * Primera entrada de la dueña: crea su registro en `members` (con `isOwner`), la fila única de `settings`
 * y su perfil. También asocia el perfil global anterior con esa cuenta. Es idempotente. Solo la cuenta cuyo correo coincide con `OWNER_EMAIL` puede llamarla;
 * sin la variable definida nadie es dueña (falla cerrada).
 */
export const ensureOwner = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw fail('UNAUTHENTICATED');
    const user = await ctx.db.get(userId);
    const ownerEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
    const email = user?.email?.trim().toLowerCase();
    if (!ownerEmail || !email || email !== ownerEmail) throw fail('FORBIDDEN');

    const now = Date.now();
    let member = await ctx.db.query('members').withIndex('by_userId', (q) => q.eq('userId', userId)).unique();
    if (!member) {
      const memberId = await ctx.db.insert('members', {
        name: user?.name?.trim() || email.split('@')[0],
        roleLabel: 'Becario/a',
        isOwner: true,
        userId,
        email,
        createdAt: now,
        lastSeenAt: now,
      });
      member = await ctx.db.get(memberId);
    }
    if (!(await ctx.db.query('settings').first())) {
      await ctx.db.insert('settings', { shareEnabled: false, shareIncludesJournal: true, shareShowsDescriptions: false, timezone: 'America/Bogota' });
    }
    const profiles = await ctx.db.query('profile').collect();
    const ownProfile = profiles.find((profile) => profile.memberId === member!._id);
    if (!ownProfile) {
      const legacy = profiles.find((profile) => profile.memberId === undefined);
      if (legacy) await ctx.db.patch(legacy._id, { memberId: member!._id });
      else await ctx.db.insert('profile', { memberId: member!._id, updatedAt: now });
    }
    return member!._id;
  },
});

/**
 * Estado de la cuenta de Google que tiene la sesión abierta, para decidir qué pantalla mostrar. Se vuelve a calcular
 * al instante cuando la dueña retira el acceso. Solo devuelve el correo de la propia cuenta (nunca el de otras personas).
 */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { status: 'anonymous' as const };
    const member = await ctx.db.query('members').withIndex('by_userId', (q) => q.eq('userId', userId)).unique();
    if (!member) {
      const user = await ctx.db.get(userId);
      return { status: 'none' as const, email: user?.email ?? '', name: user?.name ?? '' };
    }
    if (member.revokedAt !== undefined) return { status: 'revoked' as const };
    return { status: 'active' as const, memberId: member._id, name: member.name, roleLabel: member.roleLabel, isOwner: member.isOwner };
  },
});
