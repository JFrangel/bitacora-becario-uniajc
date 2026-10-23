import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useSession } from '../audience';

/** Horas documentadas por día del mes: solo la dueña y el enlace que incluye la Bitácora las ven (si no, `undefined`). */
export function useCalendarHours(year: number, month: number): Record<string, number> | undefined {
  const { audience, shareToken, workspaceId } = useSession();
  const owner = useQuery(api.calendar.month, audience === 'owner' ? { year, month, ...(workspaceId ? { workspaceId } : {}) } : 'skip');
  const viewer = useQuery(api.viewer.calendar, audience === 'viewer' ? { shareToken: shareToken!, year, month } : 'skip');
  return (audience === 'viewer' ? viewer : owner)?.hoursByDay;
}
