import type { TaskStatus } from '../../../convex/lib/types';

export type Column = { id: TaskStatus; name: string; roman: string };

export const COLUMNS: readonly Column[] = [
  { id: 'todo', name: 'Por hacer', roman: 'I' },
  { id: 'doing', name: 'En curso', roman: 'II' },
  { id: 'review', name: 'En revisión', roman: 'III' },
  { id: 'done', name: 'Completada', roman: 'IV' },
];

export const nextColumn = (status: TaskStatus): Column | undefined => COLUMNS[COLUMNS.findIndex((c) => c.id === status) + 1];
export const columnName = (status: TaskStatus) => COLUMNS.find((c) => c.id === status)!.name;
