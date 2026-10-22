import { useMutation } from 'convex/react';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import type { TaskStatus } from '../../../convex/lib/types';
import { useSession } from '../../audience';
import { useBoardData } from '../../data/useBoardData';
import { useEvents } from '../../data/useEvents';
import { useToast } from '../../shell/Toast';
import { useLanded } from '../board/landed';
import { useMoveTask } from '../board/useMoveTask';
import { TaskPanel } from './TaskPanel';

type PanelState = { mode: 'create'; status?: TaskStatus; date?: string } | { mode: 'edit'; id: string } | null;
type PanelApi = { openTask: (id: string) => void; newTask: (options?: { status?: TaskStatus; date?: string }) => void };

const PanelContext = createContext<PanelApi>({ openTask: () => {}, newTask: () => {} });
export const useTaskPanel = () => useContext(PanelContext);

/** Un solo panel de tarea para toda la aplicación: lo abren el tablero y el calendario. */
export function TaskPanelProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PanelState>(null);
  const panelApi = useMemo<PanelApi>(
    () => ({
      openTask: (id) => setState({ mode: 'edit', id }),
      newTask: (options) => setState({ mode: 'create', status: options?.status, date: options?.date }),
    }),
    [],
  );
  const close = useCallback(() => setState(null), []);
  return (
    <PanelContext.Provider value={panelApi}>
      {children}
      <TaskPanelHost state={state} onClose={close} />
    </PanelContext.Provider>
  );
}

function TaskPanelHost({ state, onClose }: { state: PanelState; onClose: () => void }) {
  const { audience, memberId } = useSession();
  const toast = useToast();
  const { tasks, projects, people } = useBoardData();
  const create = useMutation(api.tasks.create);
  const update = useMutation(api.tasks.update);
  const remove = useMutation(api.tasks.remove);
  const move = useMoveTask();
  const { mark } = useLanded();

  const task = state?.mode === 'edit' ? tasks.find((t) => t.id === state.id) : undefined;
  const history = useEvents({ subjectId: state?.mode === 'edit' ? state.id : undefined, enabled: state?.mode === 'edit' });
  const open = state !== null && (state.mode === 'create' || task !== undefined);

  return (
    <TaskPanel
      open={open}
      mode={state?.mode ?? 'create'}
      task={task}
      initialStatus={state?.mode === 'create' ? state.status : undefined}
      initialDate={state?.mode === 'create' ? state.date : undefined}
      projects={projects}
      people={people}
      readOnly={audience === 'viewer'}
      canDelete={audience === 'owner'}
      meId={memberId ?? null}
      now={Date.now()}
      events={history.events}
      onClose={onClose}
      onCreate={async (args) => {
        const id = await create({ ...args, assigneeId: args.assigneeId as Id<'members'> | undefined });
        mark(id, args.status ?? 'todo');
      }}
      onUpdate={async (id, patch) => {
        await update({ id: id as Id<'tasks'>, patch: { ...patch, assigneeId: patch.assigneeId as Id<'members'> | null | undefined } });
      }}
      onMove={async (id, status) => {
        const ok = await move(id, status);
        if (ok) mark(id, status);
        return ok;
      }}
      onDelete={async (id) => {
        await remove({ id: id as Id<'tasks'> });
        toast('Tarea eliminada.');
      }}
    />
  );
}
