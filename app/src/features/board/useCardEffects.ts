import { useEffect } from 'react';
import type { RefObject } from 'react';

/**
 * Efectos de puntero de las tarjetas (foco de luz en Grafito, inclinación en Papel): un solo oyente en el tablero que
 * escribe `--mx --my --rx --ry` en la tarjeta bajo el puntero, como máximo una vez por cuadro.
 */
export function useCardEffects(board: RefObject<HTMLElement>): void {
  useEffect(() => {
    const el = board.current;
    if (!el || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    let pending: PointerEvent | null = null;
    let frame = 0;

    const apply = () => {
      frame = 0;
      const event = pending;
      pending = null;
      const card = (event?.target as HTMLElement | null)?.closest<HTMLElement>('.card');
      if (!event || !card) return;
      const rect = card.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      card.style.setProperty('--mx', `${x}px`);
      card.style.setProperty('--my', `${y}px`);
      card.style.setProperty('--rx', `${((y / rect.height - 0.5) * -7).toFixed(2)}deg`);
      card.style.setProperty('--ry', `${((x / rect.width - 0.5) * 9).toFixed(2)}deg`);
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      pending = event;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const onOut = (event: PointerEvent) => {
      const card = (event.target as HTMLElement).closest<HTMLElement>('.card');
      if (card && !card.contains(event.relatedTarget as Node | null)) {
        card.style.removeProperty('--rx');
        card.style.removeProperty('--ry');
      }
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerout', onOut);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerout', onOut);
      cancelAnimationFrame(frame);
    };
  }, [board]);
}
