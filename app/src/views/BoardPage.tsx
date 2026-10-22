import { useSession } from '../audience';
import { useBoardData } from '../data/useBoardData';
import { Board } from '../features/board/Board';
import { useLanded } from '../features/board/landed';
import { useMoveTask } from '../features/board/useMoveTask';
import { useTaskPanel } from '../features/tasks/TaskPanelHost';
import { useToday } from '../lib/useToday';
import { Placeholder } from './Placeholder';

/** El tablero conectado a los datos de quien mira. */
export function BoardPage() {
  const { audience, memberId } = useSession();
  const data = useBoardData();
  const today = useToday();
  const panel = useTaskPanel();
  const move = useMoveTask();
  const { landedId, mark } = useLanded();

  if (data.loading) return <Placeholder tab="board" />;
  return (
    <Board
      tasks={data.tasks}
      projects={data.projects}
      people={data.people}
      summary={data.summary && { hours: data.summary.hours, drafts: data.summary.drafts }}
      today={today}
      me={memberId ?? null}
      canEdit={audience !== 'viewer'}
      landedId={landedId}
      onOpenTask={panel.openTask}
      onNewTask={(status) => panel.newTask({ status })}
      onMove={async (id, status, beforeId) => {
        if (await move(id, status, beforeId)) mark(id, status);
      }}
    />
  );
}
