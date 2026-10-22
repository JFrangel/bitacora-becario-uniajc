import { useQuery } from 'convex/react';
import { useMemo } from 'react';
import { api } from '../../convex/_generated/api';
import type { TaskDto } from '../../convex/lib/audience';
import { useSession } from '../audience';

export type Project = { id: string; name: string; colorSlot: number };
export type Person = { id: string; name: string };
export type Summary = { activities: number; hours: number; completed: number; drafts: number };

/**
 * Lo que necesita el tablero, según quién mira: la dueña y las personas invitadas leen las funciones normales;
 * el enlace de solo lectura lee `viewer.board`. El resumen de horas solo existe con acceso a la Bitácora.
 */
export function useBoardData() {
  const { audience, shareToken } = useSession();
  const viewer = audience === 'viewer';
  const list = useQuery(api.tasks.list, viewer ? 'skip' : {});
  const projectList = useQuery(api.projects.list, viewer ? 'skip' : {});
  const directory = useQuery(api.members.directory, viewer ? 'skip' : {});
  const ownerSummary = useQuery(api.journal.summary, audience === 'owner' ? {} : 'skip');
  const board = useQuery(api.viewer.board, viewer ? { shareToken: shareToken! } : 'skip');

  const tasks = (viewer ? board?.tasks : list) as TaskDto[] | undefined;
  const projects = (viewer ? board?.projects : projectList) as Project[] | undefined;
  const summary = (viewer ? (board as { summary?: Summary } | undefined)?.summary : ownerSummary) as Summary | undefined;

  const people = useMemo<Person[]>(() => {
    if (!viewer) return (directory ?? []).map((m) => ({ id: m.id, name: m.name }));
    const seen = new Map<string, string>();
    for (const task of tasks ?? []) if (task.assigneeId && task.assigneeName) seen.set(task.assigneeId, task.assigneeName);
    return [...seen].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [viewer, directory, tasks]);

  return { loading: tasks === undefined, tasks: tasks ?? [], projects: projects ?? [], people, summary };
}
