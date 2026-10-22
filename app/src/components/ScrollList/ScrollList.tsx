import { cloneElement, isValidElement, useRef } from 'react';
import type { KeyboardEvent, ReactElement, ReactNode } from 'react';
import { useScrollList } from './useScrollList';

type ScrollListProps<T> = {
  items: readonly T[];
  /** Debe devolver un único elemento (la tarjeta): el motor le añade `data-sl`. */
  renderItem: (item: T, index: number) => ReactNode;
  getKey: (item: T) => string | number;
  /** Ajusta el desplazamiento a cada tarjeta (`scroll-snap-type: y proximity`). */
  snap?: boolean;
  maxHeight?: string;
  /** Clases extra de la envoltura (`sl-wrap`), del área que se desplaza (`sl`) y de la pista interior opcional. */
  wrapClassName?: string;
  className?: string;
  trackClassName?: string;
  /** Se muestra (dentro del área que se desplaza) cuando no hay elementos. */
  empty?: ReactNode;
  /** Se muestra después de los elementos (por ejemplo «Mostrar 8 más»); no es una tarjeta del motor. */
  footer?: ReactNode;
};

const INTERACTIVE_INSIDE = 'input, textarea, select, [contenteditable="true"]';

/**
 * Lista con scroll animado: sin barra visible, bordes que se difuminan y tarjetas que se encogen y desvanecen al salir
 * de la vista. Con las flechas ↑ ↓ el foco pasa a la tarjeta anterior o siguiente.
 */
export function ScrollList<T>({ items, renderItem, getKey, snap = false, maxHeight, wrapClassName = '', className = '', trackClassName, empty, footer }: ScrollListProps<T>) {
  const ref = useRef<HTMLDivElement>(null);
  useScrollList(ref, [items]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    if ((event.target as HTMLElement).closest(INTERACTIVE_INSIDE)) return;
    const cards = [...ref.current!.querySelectorAll<HTMLElement>('[data-sl]')];
    const index = cards.findIndex((card) => card === document.activeElement || card.contains(document.activeElement));
    if (index === -1) return;
    event.preventDefault();
    const target = cards[Math.min(cards.length - 1, Math.max(0, index + (event.key === 'ArrowDown' ? 1 : -1)))];
    target.focus();
  };

  const nodes = items.map((item, index) => {
    const node = renderItem(item, index);
    const key = getKey(item);
    return isValidElement(node) ? cloneElement(node as ReactElement<{ 'data-sl'?: string }>, { key, 'data-sl': '' }) : node;
  });

  return (
    <div className={`sl-wrap${wrapClassName ? ` ${wrapClassName}` : ''}`}>
      <div ref={ref} className={`sl${className ? ` ${className}` : ''}${snap ? ' snap' : ''}`} style={maxHeight ? { maxHeight } : undefined} onKeyDown={onKeyDown}>
        {items.length === 0 && empty ? empty : trackClassName ? <div className={trackClassName}>{nodes}</div> : nodes}
        {footer}
      </div>
    </div>
  );
}
