import type { BadgeData } from '../../convex/lib/profile';
import type { SessionInfo } from '../audience';
import type { Faces } from '../features/profile/badgeFaces';

/** Caras ya «dibujadas»: las pruebas no necesitan un lienzo real. */
export const FACES: Faces = { front: 'blob:front', back: 'blob:back', strap: 'blob:strap', cardColor: '#16181c', finish: 'glossy' };

export const OWNER_BADGE: BadgeData = {
  name: 'Jose Frangel Padilla Camacho',
  roleLabel: 'Becario',
  isOwner: true,
  since: Date.UTC(2026, 8, 1),
  updatedAt: 5,
  program: 'Ingeniería de Sistemas',
  term: '10.º semestre',
  institution: 'Institución Universitaria Antonio José Camacho',
  group: 'AthenIA',
  badgeDesign: 'olimpo',
};

export const MEMBER_BADGE: BadgeData = { name: 'Ana Gómez', roleLabel: 'Directora', isOwner: false, since: Date.UTC(2026, 9, 19, 21) };

export const SESSIONS: Record<'owner' | 'member' | 'viewer', SessionInfo> = {
  owner: { audience: 'owner', memberId: 'm1', name: OWNER_BADGE.name, roleLabel: 'Becario', includesJournal: true, showsDescriptions: true },
  member: { audience: 'member', memberId: 'm2', name: MEMBER_BADGE.name, roleLabel: 'Directora', includesJournal: false, showsDescriptions: true },
  viewer: { audience: 'viewer', shareToken: 'tok', includesJournal: true, showsDescriptions: false },
};
