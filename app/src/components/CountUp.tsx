import { useLayoutEffect, useRef } from 'react';

const DURATION_MS = 800;
const prefersReducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Número que sube animado (800 ms, curva cúbica de salida). Escribe el texto directamente en el elemento, sin volver a
 * renderizar por cada cuadro, y con «reducir movimiento» muestra el valor final al instante.
 */
export function CountUp({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const ref = useRef<HTMLElement>(null);
  const shown = useRef(0);
  const frame = useRef(0);

  useLayoutEffect(() => {
    const el = ref.current!;
    const format = (n: number) => n.toLocaleString('es-CO', { maximumFractionDigits: decimals });
    const from = shown.current;
    shown.current = value;
    cancelAnimationFrame(frame.current);
    if (prefersReducedMotion() || from === value) {
      el.textContent = format(value);
      return;
    }
    el.textContent = format(from);
    const start = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / DURATION_MS);
      el.textContent = format(from + (value - from) * (1 - (1 - k) ** 3));
      if (k < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [value, decimals]);

  return <b ref={ref} data-value={value} />;
}
