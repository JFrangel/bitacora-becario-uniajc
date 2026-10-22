/** El 3D solo se usa si el navegador tiene WebGL, no se pidió reducir el movimiento y el componente ya cargó. */
export function shouldUse3D(env: { webgl: boolean; reducedMotion: boolean; scriptLoaded: boolean }): boolean {
  return env.webgl && !env.reducedMotion && env.scriptLoaded;
}

export function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

export const prefersReducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Trabajo pesado fuera del camino de las animaciones: se espera a que el navegador esté libre. */
export function scheduleIdle(fn: () => void, delay = 0): () => void {
  const timer = setTimeout(() => {
    if (typeof requestIdleCallback === 'function') requestIdleCallback(() => fn(), { timeout: 2000 });
    else fn();
  }, delay);
  return () => clearTimeout(timer);
}
