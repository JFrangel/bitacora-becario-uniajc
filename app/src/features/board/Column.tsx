import { useState } from 'react';
import type { ComponentProps } from 'react';
import type { TaskDto } from '../../../convex/lib/audience';
import { ScrollList } from '../../components/ScrollList/ScrollList';
import { useBoardOver, useCardDnd, useColumnDrop } from './BoardDnd';
import { TaskCard } from './TaskCard';
import { splitCompleted, visibleCount, MOBILE_CARDS } from './filters';
import { nextColumn } from './columns';
import type { Column as ColumnDef } from './columns';

type ColumnProps = {
  column: ColumnDef;
  /** Tareas de esta columna que pasan los filtros (el contador muestra todas, aunque se recorten). */
  tasks: TaskDto[];
  today: string;
  me: string | null;
  isPhone: boolean;
  canEdit: boolean;
  landedId?: string;
  /** Posición de la primera tarjeta en la entrada escalonada. */
  startIndex: number;
  onOpen: (id: string) => void;
  onNew: (status: ColumnDef['id']) => void;
  onMove: (id: string, status: ColumnDef['id'], beforeId?: string) => void;
};

type CardProps = Omit<ComponentProps<typeof TaskCard>, 'cardRef' | 'draggableProps' | 'dragging'> & { canEdit: boolean };

/** La tarjeta con su comportamiento de arrastre (ratón, táctil y teclado) cuando se puede editar. */
function DraggableCard({ task, canEdit, ...rest }: CardProps) {
  const dnd = useCardDnd(task.id, canEdit);
  return <TaskCard task={task} cardRef={dnd.ref} dragging={dnd.isDragging} draggableProps={dnd.props} {...rest} />;
}

/** Una columna del tablero: cabecera con su total real y la lista con scroll animado. */
export function Column({ column, tasks, today, me, isPhone, canEdit, landedId, startIndex, onOpen, onNew, onMove }: ColumnProps) {
  const dropRef = useColumnDrop(column.id, canEdit);
  const { overStatus } = useBoardOver();
  const [expanded, setExpanded] = useState(false);
  const [showOlder, setShowOlder] = useState(false);

  const isDone = column.id === 'done';
  const { recent, older } = isDone ? splitCompleted(tasks, today) : { recent: tasks, older: [] };
  const pool = isDone && showOlder ? [...recent, ...older] : recent;
  const shown = pool.slice(0, visibleCount(isPhone, expanded, pool.length));
  const hiddenByPhone = pool.length - shown.length;

  const footer = (
    <>
      {hiddenByPhone > 0 && (
        <button className="more-cards" type="button" onClick={() => setExpanded(true)}>
          Mostrar {hiddenByPhone} más
        </button>
      )}
      {isPhone && expanded && pool.length > MOBILE_CARDS && (
        <button className="more-cards" type="button" onClick={() => setExpanded(false)}>
          Mostrar menos
        </button>
      )}
      {isDone && older.length > 0 && !showOlder && (
        <button className="more-cards" type="button" onClick={() => setShowOlder(true)}>
          Mostrar anteriores ({older.length})
        </button>
      )}
      {isDone && showOlder && older.length > 0 && (
        <button className="more-cards" type="button" onClick={() => setShowOlder(false)}>
          Ocultar anteriores
        </button>
      )}
    </>
  );

  return (
    <section ref={dropRef} className={`col${overStatus === column.id ? ' over' : ''}`} data-col={column.id}>
      <header className="col-head">
        <span className="col-num">{column.roman}</span>
        <h2 className="col-name">{column.name}</h2>
        <span className="col-count">{tasks.length}</span>
        {canEdit && (
          <button className="col-add" type="button" aria-label={`Nueva tarea en ${column.name}`} title={`Nueva tarea en ${column.name}`} onClick={() => onNew(column.id)}>
            ＋
          </button>
        )}
      </header>
      <ScrollList
        items={shown}
        getKey={(task) => task.id}
        wrapClassName="col-body"
        className="col-scroll"
        snap
        empty={canEdit && tasks.length === 0 ? <p className="col-empty">Suelta una tarjeta aquí</p> : undefined}
        footer={footer}
        renderItem={(task, index) => (
          <DraggableCard
            task={task}
            canEdit={canEdit}
            index={startIndex + index}
            today={today}
            me={me}
            next={canEdit ? nextColumn(task.status) : undefined}
            landed={landedId === task.id}
            onOpen={onOpen}
            onMove={canEdit ? onMove : undefined}
          />
        )}
      />
    </section>
  );
}
