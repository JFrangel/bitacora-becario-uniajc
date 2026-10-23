import { useMutation } from 'convex/react';
import { useCallback, useMemo } from 'react';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import type { TaskDto } from '../../../convex/lib/audience';
import type { TaskStatus } from '../../../convex/lib/types';
import { errorCode } from '../../convexClient';
import { useToast } from '../../shell/Toast';
import { applyMove } from './dnd';

export type MoveTask = (id: string, status: TaskStatus, beforeId?: string) => Promise<boolean>;

/**
 * Mueve una tarjeta con actualización optimista: la tarjeta cambia de lugar al instante y, si el servidor lo rechaza,
 * Convex la devuelve a su sitio y aquí se avisa. Una tarea que otra persona acaba de borrar → «Esa tarea ya no existe.».
 * Devuelve si el movimiento se guardó.
 */
export function useMoveTask(workspaceId?: Id<'workspaces'>): MoveTask {
  const toast = useToast();
  const mutation = useMutation(api.tasks.move);
  const scope = useMemo(() => workspaceId ? { workspaceId } : {}, [workspaceId]);
  // `withOptimisticUpdate` crea una mutación nueva cada vez que se llama: se memoriza para que `move` (y `moveTask`) no cambien de
  // identidad en cada pintado.
  const move = useMemo(
    () =>
      mutation.withOptimisticUpdate((store, args) => {
        const current = store.getQuery(api.tasks.list, scope);
        if (current === undefined) return;
        store.setQuery(api.tasks.list, scope, applyMove(current as TaskDto[], { id: args.id, status: args.status, beforeId: args.beforeId }) as typeof current);
      }),
    [mutation, workspaceId],
  );

  return useCallback<MoveTask>(
    async (id, status, beforeId) => {
      try {
        await move({ ...scope, id: id as Id<'tasks'>, status, beforeId: beforeId as Id<'tasks'> | undefined });
        return true;
      } catch (error) {
        toast(errorCode(error) === 'TASK_NOT_FOUND' ? 'Esa tarea ya no existe.' : 'No se pudo mover la tarea. Inténtalo de nuevo.');
        return false;
      }
    },
    [move, toast, scope],
  );
}
