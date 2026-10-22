import type { TaskDto } from '../../../convex/lib/audience';
import { LIMITS } from '../../../convex/lib/limits';
import { normalizeSearch } from '../../../convex/lib/text';
import type { TaskStatus } from '../../../convex/lib/types';

export type SubtaskRow = { id?: string; text: string; done: boolean };

export type TaskForm = {
  title: string;
  description: string;
  subtasks: SubtaskRow[];
  projectName: string;
  /** Id de la persona responsable, o vacío para «Sin asignar». */
  assigneeId: string;
  /** `AAAA-MM-DD` o vacío. */
  dueDate: string;
  priority: 1 | 2 | 3;
  status: TaskStatus;
};

/** Cambios que se envían a `tasks.update`: solo lo que cambió (`null` borra descripción, fecha o responsable). */
export type TaskPatch = {
  title?: string;
  description?: string | null;
  projectName?: string;
  priority?: number;
  dueDate?: string | null;
  assigneeId?: string | null;
  subtasks?: Array<{ id?: string; text: string; done: boolean }>;
};

const START_ROWS = 3;
const blankRows = (count: number): SubtaskRow[] => Array.from({ length: count }, () => ({ text: '', done: false }));
const squash = (text: string) => text.trim().replace(/\s+/g, ' ');

/** Formulario de «Nueva tarea»: el estado de la columna desde donde se abrió, prioridad Media y 3 filas de subtareas vacías. */
export function emptyForm(status: TaskStatus = 'todo', dueDate = ''): TaskForm {
  return { title: '', description: '', subtasks: blankRows(START_ROWS), projectName: '', assigneeId: '', dueDate, priority: 2, status };
}

export function formFromTask(task: TaskDto): TaskForm {
  const subtasks: SubtaskRow[] = task.subtasks.map((s) => ({ id: s.id, text: s.text, done: s.done }));
  while (subtasks.length < START_ROWS) subtasks.push({ text: '', done: false });
  return {
    title: task.title,
    description: task.description ?? '',
    subtasks,
    projectName: task.projectName,
    assigneeId: task.assigneeId ?? '',
    dueDate: task.dueDate ?? '',
    priority: task.priority as 1 | 2 | 3,
    status: task.status,
  };
}

export function validateTaskForm(form: TaskForm): { ok: true } | { ok: false; field: 'title' | 'project'; message: string } {
  const title = form.title.trim();
  if (!title) return { ok: false, field: 'title', message: 'Escribe el nombre de la tarea.' };
  if (title.length > LIMITS.title) return { ok: false, field: 'title', message: `El nombre de la tarea admite hasta ${LIMITS.title} caracteres.` };
  const project = squash(form.projectName);
  if (!project) return { ok: false, field: 'project', message: 'Elige o escribe un proyecto.' };
  if (project.length > LIMITS.projectName) return { ok: false, field: 'project', message: `El nombre del proyecto admite hasta ${LIMITS.projectName} caracteres.` };
  return { ok: true };
}

const filled = (rows: SubtaskRow[]) => rows.filter((row) => row.text.trim() !== '').map((row) => ({ ...(row.id ? { id: row.id } : {}), text: row.text.trim(), done: row.done }));

/** Solo los campos que cambiaron (regla 8: dos personas que editan campos distintos no se pisan). El estado no va aquí: mover es otra operación. */
export function diffTask(original: TaskDto, form: TaskForm): TaskPatch {
  const patch: TaskPatch = {};
  const title = form.title.trim();
  if (title !== original.title) patch.title = title;
  const description = form.description.trim();
  if (description !== (original.description ?? '')) patch.description = description === '' ? null : description;
  const project = squash(form.projectName);
  if (normalizeSearch(project) !== normalizeSearch(original.projectName)) patch.projectName = project;
  if (form.priority !== original.priority) patch.priority = form.priority;
  if (form.dueDate !== (original.dueDate ?? '')) patch.dueDate = form.dueDate === '' ? null : form.dueDate;
  if (form.assigneeId !== (original.assigneeId ?? '')) patch.assigneeId = form.assigneeId === '' ? null : form.assigneeId;
  const subtasks = filled(form.subtasks);
  const before = original.subtasks.map((s) => ({ id: s.id, text: s.text, done: s.done }));
  if (JSON.stringify(subtasks) !== JSON.stringify(before)) patch.subtasks = subtasks;
  return patch;
}

/** Argumentos de `tasks.create`: sin campos vacíos ni filas de subtareas en blanco. */
export function toCreateArgs(form: TaskForm) {
  const args: {
    title: string;
    projectName: string;
    priority: number;
    status: TaskStatus;
    description?: string;
    assigneeId?: string;
    dueDate?: string;
    subtasks?: Array<{ text: string; done: boolean }>;
  } = { title: form.title.trim(), projectName: squash(form.projectName), priority: form.priority, status: form.status };
  if (form.description.trim()) args.description = form.description.trim();
  if (form.assigneeId) args.assigneeId = form.assigneeId;
  if (form.dueDate) args.dueDate = form.dueDate;
  const subtasks = filled(form.subtasks).map(({ text, done }) => ({ text, done }));
  if (subtasks.length > 0) args.subtasks = subtasks;
  return args;
}
