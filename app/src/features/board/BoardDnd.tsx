import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { Announcements, ClientRect, CollisionDetection, DragEndEvent, DragOverEvent, DragStartEvent, KeyboardCoordinateGetter } from '@dnd-kit/core';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { TaskDto } from '../../../convex/lib/audience';
import type { TaskStatus } from '../../../convex/lib/types';
import { COLUMNS, columnName } from './columns';
import { columnDropId, computeDrop, idsByColumn, moveAnnouncement, statusOfDropId } from './dnd';
import type { Move } from './dnd';

const OverContext = createContext<{ overStatus: TaskStatus | null }>({ overStatus: null });
export const useBoardOver = () => useContext(OverContext);

/** Con puntero: la tarjeta bajo el cursor manda; si no hay, la columna. Con teclado: el destino más cercano. */
export const collision: CollisionDetection = (args) => {
  if (!args.pointerCoordinates) return closestCenter(args);
  const hits = pointerWithin(args);
  const card = hits.find((hit) => statusOfDropId(String(hit.id)) === null);
  if (card) return [card];
  if (hits.length > 0) return [hits[0]];
  return closestCenter({ ...args, droppableContainers: args.droppableContainers.filter((c) => statusOfDropId(String(c.id)) !== null) });
};

const ARROWS: Record<string, [number, number]> = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] };

/** Las flechas saltan al destino más cercano en esa dirección: otra tarjeta o columna. */
export const boardCoordinates: KeyboardCoordinateGetter = (event, { context: { active, droppableRects, droppableContainers, collisionRect } }) => {
  const direction = ARROWS[event.code];
  if (!direction || !collisionRect) return undefined;
  event.preventDefault();
  const [cx, cy] = [collisionRect.left + collisionRect.width / 2, collisionRect.top + collisionRect.height / 2];
  let best: ClientRect | null = null;
  let bestScore = Infinity;
  for (const container of droppableContainers.getEnabled()) {
    if (container.id === active?.id) continue;
    const rect = droppableRects.get(container.id);
    if (!rect) continue;
    const [dx, dy] = [rect.left + rect.width / 2 - cx, rect.top + rect.height / 2 - cy];
    const along = direction[0] * dx + direction[1] * dy;
    if (along <= 8) continue;
    const across = Math.abs(direction[0] * dy - direction[1] * dx);
    const score = along + across * 2;
    if (score < bestScore) {
      best = rect;
      bestScore = score;
    }
  }
  return best ? { x: best.left + (best.width - collisionRect.width) / 2, y: best.top + (best.height - collisionRect.height) / 2 } : undefined;
};

type BoardDndProps = {
  tasks: TaskDto[];
  /** Sin permiso de edición (enlace de solo lectura) no se puede arrastrar nada. */
  enabled: boolean;
  onMove: (move: Move) => void;
  renderOverlay: (task: TaskDto) => ReactNode;
  children: ReactNode;
};

const INSTRUCTIONS = 'Para tomar la tarjeta pulsa Espacio. Con las flechas la mueves entre columnas o posiciones; Espacio la suelta y Esc cancela.';

/** Arrastre con ratón, táctil (pulsación corta) y teclado, con anuncios en español para lectores de pantalla. */
export function BoardDnd({ tasks, enabled, onMove, renderOverlay, children }: BoardDndProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overStatus, setOverStatus] = useState<TaskStatus | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] }, coordinateGetter: boardCoordinates }),
  );

  const byId = useMemo(() => new Map<string, TaskDto>(tasks.map((t) => [t.id, t])), [tasks]);
  const statusOfOver = useCallback(
    (overId: string | undefined | null): TaskStatus | null => (overId ? (statusOfDropId(overId) ?? byId.get(overId)?.status ?? null) : null),
    [byId],
  );
  const titleOf = (id: string | number) => byId.get(String(id))?.title ?? 'la tarjeta';

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Tomaste «${titleOf(active.id)}». Usa las flechas para moverla; Espacio para soltar, Esc para cancelar.`,
    onDragOver: ({ over }) => {
      const status = statusOfOver(over ? String(over.id) : null);
      return status ? `Sobre la columna «${columnName(status)}».` : undefined;
    },
    onDragEnd: ({ active, over }) => {
      const move = computeDrop(idsByColumn(tasks), String(active.id), over ? String(over.id) : null);
      return move ? moveAnnouncement(titleOf(active.id), move.status) : `«${titleOf(active.id)}» quedó donde estaba.`;
    },
    onDragCancel: () => 'Cancelaste el movimiento.',
  };

  const clear = () => {
    setActiveId(null);
    setOverStatus(null);
  };
  const onDragStart = (event: DragStartEvent) => setActiveId(String(event.active.id));
  const onDragOver = (event: DragOverEvent) => setOverStatus(statusOfOver(event.over ? String(event.over.id) : null));
  const onDragEnd = (event: DragEndEvent) => {
    const move = computeDrop(idsByColumn(tasks), String(event.active.id), event.over ? String(event.over.id) : null);
    clear();
    if (move) onMove({ id: String(event.active.id), ...move });
  };

  const active = activeId ? byId.get(activeId) : undefined;
  return (
    <OverContext.Provider value={{ overStatus }}>
      <DndContext
        sensors={sensors}
        collisionDetection={collision}
        accessibility={{ announcements, screenReaderInstructions: { draggable: INSTRUCTIONS } }}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={clear}
      >
        {children}
        <DragOverlay dropAnimation={null}>{enabled && active ? renderOverlay(active) : null}</DragOverlay>
      </DndContext>
    </OverContext.Provider>
  );
}

/** Convierte una tarjeta en arrastrable y en destino de soltado (para saber ante cuál se suelta). */
export function useCardDnd(id: string, enabled: boolean) {
  const drag = useDraggable({ id, disabled: !enabled });
  const drop = useDroppable({ id, disabled: !enabled });
  const { setNodeRef: setDrag } = drag;
  const { setNodeRef: setDrop } = drop;
  const ref = useCallback(
    (node: HTMLElement | null) => {
      setDrag(node);
      setDrop(node);
    },
    [setDrag, setDrop],
  );
  // La tarjeta sigue siendo un `article`: solo se toman los atributos de ayuda, no `role="button"`.
  const { role: _role, 'aria-pressed': _pressed, ...attributes } = drag.attributes;
  return { ref, isDragging: drag.isDragging, props: enabled ? { ...attributes, ...drag.listeners } : {} };
}

/** Una columna es destino de soltado aunque esté vacía o desplazada. */
export function useColumnDrop(status: TaskStatus, enabled: boolean) {
  const { setNodeRef } = useDroppable({ id: columnDropId(status), disabled: !enabled });
  return setNodeRef;
}

export const COLUMN_IDS = COLUMNS.map((column) => columnDropId(column.id));
