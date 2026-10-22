import type { CSSProperties, KeyboardEvent } from 'react';
import type { TaskDto } from '../../../convex/lib/audience';
import { isOverdue } from '../../../convex/lib/dates';
import type { TaskStatus } from '../../../convex/lib/types';
import { formatHours, formatShort } from '../../lib/format';
import { initialsOf } from '../profile/names';
import type { Column } from './columns';
import { MoveMenu } from './MoveMenu';

const PRIORITY = { 1: 'baja', 2: 'media', 3: 'alta' } as const;

/** Colores del avatar de la maqueta: quien mira es «B»; las demás personas se reparten entre «D» y «S» de forma estable. */
export function whoKey(assigneeId: string | undefined, me: string | null): 'B' | 'D' | 'S' {
  if (!assigneeId) return 'D';
  if (assigneeId === me) return 'B';
  let sum = 0;
  for (const char of assigneeId) sum += char.charCodeAt(0);
  return sum % 2 ? 'D' : 'S';
}

export type TaskCardProps = {
  task: TaskDto;
  index: number;
  today: string;
  me: string | null;
  /** Siguiente columna: muestra la flecha «→» (solo quien puede editar). */
  next?: Column;
  landed?: boolean;
  /** Mientras se arrastra, la tarjeta de origen queda atenuada. */
  dragging?: boolean;
  onOpen: (id: string) => void;
  /** Con permiso de edición: la flecha «→» y el menú «Mover a…». */
  onMove?: (id: string, status: TaskStatus, beforeId?: string) => void;
  cardRef?: (node: HTMLElement | null) => void;
  /** Atributos y oyentes de arrastre (ratón, táctil y teclado). */
  draggableProps?: Record<string, unknown>;
};

/** Tarjeta del tablero. Los datos derivados de la Bitácora (`hours`, `draft`) solo existen si el DTO los trae. */
export function TaskCard({ task, index, today, me, next, landed = false, dragging = false, onOpen, onMove, cardRef, draggableProps }: TaskCardProps) {
  const done = task.status === 'done';
  const late = isOverdue(task.dueDate, task.status, today);
  const subsDone = task.subtasks.filter((s) => s.done).length;
  const assignee = task.assigneeId ? (task.assigneeId === me ? 'Tú' : (task.assigneeName ?? 'Persona')) : 'Sin asignar';
  const style = { '--i': index, '--p': `var(--p${task.projectColorSlot})` } as CSSProperties;

  const { onKeyDown: dragKeyDown, ...dragProps } = (draggableProps ?? {}) as { onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void } & Record<string, unknown>;
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    dragKeyDown?.(event);
    if (event.key === 'Enter' && event.target === event.currentTarget) onOpen(task.id);
  };

  return (
    <article
      ref={cardRef}
      className={`card${landed ? ' landed' : ''}${dragging ? ' dragging' : ''}`}
      tabIndex={0}
      data-id={task.id}
      data-col={task.status}
      style={style}
      onClick={(event) => {
        if (!(event.target as HTMLElement).closest('button, a')) onOpen(task.id);
      }}
      {...dragProps}
      onKeyDown={onKeyDown}
    >
      <div className="card-top">
        <span className="proj">{task.projectName}</span>
        <span className="card-flags">
          {done && (
            <span className="done-mark" title="Completada" aria-label="Completada">
              ✓
            </span>
          )}
          <span className="prio" data-p={task.priority} title={`Prioridad ${PRIORITY[task.priority as 1 | 2 | 3]}`}>
            <i />
            <i />
            <i />
          </span>
        </span>
      </div>
      <h3>{task.title}</h3>
      {task.subtasks.length > 0 && (
        <div className="subs" title="Subtareas hechas">
          <span className="subs-bar">
            <i style={{ '--s': subsDone / task.subtasks.length } as CSSProperties} />
          </span>
          <span className="subs-n">
            {subsDone}/{task.subtasks.length}
          </span>
        </div>
      )}
      <div className="card-bot">
        <span className={`avatar sm${task.assigneeId ? '' : ' none'}`} data-who={whoKey(task.assigneeId, me)} title={assignee}>
          {task.assigneeId ? initialsOf(task.assigneeName ?? '?') : '–'}
        </span>
        <span className="who-name">
          {assignee}
          {task.assigneeRevoked ? ' (sin acceso)' : ''}
        </span>
        {task.hours !== undefined && (
          <span className="hrs" title="Horas documentadas en la bitácora">
            {formatHours(task.hours)} h
          </span>
        )}
        <span className={`due${late ? ' late' : ''}`}>{late ? `Vencida ${formatShort(task.dueDate)}` : formatShort(task.dueDate)}</span>
        {onMove && <MoveMenu taskId={task.id} status={task.status} title={task.title} onMove={onMove} />}
        {next && onMove && (
          <button className="next" type="button" aria-label={`Mover a ${next.name}`} title={`Mover a ${next.name}`} onClick={() => onMove(task.id, next.id)}>
            →
          </button>
        )}
      </div>
      {task.draft && (
        <div className="draft">
          <span className="dot" />
          Falta documentar en tu bitácora
        </div>
      )}
    </article>
  );
}
