import type { TaskDto } from '../../../convex/lib/audience';
import { orderBetween } from '../../../convex/lib/order';
import type { TaskStatus } from '../../../convex/lib/types';
import { COLUMNS, columnName } from './columns';

/** Qué cambia al soltar una tarjeta: su nueva columna y, si no va al final, ante cuál queda. */
export type Drop = { status: TaskStatus; beforeId?: string };
export type Move = Drop & { id: string };

const COLUMN_PREFIX = 'col:';
export const columnDropId = (status: TaskStatus) => `${COLUMN_PREFIX}${status}`;
export const statusOfDropId = (id: string): TaskStatus | null => (id.startsWith(COLUMN_PREFIX) ? (id.slice(COLUMN_PREFIX.length) as TaskStatus) : null);

/** Ids de las tareas que se ven, por columna y en el orden en que se muestran. */
export function idsByColumn(tasks: TaskDto[]): Record<TaskStatus, string[]> {
  const columns: Record<TaskStatus, string[]> = { todo: [], doing: [], review: [], done: [] };
  for (const task of tasks) columns[task.status].push(task.id);
  return columns;
}

/**
 * Qué cambia al soltar `activeId` sobre `overId` (otra tarjeta o una columna):
 *  - sobre una tarjeta de **otra** columna: queda justo antes de ella;
 *  - sobre una tarjeta de **su** columna: sube antes de ella, o baja después de ella;
 *  - sobre una columna (vacía o no): queda al final.
 * Devuelve `null` si no cambia nada (fuera de cualquier destino, sobre sí misma, tarjeta desconocida).
 */
export function computeDrop(columns: Record<TaskStatus, string[]>, activeId: string, overId: string | null): Drop | null {
  if (overId === null || overId === activeId) return null;
  const from = COLUMNS.find((c) => columns[c.id].includes(activeId))?.id;
  if (!from) return null;

  const dropColumn = statusOfDropId(overId);
  if (dropColumn) {
    const column = columns[dropColumn];
    const isLastAlready = dropColumn === from && column[column.length - 1] === activeId;
    return isLastAlready ? null : { status: dropColumn };
  }

  const target = COLUMNS.find((c) => columns[c.id].includes(overId))?.id;
  if (!target) return null;
  if (target !== from) return { status: target, beforeId: overId };

  const column = columns[target];
  const [activeIndex, overIndex] = [column.indexOf(activeId), column.indexOf(overId)];
  if (activeIndex < overIndex) {
    const after = column[overIndex + 1];
    return after ? { status: target, beforeId: after } : { status: target };
  }
  return { status: target, beforeId: overId };
}

/**
 * La misma regla del servidor (`tasks.move`) para la actualización optimista: el `order` se calcula entre vecinos y
 * `completedAt` se fija al entrar en Completada y se borra al salir. Devuelve la misma lista si la tarea no existe.
 */
export function applyMove(tasks: TaskDto[], move: Move): TaskDto[] {
  const task = tasks.find((t) => t.id === move.id);
  if (!task) return tasks;
  const column = tasks.filter((t) => t.status === move.status && t.id !== move.id).sort((a, b) => a.order - b.order);
  const at = move.beforeId ? column.findIndex((t) => t.id === move.beforeId) : -1;
  const order = at >= 0 ? orderBetween(column[at - 1]?.order ?? null, column[at].order) : orderBetween(column.at(-1)?.order ?? null, null);
  return tasks.map((t) => {
    if (t.id !== move.id) return t;
    const { completedAt, ...rest } = t;
    const moved: TaskDto = { ...rest, status: move.status, order };
    if (move.status === 'done') moved.completedAt = completedAt ?? Date.now();
    return moved;
  });
}

export const moveAnnouncement = (title: string, status: TaskStatus) => `Moviste «${title}» a «${columnName(status)}».`;
