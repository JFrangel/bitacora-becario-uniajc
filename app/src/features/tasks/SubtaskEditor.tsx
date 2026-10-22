import { LIMITS } from '../../../convex/lib/limits';
import type { SubtaskRow } from './taskForm';

type SubtaskEditorProps = {
  value: SubtaskRow[];
  onChange: (rows: SubtaskRow[]) => void;
  /** Se llama al intentar pasar de 20 filas. */
  onLimit?: () => void;
  readOnly?: boolean;
};

/** Subtareas: una casilla de «hecha», el texto («Tarea 1», «Tarea 2»…) y una × por fila; «＋ Añadir otra» agrega hasta 20. */
export function SubtaskEditor({ value, onChange, onLimit, readOnly = false }: SubtaskEditorProps) {
  const update = (index: number, patch: Partial<SubtaskRow>) => onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const add = () => {
    if (value.length >= LIMITS.subtasks) {
      onLimit?.();
      return;
    }
    onChange([...value, { text: '', done: false }]);
  };

  return (
    <div className="subs-edit">
      <span className="lbl">
        Subtareas <small>(opcional)</small>
      </span>
      <div className="sub-list">
        {value.map((row, index) => (
          <div className="sub-row" key={row.id ?? `nueva-${index}`}>
            <input type="checkbox" aria-label={`Marcar la tarea ${index + 1} como hecha`} checked={row.done} disabled={readOnly} onChange={(event) => update(index, { done: event.target.checked })} />
            <input type="text" maxLength={LIMITS.subtaskText} placeholder={`Tarea ${index + 1}`} aria-label={`Tarea ${index + 1}`} value={row.text} disabled={readOnly} onChange={(event) => update(index, { text: event.target.value })} />
            {!readOnly && (
              <button type="button" className="rm" aria-label="Quitar esta subtarea" onClick={() => onChange(value.filter((_, i) => i !== index))}>
                ×
              </button>
            )}
          </div>
        ))}
      </div>
      {!readOnly && (
        <button type="button" className="sub-add" onClick={add}>
          ＋ Añadir otra
        </button>
      )}
    </div>
  );
}
