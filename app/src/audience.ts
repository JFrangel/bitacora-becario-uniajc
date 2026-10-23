import { createContext, createElement, useContext } from 'react';
import type { ReactNode } from 'react';
import type { Id } from '../convex/_generated/dataModel';
import type { Tab } from './router';

/** Quién mira: la dueña, una persona invitada o el enlace de solo lectura. */
export type Audience = 'owner' | 'member' | 'viewer';

export type SessionInfo = {
  audience: Audience;
  /** Espacio activo; ausente solo en la compatibilidad con datos sin migrar. */
  workspaceId?: Id<'workspaces'>;
  workspaceRole?: 'owner' | 'editor';
  /** Solo en la vista de solo lectura: el token del enlace. */
  shareToken?: string;
  /** Persona con sesión. En solo lectura no hay persona. */
  memberId?: string;
  name?: string;
  roleLabel?: string;
  /** ¿Se muestra la Bitácora (y lo derivado de ella)? Siempre para la dueña; nunca para una persona invitada. */
  includesJournal: boolean;
  /** ¿Se muestran las descripciones de las tareas? */
  showsDescriptions: boolean;
};

const SessionContext = createContext<SessionInfo | null>(null);

export function SessionProvider({ value, children }: { value: SessionInfo; children: ReactNode }) {
  return createElement(SessionContext.Provider, { value }, children);
}

export function useSession(): SessionInfo {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession debe usarse dentro de <SessionProvider>.');
  return session;
}

export const useAudience = (): Audience => useSession().audience;

export const canEdit = (audience: Audience) => audience !== 'viewer';
export const canInvite = (audience: Audience) => audience !== 'viewer';

/** Pestañas visibles: la Bitácora solo existe para la dueña y para el enlace que la incluye. */
export function tabsFor(audience: Audience, includesJournal: boolean): Tab[] {
  const showJournal = audience === 'owner' || (audience === 'viewer' && includesJournal);
  return showJournal ? ['board', 'calendar', 'journal', 'history'] : ['board', 'calendar', 'history'];
}
