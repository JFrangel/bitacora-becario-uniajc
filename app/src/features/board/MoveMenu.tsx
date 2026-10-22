import { useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { TaskStatus } from '../../../convex/lib/types';
import { COLUMNS } from './columns';

type MoveMenuProps = { taskId: string; status: TaskStatus; title: string; onMove: (id: string, status: TaskStatus, beforeId?: string) => void };

/** Menú «Mover a…»: lo mismo que arrastrar, pero con un clic o con el teclado. */
export function MoveMenu({ taskId, status, title, onMove }: MoveMenuProps) {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<CSSProperties>({});
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLElement>('button')?.focus();
    const onPointer = (event: PointerEvent) => {
      if (!list.current?.contains(event.target as Node) && !button.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  // El menú es `fixed`: la lista con scroll de la columna no lo recorta.
  const toggle = () => {
    if (!open && button.current) {
      const rect = button.current.getBoundingClientRect();
      setPlace({ right: Math.max(8, window.innerWidth - rect.right), bottom: Math.max(8, window.innerHeight - rect.top + 6) });
    }
    setOpen((o) => !o);
  };

  const choose = (target: TaskStatus) => {
    setOpen(false);
    onMove(taskId, target);
  };

  return (
    <span className="mv">
      <button ref={button} className="mvbtn" type="button" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined} aria-label={`Mover «${title}» a…`} title="Mover a…" onClick={toggle}>
        ⋯
      </button>
      {open && (
        <ul ref={list} id={id} className="mvmenu" role="menu" aria-label="Mover a…" style={place}>
          {COLUMNS.filter((column) => column.id !== status).map((column) => (
            <li key={column.id} role="none">
              <button type="button" role="menuitem" onClick={() => choose(column.id)}>
                {column.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}
