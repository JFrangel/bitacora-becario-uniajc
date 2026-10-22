import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { TaskDto } from '../../../convex/lib/audience';
import type { EventDto } from '../../../convex/lib/events';
import type { TaskStatus } from '../../../convex/lib/types';
import { LIMITS } from '../../../convex/lib/limits';
import { errorMessage } from '../../convexClient';
import { dayLabel, eventLine } from '../history/eventLine';
import { columnName, COLUMNS } from '../board/columns';
import { Panel } from '../../shell/Panel';
import { useToast } from '../../shell/Toast';
import { SubtaskEditor } from './SubtaskEditor';
import { diffTask, emptyForm, formFromTask, toCreateArgs, validateTaskForm } from './taskForm';
import type { TaskForm } from './taskForm';

export type TaskPanelProps = {
  open: boolean;
  mode: 'create' | 'edit';
  /** Para `edit`: la tarea que se muestra. */
  task?: TaskDto;
  /** Para `create`: el estado de la columna desde donde se abrió, y la fecha del día que se tocó en el calendario. */
  initialStatus?: TaskStatus;
  initialDate?: string;
  projects: Array<{ id: string; name: string; colorSlot: number }>;
  people: Array<{ id: string; name: string }>;
  /** Enlace de solo lectura: se ve el detalle, no se puede cambiar nada. */
  readOnly: boolean;
  /** Solo la dueña elimina tareas. */
  canDelete: boolean;
  meId: string | null;
  now: number;
  /** Historial de esta tarea. */
  events?: EventDto[];
  onClose: () => void;
  onCreate: (args: ReturnType<typeof toCreateArgs>) => Promise<void>;
  onUpdate: (id: string, patch: ReturnType<typeof diffTask>) => Promise<void>;
  onMove: (id: string, status: TaskStatus) => Promise<boolean>;
  onDelete: (id: string) => Promise<void>;
};

const PRIORITIES: Array<{ value: 1 | 2 | 3; label: string }> = [
  { value: 1, label: 'Baja' },
  { value: 2, label: 'Media' },
  { value: 3, label: 'Alta' },
];

