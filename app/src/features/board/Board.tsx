import { useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { TaskDto } from '../../../convex/lib/audience';
import type { TaskStatus } from '../../../convex/lib/types';
import { CountUp } from '../../components/CountUp';
import { formatToday } from '../../lib/format';
import { useIsPhone } from '../../lib/useMediaQuery';
import { usePersistentFlag } from '../../lib/usePersistentFlag';
import { BoardDnd } from './BoardDnd';
import { Column } from './Column';
import { TaskCard } from './TaskCard';
import { COLUMNS } from './columns';
import { boardStats, filterTasks } from './filters';
import type { BoardFilters } from './filters';
import { useCardEffects } from './useCardEffects';
import './board.css';

export type BoardProject = { id: string; name: string; colorSlot: number };
export type BoardPerson = { id: string; name: string };

export type BoardProps = {
  tasks: TaskDto[];
  projects: BoardProject[];
  people: BoardPerson[];
  /** Solo con acceso a la Bitácora: alimenta *Horas registradas* y *Por documentar*. */
  summary?: { hours: number; drafts: number };
  today: string;
  /** Id de quien mira; nulo en el enlace de solo lectura. */
  me: string | null;
  canEdit: boolean;
  landedId?: string;
  onOpenTask: (id: string) => void;
  onNewTask: (status?: TaskStatus) => void;
  /** Mueve la tarjeta (con la flecha, el menú «Mover a…» o arrastrando). */
  onMove: (id: string, status: TaskStatus, beforeId?: string) => void;
};

const PRIORITIES = [
  { value: 1, label: 'Baja' },
  { value: 2, label: 'Media' },
  { value: 3, label: 'Alta' },
];

/** Vista del tablero: indicadores, filtros y las cuatro columnas. */
export function Board({ tasks, projects, people, summary, today, me, canEdit, landedId, onOpenTask, onNewTask, onMove }: BoardProps) {
  const [filters, setFilters] = useState<BoardFilters>({});
  const [compact, setCompact] = usePersistentFlag('bitacora.boardCompact');
  const isPhone = useIsPhone();
  const boardRef = useRef<HTMLDivElement>(null);
  useCardEffects(boardRef);

  const stats = useMemo(() => boardStats(tasks, today), [tasks, today]);
  // La búsqueda y los filtros se aplican ANTES de contar y de recortar.
  const visible = useMemo(() => filterTasks(tasks, filters, me), [tasks, filters, me]);
  const set = (patch: Partial<BoardFilters>) => setFilters((current) => ({ ...current, ...patch }));

  let startIndex = 0;
  const columns = COLUMNS.map((column) => {
    const own = visible.filter((task) => task.status === column.id);
    const start = startIndex;
    startIndex += own.length;
    return { column, own, start };
  });

  return (
    <section className="view active" id="view-board">
      <div className="head">
        <div>
          <p className="eyebrow">{formatToday(today)}</p>
          <h1>
            Tablero
            <em>
              <span>.</span>
            </em>
          </h1>
        </div>
        <div className="stats" aria-label="Resumen">
          <div className="stat" style={{ '--i': 0 } as CSSProperties}>
            <CountUp value={stats.active} />
            <span>Activas</span>
          </div>
          <div className="stat" style={{ '--i': 1 } as CSSProperties}>
            <CountUp value={stats.dueThisWeek} />
            <span>Vencen esta semana</span>
          </div>
          {summary && (
            <>
              <div className="stat" style={{ '--i': 2 } as CSSProperties}>
                <CountUp value={summary.hours} decimals={2} />
                <span>Horas registradas</span>
              </div>
              <div className="stat" style={{ '--i': 3 } as CSSProperties}>
                <CountUp value={summary.drafts} />
                <span>Por documentar</span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="filters">
        <button className={`chip${!filters.projectId ? ' on' : ''}`} type="button" aria-pressed={!filters.projectId} style={{ '--i': 0 } as CSSProperties} onClick={() => set({ projectId: undefined })}>
          Todos
        </button>
        {projects.map((project, index) => (
          <button key={project.id} className={`chip${filters.projectId === project.id ? ' on' : ''}`} type="button" aria-pressed={filters.projectId === project.id} style={{ '--i': index + 1 } as CSSProperties} onClick={() => set({ projectId: project.id })}>
            {project.name}
          </button>
        ))}
        {me && (
          <button className={`chip${filters.onlyMine ? ' on' : ''}`} type="button" aria-pressed={Boolean(filters.onlyMine)} onClick={() => set({ onlyMine: !filters.onlyMine })}>
            Solo mías
          </button>
        )}
        <select className="jsel" aria-label="Asignada a" value={filters.assigneeId ?? ''} onChange={(event) => set({ assigneeId: event.target.value || undefined })}>
          <option value="">Asignada a: todas</option>
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </select>
        <select className="jsel" aria-label="Prioridad" value={filters.priority ?? ''} onChange={(event) => set({ priority: event.target.value ? Number(event.target.value) : undefined })}>
          <option value="">Todas las prioridades</option>
          {PRIORITIES.map((priority) => (
            <option key={priority.value} value={priority.value}>
              {priority.label}
            </option>
          ))}
        </select>
        <button className={`chip dens${compact ? ' on' : ''}`} id="densBtn" type="button" aria-pressed={compact} onClick={() => setCompact(!compact)}>
          Compacta
        </button>
        <input className="search" type="search" placeholder="Buscar tarea…" aria-label="Buscar tarea" value={filters.q ?? ''} onChange={(event) => set({ q: event.target.value })} />
        {canEdit && (
          <button className="newtask" id="newTask" type="button" onClick={() => onNewTask()}>
            ＋ Nueva tarea
          </button>
        )}
      </div>

      <BoardDnd
        tasks={visible}
        enabled={canEdit}
        onMove={(move) => onMove(move.id, move.status, move.beforeId)}
        renderOverlay={(task) => <TaskCard task={task} index={0} today={today} me={me} onOpen={() => {}} />}
      >
        <div className={`board${compact ? ' compact' : ''}`} ref={boardRef}>
          {columns.map(({ column, own, start }) => (
            <Column
              key={column.id}
              column={column}
              tasks={own}
              today={today}
              me={me}
              isPhone={isPhone}
              canEdit={canEdit}
              landedId={landedId}
              startIndex={start}
              onOpen={onOpenTask}
              onNew={onNewTask}
              onMove={onMove}
            />
          ))}
        </div>
      </BoardDnd>
    </section>
  );
}
