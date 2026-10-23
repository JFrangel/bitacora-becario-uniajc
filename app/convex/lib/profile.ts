import type { QueryCtx } from '../_generated/server';
import type { Doc, Id } from '../_generated/dataModel';
import { fail } from './errors';
import { LIMITS } from './limits';

/** Diseños del carné que se pueden elegir (el mismo conjunto que `DESIGNS` en el cliente). */
export const BADGE_DESIGNS = ['olimpo', 'circuito', 'poster', 'suizo', 'clasico'] as const;

/** Máximos de los datos del carné (especificación, tabla `profile`). */
export const PROFILE_LIMITS = { program: 80, term: 30, institution: 100, group: 60, frontDescription: 120, backTitle: 60, backDescription: 120, backFooter: 60 } as const;

const JPEG_PREFIX = 'data:image/jpeg;base64,';
const BADGE_IMAGE = /^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

/** Lo que dibuja el carné. Nunca incluye correos: nombre, rol y los datos de la hoja de vida que la dueña quiso poner. */
export type BadgeData = {
  name: string;
  roleLabel: string;
  isOwner: boolean;
  since: number;
  updatedAt?: number;
  program?: string;
  term?: string;
  institution?: string;
  group?: string;
  frontDescription?: string;
  groupLogoDataUrl?: string;
  backTitle?: string;
  backDescription?: string;
  backFooter?: string;
  badgeDesign?: string;
  photoDataUrl?: string;
};

/** Texto del carné: recortado; vacío significa «sin valor». */
export function validateProfileText(raw: string | null | undefined, max: number): string | undefined {
  const text = (raw ?? '').trim();
  if (text.length > max) throw fail('VALIDATION', `Máximo ${max} caracteres.`);
  return text || undefined;
}

export function validateBadgeDesign(id: string): string {
  if (!(BADGE_DESIGNS as readonly string[]).includes(id)) throw fail('VALIDATION', 'Ese diseño de carné no existe.');
  return id;
}

/** La foto llega ya recortada y comprimida en el navegador: JPEG en base64 de hasta 400 KB ya decodificados. */
export function validatePhoto(raw: string): string {
  if (!raw.startsWith(JPEG_PREFIX)) throw fail('VALIDATION', 'La foto debe ser una imagen JPEG.');
  const payload = raw.slice(JPEG_PREFIX.length);
  if (!payload || payload.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(payload)) throw fail('VALIDATION', 'La foto no es válida.');
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
  if ((payload.length / 4) * 3 - padding > LIMITS.photoBytes) throw fail('VALIDATION', 'La foto supera los 400 KB.');
  return raw;
}

/** El logo conserva transparencia (PNG/WebP) y deja espacio en el documento para la foto personal. */
export function validateBadgeImage(raw: string): string {
  const match = BADGE_IMAGE.exec(raw);
  const payload = match?.[1];
  if (!payload || payload.length % 4 !== 0) throw fail('VALIDATION', 'El logo debe ser una imagen PNG, JPEG o WebP válida.');
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
  if ((payload.length / 4) * 3 - padding > LIMITS.badgeLogoBytes) throw fail('VALIDATION', 'El logo supera los 180 KB.');
  return raw;
}

/** El carné de la dueña: nombre y rol de su registro de persona más los datos del perfil. */
export async function ownerBadge(ctx: QueryCtx): Promise<BadgeData> {
  const owner = (await ctx.db.query('members').collect()).find((m) => m.isOwner);
  if (!owner) throw fail('NOT_FOUND', 'Todavía no hay una dueña.');
  const profile = await profileForMember(ctx, owner._id) ?? (await ctx.db.query('profile').collect()).find((candidate) => candidate.memberId === undefined) ?? null;
  return badgeForMember(owner, profile);
}

export async function profileForMember(ctx: QueryCtx, memberId: Id<'members'>): Promise<Doc<'profile'> | null> {
  return ctx.db.query('profile').withIndex('by_memberId', (q) => q.eq('memberId', memberId)).unique();
}

export function badgeForMember(member: Doc<'members'>, profile: Doc<'profile'> | null): BadgeData {
  const badge: BadgeData = { name: member.name, roleLabel: member.roleLabel, isOwner: member.isOwner, since: member.createdAt, updatedAt: profile?.updatedAt ?? member.createdAt };
  if (profile?.program !== undefined) badge.program = profile.program;
  if (profile?.term !== undefined) badge.term = profile.term;
  if (profile?.institution !== undefined) badge.institution = profile.institution;
  if (profile?.group !== undefined) badge.group = profile.group;
  if (profile?.frontDescription !== undefined) badge.frontDescription = profile.frontDescription;
  if (profile?.groupLogoDataUrl !== undefined) badge.groupLogoDataUrl = profile.groupLogoDataUrl;
  if (profile?.backTitle !== undefined) badge.backTitle = profile.backTitle;
  if (profile?.backDescription !== undefined) badge.backDescription = profile.backDescription;
  if (profile?.backFooter !== undefined) badge.backFooter = profile.backFooter;
  if (profile?.badgeDesign !== undefined) badge.badgeDesign = profile.badgeDesign;
  if (profile?.photoDataUrl !== undefined) badge.photoDataUrl = profile.photoDataUrl;
  return badge;
}
