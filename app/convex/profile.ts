import { v } from 'convex/values';
import type { Doc } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
import { requireMember, requireOwner } from './lib/actors';
import { fail } from './lib/errors';
import { ownerBadge, PROFILE_LIMITS, validateBadgeDesign, validatePhoto, validateProfileText } from './lib/profile';
import type { BadgeData } from './lib/profile';

/** El carné de quien llama: la dueña recibe todo; una persona invitada, solo su nombre, su rol y desde cuándo está. */
export const get = query({
  args: {},
  handler: async (ctx): Promise<BadgeData> => {
    const actor = await requireMember(ctx);
    if (actor.isOwner) return ownerBadge(ctx);
    const member = await ctx.db.get(actor.memberId);
    if (!member) throw fail('UNAUTHENTICATED');
    return { name: member.name, roleLabel: member.roleLabel, isOwner: false, since: member.createdAt };
  },
});

/**
 * Solo la dueña, y solo cambia lo que envía. Texto vacío o `null` borra el dato; `photoDataUrl: null` quita la foto.
 * `updatedAt` solo avanza si algo cambió: el cliente lo usa para invalidar las caras ya dibujadas del carné.
 */
export const update = mutation({
  args: {
    program: v.optional(v.union(v.string(), v.null())),
    term: v.optional(v.union(v.string(), v.null())),
    institution: v.optional(v.union(v.string(), v.null())),
    group: v.optional(v.union(v.string(), v.null())),
    badgeDesign: v.optional(v.string()),
    photoDataUrl: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const now = Date.now();
    let profile = await ctx.db.query('profile').first();
    if (!profile) profile = (await ctx.db.get(await ctx.db.insert('profile', { updatedAt: now })))!;

    const next: Partial<Doc<'profile'>> = {};
    const change = <K extends keyof Doc<'profile'>>(key: K, value: Doc<'profile'>[K]) => {
      if (profile![key] !== value) next[key] = value;
    };
    if (args.program !== undefined) change('program', validateProfileText(args.program, PROFILE_LIMITS.program));
    if (args.term !== undefined) change('term', validateProfileText(args.term, PROFILE_LIMITS.term));
    if (args.institution !== undefined) change('institution', validateProfileText(args.institution, PROFILE_LIMITS.institution));
    if (args.group !== undefined) change('group', validateProfileText(args.group, PROFILE_LIMITS.group));
    if (args.badgeDesign !== undefined) change('badgeDesign', validateBadgeDesign(args.badgeDesign));
    if (args.photoDataUrl !== undefined) change('photoDataUrl', args.photoDataUrl === null ? undefined : validatePhoto(args.photoDataUrl));

    if (Object.keys(next).length === 0) return;
    next.updatedAt = now;
    await ctx.db.patch(profile._id, next);
  },
});
