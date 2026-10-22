import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readSeed } from './seed';

/**
 * Humo de rendimiento (criterio 26). Mide los intervalos entre cuadros (`requestAnimationFrame`) mientras se desplaza y
 * falla si más del 5 % superan 50 ms. Córrelo en un equipo real y con ventana: `npm run e2e -- --grep @perf --headed`.
 * Un navegador sin tarjeta gráfica dibuja el 3D por software y puede fallar sin que haya un problema real.
 */
const MAX_SLOW_SHARE = 0.05;
const SLOW_MS = 50;
const DURATION_MS = 3000;

/** Desplaza el elemento de arriba abajo y de vuelta durante `ms` y devuelve los intervalos entre cuadros. */
async function frameIntervals(page: Page, selector: string | null, ms: number) {
  return page.evaluate(
    ({ selector, ms }) =>
      new Promise<{ intervals: number[]; longFrames: number }>((resolve) => {
        const target = selector ? document.querySelector<HTMLElement>(selector) : null;
        const intervals: number[] = [];
        let longFrames = 0;
        try {
          new PerformanceObserver((list) => (longFrames += list.getEntries().length)).observe({ type: 'long-animation-frame', buffered: false });
        } catch {
          /* el navegador no ofrece long-animation-frame */
        }
        const start = performance.now();
        let last = start;
        const step = (now: number) => {
          intervals.push(now - last);
          last = now;
          const progress = (now - start) / ms;
          if (target) {
            const range = target.scrollHeight - target.clientHeight;
            target.scrollTop = range * (progress < 0.5 ? progress * 2 : (1 - progress) * 2);
          }
          if (now - start < ms) requestAnimationFrame(step);
          else resolve({ intervals, longFrames });
        };
        requestAnimationFrame(step);
      }),
    { selector, ms },
  );
}

const slowShare = (intervals: number[]) => intervals.filter((interval) => interval > SLOW_MS).length / Math.max(1, intervals.length);

test.describe('@perf', () => {
  test('desplazar una columna con 30 tarjetas no pierde cuadros', async ({ page }) => {
    await page.goto(`/#/ver/${readSeed().shareToken}`);
    await expect(page.getByText('Tarea de prueba 30')).toBeAttached();
    const { intervals } = await frameIntervals(page, '[data-col="todo"] .col-scroll', DURATION_MS);
    expect(intervals.length).toBeGreaterThan(20);
    expect(slowShare(intervals)).toBeLessThanOrEqual(MAX_SLOW_SHARE);
  });

  test('la Bitácora con el carné 3D en reposo tampoco', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/#/ver/${readSeed().shareToken}/bitacora`);
    await expect(page.getByText('Reunión de arranque')).toBeVisible();
    const hasWebGL = await page.evaluate(() => Boolean(document.createElement('canvas').getContext('webgl2')));
    test.skip(!hasWebGL, 'Sin WebGL el carné se ve plano: no hay nada 3D que medir.');
    await expect(page.locator('#journalBadgeStage canvas')).toBeVisible();
    await page.waitForTimeout(3000); // deja que el carné termine de caer y quede en reposo
    const { intervals } = await frameIntervals(page, null, DURATION_MS);
    expect(slowShare(intervals)).toBeLessThanOrEqual(MAX_SLOW_SHARE);
  });
});
