import { useEffect } from 'react';
import type { RefObject } from 'react';

/** Alto del degradado de cada borde, en píxeles. */
export const FADE = 56;

/** Curva `smootherstep` muestreada: [posición dentro del degradado, opacidad]. */
const STOPS: ReadonlyArray<readonly [number, number]> = [[0, 0], [0.15, 0.027], [0.3, 0.163], [0.45, 0.407], [0.6, 0.683], [0.75, 0.897], [0.9, 0.991], [1, 1]];

/** Tamaño del degradado de arriba y de abajo según lo desplazado (`max` = alto total − alto visible). */
export function fadeSizes(scrollTop: number, max: number): { top: number; bottom: number } {
  if (max <= 1) return { top: 0, bottom: 0 };
  return { top: Math.min(FADE, scrollTop), bottom: Math.min(FADE, Math.max(0, max - scrollTop)) };
}

/** `mask-image` con píxeles: lo que se escribe en línea (no variables CSS que heredarían todas las tarjetas). */
export function fadeMask(top: number, bottom: number): string {
  const head = STOPS.map(([p, a]) => `rgba(0,0,0,${a}) ${(top * p).toFixed(1)}px`);
  const tail = [...STOPS].reverse().map(([p, a]) => `rgba(0,0,0,${a}) calc(100% - ${(bottom * p).toFixed(1)}px)`);
  return `linear-gradient(to bottom, ${[...head, ...tail].join(', ')})`;
}

export type CardState = 'in' | 'above' | 'below';

/** Una tarjeta está «dentro» si se ve al menos un tercio de ella; si no, está arriba o abajo del área visible. */
export function stateFor(top: number, height: number, viewport: number): CardState {
  const visible = (Math.min(top + height, viewport) - Math.max(top, 0)) / Math.max(1, height);
  if (visible >= 0.34) return 'in';
  return top < 0 ? 'above' : 'below';
}

const prefersReducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Motor del scroll animado (mecánica de AnimatedList de React Bits). En cada cuadro **primero lee** (`scrollTop`,
 * `scrollHeight`, `clientHeight` y la posición de cada tarjeta, una vez) y **después escribe** (el degradado, solo si
 * cambió de paso de 4 px, y el estado de las tarjetas que cambiaron). Las tarjetas se guardan en caché y se vuelven a
 * buscar cuando cambia `deps`.
 */
export function useScrollList(ref: RefObject<HTMLElement>, deps: ReadonlyArray<unknown>): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cards: HTMLElement[] | null = null;
    let maskKey = '';
    let queued = false;

    const layout = () => {
      queued = false;
      // 1. Lecturas
      const scrollHeight = el.scrollHeight;
      const viewport = el.clientHeight;
      const scrollTop = el.scrollTop;
      const list = (cards ??= [...el.querySelectorAll<HTMLElement>('[data-sl]')]);
      const geometry = list.map((card) => [card.offsetTop, card.offsetHeight] as const);
      const max = scrollHeight - viewport;
      const scrollable = max > 1;
      const { top, bottom } = fadeSizes(scrollTop, max);
      const key = `${top >> 2}|${bottom >> 2}`;
      const reduced = prefersReducedMotion();

      // 2. Escrituras
      if (maskKey !== key) {
        maskKey = key;
        const mask = fadeMask(top, bottom);
        el.style.setProperty('-webkit-mask-image', mask);
        (el.style as CSSStyleDeclaration & { maskImage: string }).maskImage = mask;
      }
      list.forEach((card, index) => {
        const current = card.getAttribute('data-state');
        if (!scrollable || reduced) {
          if (current !== null) card.removeAttribute('data-state');
          return;
        }
        const next = stateFor(geometry[index][0] - scrollTop, geometry[index][1], viewport);
        if (current !== next) card.setAttribute('data-state', next);
      });
    };

    const schedule = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(layout);
    };

    layout();
    el.addEventListener('scroll', schedule, { passive: true });
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
    observer?.observe(el);
    return () => {
      el.removeEventListener('scroll', schedule);
      observer?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
