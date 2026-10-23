import { v } from 'convex/values';
import type { Doc } from './_generated/dataModel';
import { mutation, query } from './_generated/server';
import type { MutationCtx } from './_generated/server';
import { requireMember } from './lib/actors';
import { fail } from './lib/errors';
import { badgeForMember, ownerBadge, profileForMember, PROFILE_LIMITS, validateBadgeDesign, validateBadgeImage, validatePhoto, validateProfileText } from './lib/profile';
import type { BadgeData } from './lib/profile';
import { newToken, sha256Hex } from './lib/tokens';

async function editableProfile(ctx: MutationCtx, memberId: Doc<'members'>['_id'], isOwner: boolean, now: number): Promise<Doc<'profile'>> {
  let profile = await profileForMember(ctx, memberId);
  if (!profile && isOwner) {
    const legacy = (await ctx.db.query('profile').collect()).find((candidate) => candidate.memberId === undefined);
    if (legacy) {
      await ctx.db.patch(legacy._id, { memberId });
      profile = { ...legacy, memberId };
    }
  }
  if (profile) return profile;
  const id = await ctx.db.insert('profile', { memberId, updatedAt: now });
  return (await ctx.db.get(id))!;
}

/** El carné de quien llama, sin acceso a los datos de los demás integrantes. */
export const get = query({
  args: {},
  handler: async (ctx): Promise<BadgeData> => {
    const actor = await requireMember(ctx);
    if (actor.isOwner) return ownerBadge(ctx);
    const member = await ctx.db.get(actor.memberId);
    if (!member) throw fail('UNAUTHENTICATED');
    return badgeForMember(member, await profileForMember(ctx, member._id));
  },
});

/**
 * Cada integrante solo cambia su propio perfil. Texto vacío o `null` borra el dato; `photoDataUrl: null` quita la foto.
 * `updatedAt` solo avanza si algo cambió: el cliente lo usa para invalidar las caras ya dibujadas del carné.
 */
export const update = mutation({
  args: {
    program: v.optional(v.union(v.string(), v.null())),
    term: v.optional(v.union(v.string(), v.null())),
    institution: v.optional(v.union(v.string(), v.null())),
    group: v.optional(v.union(v.string(), v.null())),
    frontDescription: v.optional(v.union(v.string(), v.null())),
    groupLogoDataUrl: v.optional(v.union(v.string(), v.null())),
    backTitle: v.optional(v.union(v.string(), v.null())),
    backDescription: v.optional(v.union(v.string(), v.null())),
    backFooter: v.optional(v.union(v.string(), v.null())),
    badgeDesign: v.optional(v.string()),
    photoDataUrl: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const actor = await requireMember(ctx);
    const now = Date.now();
    const profile = await editableProfile(ctx, actor.memberId, actor.isOwner, now);

    const next: Partial<Doc<'profile'>> = {};
    const change = <K extends keyof Doc<'profile'>>(key: K, value: Doc<'profile'>[K]) => {
      if (profile![key] !== value) next[key] = value;
    };
    if (args.program !== undefined) change('program', validateProfileText(args.program, PROFILE_LIMITS.program));
    if (args.term !== undefined) change('term', validateProfileText(args.term, PROFILE_LIMITS.term));
    if (args.institution !== undefined) change('institution', validateProfileText(args.institution, PROFILE_LIMITS.institution));
    if (args.group !== undefined) change('group', validateProfileText(args.group, PROFILE_LIMITS.group));
    if (args.frontDescription !== undefined) change('frontDescription', args.frontDescription === null ? undefined : validateProfileText(args.frontDescription, PROFILE_LIMITS.frontDescription) ?? '');
    if (args.groupLogoDataUrl !== undefined) change('groupLogoDataUrl', args.groupLogoDataUrl === null ? undefined : validateBadgeImage(args.groupLogoDataUrl));
    if (args.backTitle !== undefined) change('backTitle', validateProfileText(args.backTitle, PROFILE_LIMITS.backTitle));
    if (args.backDescription !== undefined) change('backDescription', validateProfileText(args.backDescription, PROFILE_LIMITS.backDescription));
    if (args.backFooter !== undefined) change('backFooter', validateProfileText(args.backFooter, PROFILE_LIMITS.backFooter));
    if (args.badgeDesign !== undefined) change('badgeDesign', validateBadgeDesign(args.badgeDesign));
    if (args.photoDataUrl !== undefined) change('photoDataUrl', args.photoDataUrl === null ? undefined : validatePhoto(args.photoDataUrl));

    if (Object.keys(next).length === 0) return;
    next.updatedAt = now;
    await ctx.db.patch(profile._id, next);
  },
});

/** Estado de compartir del perfil propio; nunca devuelve el token ni el hash. */
export const shareSettings = query({
  args: {},
  handler: async (ctx) => {
    const actor = await requireMember(ctx);
    const profile = await profileForMember(ctx, actor.memberId);
    return {
      enabled: profile?.shareEnabled === true && profile.shareTokenHash !== undefined,
      showPhoto: profile?.sharePhoto === true,
      showAcademic: profile?.shareAcademic === true,
    };
  },
});

/** Crea o regenera el enlace personal. La base solo conserva el hash y el token claro se devuelve una sola vez. */
export const createShareLink = mutation({
  args: { showPhoto: v.boolean(), showAcademic: v.boolean() },
  handler: async (ctx, { showPhoto, showAcademic }) => {
    const actor = await requireMember(ctx);
    const now = Date.now();
    const profile = await editableProfile(ctx, actor.memberId, actor.isOwner, now);
    const token = newToken();
    await ctx.db.patch(profile._id, {
      shareEnabled: true,
      shareTokenHash: await sha256Hex(token),
      sharePhoto: showPhoto,
      shareAcademic: showAcademic,
      updatedAt: now,
    });
    return { token };
  },
});

/** Cambia los campos opcionales visibles sin reemplazar el enlace personal. */
export const updateShareVisibility = mutation({
  args: { showPhoto: v.optional(v.boolean()), showAcademic: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const actor = await requireMember(ctx);
    const now = Date.now();
    const profile = await editableProfile(ctx, actor.memberId, actor.isOwner, now);
    const patch: Partial<Doc<'profile'>> = {};
    if (args.showPhoto !== undefined && profile.sharePhoto !== args.showPhoto) patch.sharePhoto = args.showPhoto;
    if (args.showAcademic !== undefined && profile.shareAcademic !== args.showAcademic) patch.shareAcademic = args.showAcademic;
    if (Object.keys(patch).length === 0) return;
    patch.updatedAt = now;
    await ctx.db.patch(profile._id, patch);
  },
});

/** Desactiva el enlace y elimina su hash para invalidarlo de inmediato. */
export const revokeShareLink = mutation({
  args: {},
  handler: async (ctx) => {
    const actor = await requireMember(ctx);
    const profile = await profileForMember(ctx, actor.memberId);
    if (!profile || (profile.shareEnabled !== true && profile.shareTokenHash === undefined)) return;
    await ctx.db.patch(profile._id, { shareEnabled: false, shareTokenHash: undefined, sharePhoto: false, shareAcademic: false, updatedAt: Date.now() });
  },
});
