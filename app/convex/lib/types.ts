export type TaskStatus = 'todo' | 'doing' | 'review' | 'done';
/** Columnas del tablero, de izquierda a derecha. */
export const TASK_STATUSES: TaskStatus[] = ['todo', 'doing', 'review', 'done'];
export type ActivityStatus = 'Completada' | 'En progreso' | 'Pendiente de revisión';
export type DocStatus = 'draft' | 'complete';
export type EventVisibility = 'team' | 'owner';
