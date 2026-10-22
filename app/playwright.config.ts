import { defineConfig } from '@playwright/test';

/**
 * Pruebas de extremo a extremo contra un despliegue de DESARROLLO de Convex (nunca producción):
 *   1. `npx convex dev` (o `npx convex deploy` a un despliegue de desarrollo) y, en ese despliegue, `E2E_ENABLED=1`.
 *   2. `npm run e2e` arranca la aplicación (Vite apuntando a ese despliegue), siembra los datos con `testing:seed` y
 *      corre los escenarios. `E2E_BASE_URL` apunta a una copia ya publicada en lugar de arrancar Vite.
 *   3. `npm run e2e -- --grep @perf` corre solo el humo de rendimiento; en un equipo real y con ventana (`--headed`).
 * Usa el Chrome instalado (`channel: 'chrome'`): no descarga navegadores.
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';

export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL, channel: 'chrome', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: process.env.E2E_BASE_URL ? undefined : { command: 'npm run dev -- --port 5173 --strictPort', url: baseURL, reuseExistingServer: true, timeout: 60_000 },
});