/** «Nueva tarea» y «Detalle de la tarea»: el mismo formulario. Al guardar solo se envía lo que cambió. */
export function TaskPanel(props: TaskPanelProps) {
  const { open, mode, task, initialStatus, initialDate, projects, people, readOnly, canDelete, meId, now, events = [], onClose, onCreate, onUpdate, onMove, onDelete } = props;
  const toast = useToast();
  const [form, setForm] = useState<TaskForm>(() => (task ? formFromTask(task) : emptyForm(initialStatus, initialDate)));
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const title = useRef<HTMLInputElement>(null);
  const project = useRef<HTMLInputElement>(null);

  // Cada vez que se abre (o cambia de tarea) el formulario vuelve a empezar desde los datos actuales.
  useEffect(() => {
    if (!open) return;
    setForm(task && mode === 'edit' ? formFromTask(task) : emptyForm(initialStatus, initialDate));
    setMessage('');
    setConfirming(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, task?.id, initialStatus, initialDate]);

  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), 4000);
    return () => clearTimeout(timer);
  }, [confirming]);

  const set = (patch: Partial<TaskForm>) => setForm((current) => ({ ...current, ...patch }));
  const log = useMemo(() => events.slice(0, 5), [events]);
  const showDescription = !readOnly || task?.description !== undefined;

  const fail = (field: 'title' | 'project' | null, text: string) => {
    setMessage(text);
    if (field === 'title') title.current?.focus();
    if (field === 'project') project.current?.focus();
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (readOnly || busy) return;
    const check = validateTaskForm(form);
    if (!check.ok) {
      fail(check.field, check.message);
      return;
    }
    setMessage('');
    setBusy(true);
    try {
      if (mode === 'create') {
        await onCreate(toCreateArgs(form));
        toast(`Tarea creada en «${columnName(form.status)}»`);
      } else if (task) {
        const patch = diffTask(task, form);
        const changed = Object.keys(patch).length > 0;
        if (changed) await onUpdate(task.id, patch);
        const moved = form.status !== task.status;
        if (moved) {
          const ok = await onMove(task.id, form.status);
          if (!ok) return;
        }
        if (changed || moved) toast('Cambios guardados.');
      }
      onClose();
    } catch (error) {
      setMessage(errorMessage(error) ?? 'No se pudo guardar. Inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!task) return;
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setBusy(true);
    try {
      await onDelete(task.id);
      onClose();
    } catch (error) {
      setMessage(errorMessage(error) ?? 'No se pudo eliminar. Inténtalo de nuevo.');
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel open={open} onClose={onClose} title={mode === 'create' ? 'Nueva tarea' : 'Detalle de la tarea'}>
      <form className="fill-form drawer-form" noValidate onSubmit={(event) => void save(event)}>
        <label>
          <span className="lbl">Nombre de la tarea</span>
          <input ref={title} data-autofocus type="text" maxLength={LIMITS.title} placeholder="Ej. Revisar cláusulas del convenio" autoComplete="off" value={form.title} disabled={readOnly} onChange={(event) => set({ title: event.target.value })} />
        </label>
        {showDescription && (
          <>
            <label>
              <span className="lbl">
                Descripción <small>(opcional)</small>
              </span>
              <textarea rows={3} maxLength={LIMITS.description} placeholder="¿Qué hay que hacer y qué se espera como resultado?" value={form.description} disabled={readOnly} onChange={(event) => set({ description: event.target.value })} />
            </label>
            {!readOnly && <p className="field-note">Evita datos personales de terceros.</p>}
          </>
        )}
        <SubtaskEditor value={form.subtasks} onChange={(subtasks) => set({ subtasks })} onLimit={() => toast(`Máximo ${LIMITS.subtasks} subtareas.`)} readOnly={readOnly} />
        <label>
          <span className="lbl">Proyecto o área</span>
          <input ref={project} type="text" list="projectOptions" maxLength={LIMITS.projectName} placeholder="Escribe o elige un proyecto" autoComplete="off" value={form.projectName} disabled={readOnly} onChange={(event) => set({ projectName: event.target.value })} />
          <datalist id="projectOptions">
            {projects.map((p) => (
              <option key={p.id} value={p.name} />
            ))}
          </datalist>
        </label>
        <div className="grid2">
          <label>
            <span className="lbl">Responsable</span>
            <select value={form.assigneeId} disabled={readOnly} onChange={(event) => set({ assigneeId: event.target.value })}>
              <option value="">Sin asignar</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.id === meId ? `${person.name} (tú)` : person.name}
                </option>
              ))}
              {task?.assigneeId && !people.some((p) => p.id === task.assigneeId) && (
                <option value={task.assigneeId}>{task.assigneeName ?? 'Persona'} (sin acceso)</option>
              )}
            </select>
          </label>
          <label>
            <span className="lbl">
              Fecha límite <small>(opcional)</small>
            </span>
            <input type="date" value={form.dueDate} disabled={readOnly} onChange={(event) => set({ dueDate: event.target.value })} />
          </label>
        </div>
        <fieldset className="prio-set">
          <legend>Prioridad</legend>
          <div className="row">
            {PRIORITIES.map((priority) => (
              <label className="pchoice" key={priority.value}>
                <input type="radio" name="prio" value={priority.value} checked={form.priority === priority.value} disabled={readOnly} onChange={() => set({ priority: priority.value })} />
                <span className="prio" data-p={priority.value} aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                {priority.label}
              </label>
            ))}
          </div>
        </fieldset>
        <label>
          <span className="lbl">Estado</span>
          <select value={form.status} disabled={readOnly} onChange={(event) => set({ status: event.target.value as TaskStatus })}>
            {COLUMNS.map((column) => (
              <option key={column.id} value={column.id}>
                {column.name}
              </option>
            ))}
          </select>
        </label>
        <p className="form-error" role="alert">
          {message}
        </p>
        {!readOnly && (
          <div className="form-actions">
            <button type="submit" className="fill primary" disabled={busy}>
              {mode === 'create' ? 'Crear tarea' : 'Guardar cambios'}
            </button>
            <button type="button" className="ghost" onClick={onClose}>
              Cancelar
            </button>
            {mode === 'edit' && canDelete && (
              <button type="button" className={`ghost danger${confirming ? ' confirming' : ''}`} disabled={busy} onClick={() => void remove()}>
                {confirming ? 'Pulsa de nuevo para eliminar' : 'Eliminar tarea'}
              </button>
            )}
          </div>
        )}
      </form>
      {mode === 'edit' && log.length > 0 && (
        <section className="drawer-hist">
          <h3>Actividad de esta tarea</h3>
          <ul>
            {log.map((entry) => {
              const line = eventLine(entry, meId);
              return (
                <li key={entry.id}>
                  <b>{dayLabel(entry.at, now)}</b> · {line.who} {line.verb}
                  {line.detail ? ` — ${line.detail}` : ''}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </Panel>
  );
}
