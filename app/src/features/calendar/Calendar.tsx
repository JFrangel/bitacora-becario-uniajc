import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { TaskDto } from '../../../convex/lib/audience';
import { formatHours, formatShort, formatWeekday } from '../../lib/format';
import { buildMonthGrid, tasksOn, upcoming } from './month';
import './calendar.css';

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MAX_CHIPS = 2;

export type CalendarProps = {
  year: number;
  /** 0 = enero. */
  month: number;
  /** Todas las tareas visibles: la cuadrícula muestra las del mes y «Próximos vencimientos» mira hacia adelante. */
  tasks: TaskDto[];
  /** Horas documentadas por día (`AAAA-MM-DD`); solo existe para la dueña y el enlace con Bitácora. */
  hoursByDay?: Record<string, number>;
  today: string;
  me: string | null;
  canEdit: boolean;
  onPrev: () => void;
  onNext: () => void;
  onOpenTask: (id: string) => void;
  onNewTask: (dueDate: string) => void;
};

const colorOf = (task: TaskDto) => ({ '--p': `var(--p${task.projectColorSlot})` }) as CSSProperties;
const who = (task: TaskDto, me: string | null) => (task.assigneeId ? (task.assigneeId === me ? 'Tú' : (task.assigneeName ?? 'Persona')) : 'Sin asignar');

/** Calendario mensual que empieza en lunes: fechas límite, horas documentadas del día y próximos vencimientos. */
export function Calendar({ year, month, tasks, hoursByDay, today, me, canEdit, onPrev, onNext, onOpenTask, onNewTask }: CalendarProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const grid = buildMonthGrid(year, month);
  const monthName = new Intl.DateTimeFormat('es-CO', { month: 'long' }).format(new Date(year, month, 1));
  const next = upcoming(tasks);
  const dayTasks = selected ? tasksOn(tasks, selected) : [];

  return (
    <section className="view active" id="view-calendar">
      <div className="head cal-bar">
        <div>
          <p className="eyebrow">Fechas límite y horas del mes</p>
          <h2>
            {monthName} <em>{year}</em>
          </h2>
        </div>
        <div className="cal-nav">
          <button type="button" aria-label="Mes anterior" onClick={onPrev}>
            ←
          </button>
          <button type="button" aria-label="Mes siguiente" onClick={onNext}>
            →
          </button>
        </div>
      </div>

      <div className="cal">
        <div className="cal-grid" role="grid" aria-label={`${monthName} ${year}`}>
          {WEEKDAYS.map((day) => (
            <div className="cal-dow" role="columnheader" key={day}>
              {day}
            </div>
          ))}
          {grid.map((day, index) => {
            if (!day) return <div className="cal-cell blank" role="gridcell" key={`blank-${index}`} />;
            const list = tasksOn(tasks, day);
            const hours = hoursByDay?.[day];
            const number = Number(day.slice(8));
            return (
              <div
                key={day}
                role="gridcell"
                className={`cal-cell${day === today ? ' today' : ''}${selected === day ? ' selected' : ''}`}
                style={{ '--i': Math.min(index, 40) } as CSSProperties}
                aria-current={day === today ? 'date' : undefined}
                onClick={() => setSelected(day)}
              >
                <span className="cal-num">{number}</span>
                {hours !== undefined && hours > 0 && (
                  <span className="cal-hours" title="Horas documentadas ese día">
                    {formatHours(hours)} h
                  </span>
                )}
                {list.slice(0, MAX_CHIPS).map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    className={`cal-chip${task.status === 'done' ? ' done' : ''}`}
                    style={colorOf(task)}
                    title={`${task.title} · ${who(task, me)}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenTask(task.id);
                    }}
                  >
                    {task.title}
                  </button>
                ))}
                {list.length > MAX_CHIPS && (
                  <button
                    type="button"
                    className="cal-more"
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelected(day);
                    }}
                  >
                    +{list.length - MAX_CHIPS} más
                  </button>
                )}
                {canEdit && list.length === 0 && (
                  <button type="button" className="cal-new" aria-label={`Nueva tarea el ${formatWeekday(day)}`} onClick={(event) => {
                    event.stopPropagation();
                    onNewTask(day);
                  }} />
                )}
              </div>
            );
          })}
        </div>

        <aside className="upcoming">
          <h3>Próximos vencimientos</h3>
          <ul>
            {next.map((task, index) => {
              const due = task.dueDate!;
              const late = due < today;
              return (
                <li key={task.id} className="up-item" style={{ '--i': index, '--p': `var(--p${task.projectColorSlot})` } as CSSProperties}>
                  <span className="up-date">
                    <span>
                      <b>{Number(due.slice(8))}</b>
                      <small>{formatShort(due).split(' ')[1]}</small>
                    </span>
                  </span>
                  <div>
                    <button type="button" className="up-title" onClick={() => onOpenTask(task.id)}>
                      <strong>{task.title}</strong>
                    </button>
                    <span>
                      {task.projectName} · {who(task, me)}
                      {late ? ' · vencida' : ''}
                    </span>
                  </div>
                </li>
              );
            })}
            {next.length === 0 && <li className="up-empty">No hay vencimientos próximos.</li>}
          </ul>
        </aside>
      </div>

      {selected && (
        <section className="cal-day" aria-label={`Tareas del ${formatWeekday(selected)}`}>
          <h3>{formatWeekday(selected)}</h3>
          {dayTasks.length === 0 && <p className="cal-day-empty">No hay tareas con fecha límite este día.</p>}
          <ul>
            {dayTasks.map((task) => (
              <li key={task.id} style={colorOf(task)}>
                <button type="button" onClick={() => onOpenTask(task.id)}>
                  <span className="cal-dot" />
                  {task.title}
                  <small>{task.projectName}</small>
                </button>
              </li>
            ))}
          </ul>
          {canEdit && (
            <button type="button" className="sub-add" onClick={() => onNewTask(selected)}>
              ＋ Nueva tarea este día
            </button>
          )}
        </section>
      )}
    </section>
  );
}
