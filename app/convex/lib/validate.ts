import { isValidDate } from './dates';
import { fail } from './errors';
import { LIMITS } from './limits';
import { cleanText } from './text';
import { newToken } from './tokens';

export type Subtask = { id: string; text: string; done: boolean };
export type SubtaskInput = { id?: string; text: string; done?: boolean };

/** Entrada ya validada y limpia de una tarea (el responsable se comprueba aparte, contra la base de datos). */
export type TaskInput = {
  title: string;
  projectName: string;
  description?: string;
  priority: number;
  dueDate?: string;
  subtasks: Subtask[];
};

export type RawTaskInput = {
  title: string;
  projectName: string;
  description?: string | null;
  priority?: number;
  dueDate?: string | null;
  subtasks?: SubtaskInput[];
};

export function validateTitle(raw: string): string {
  const title = raw.trim();
  if (!title) throw fail('VALIDATION', 'Escribe el nombre de la tarea.');
  return cleanText(title, LIMITS.title, `El nombre de la tarea admite hasta ${LIMITS.title} caracteres.`);
}

/** Nombre de proyecto sin espacios repetidos; la comparación por mayúsculas la hace `ensureProject`. */
export function validateProjectName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (!name) throw fail('VALIDATION', 'Elige o escribe un proyecto.');
  return cleanText(name, LIMITS.projectName, `El nombre del proyecto admite hasta ${LIMITS.projectName} caracteres.`);
}

/** Texto vacío o `null` significa «sin descripción». */
export function validateDescription(raw: string | null | undefined): string | undefined {
  const text = (raw ?? '').trim();
  return text ? cleanText(text, LIMITS.description) : undefined;
}

export function validatePriority(priority: number | undefined): number {
  if (priority === undefined) return 2;
  if (!Number.isInteger(priority) || priority < 1 || priority > 3) throw fail('VALIDATION', 'Elige una prioridad: baja, media o alta.');
  return priority;
}

/** Texto vacío o `null` significa «sin fecha». */
export function validateDueDate(raw: string | null | undefined): string | undefined {
  if (raw === null || raw === undefined || raw === '') return undefined;
  if (!isValidDate(raw)) throw fail('VALIDATION', 'La fecha no es válida.');
  return raw;
}

/** Descarta las filas vacías, conserva el `id` recibido (o crea uno) y limita a 20 subtareas. */
export function validateSubtasks(rows: SubtaskInput[] | undefined): Subtask[] {
  const filled = (rows ?? []).filter((row) => row.text.trim() !== '');
  if (filled.length > LIMITS.subtasks) throw fail('VALIDATION', `Máximo ${LIMITS.subtasks} subtareas.`);
  return filled.map((row) => ({
    id: row.id && row.id.length <= 40 ? row.id : newToken().slice(0, 12),
    text: cleanText(row.text, LIMITS.subtaskText, `Cada subtarea admite hasta ${LIMITS.subtaskText} caracteres.`),
    done: row.done ?? false,
  }));
}

export function validateTaskInput(input: RawTaskInput): TaskInput {
  return {
    title: validateTitle(input.title),
    projectName: validateProjectName(input.projectName),
    description: validateDescription(input.description),
    priority: validatePriority(input.priority),
    dueDate: validateDueDate(input.dueDate),
    subtasks: validateSubtasks(input.subtasks),
  };
}
