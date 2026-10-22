import { expect, test } from '@playwright/test';
import { readSeed } from './seed';

/**
 * Canjear la invitación exige iniciar sesión con Google, y una prueba automática no puede (ni debe) tener una cuenta de Google.
 * Aquí se prueba todo lo que ocurre ANTES del inicio de sesión; el recorrido completo (nombre y rol, crear y mover tareas,
 * que no aparezca la Bitácora, que el enlace no sirva dos veces, «Mi perfil» y «Editar perfil») se hace a mano con dos cuentas
 * reales de Google en el corte: ver CUTOVER.md, «Recorrido con dos cuentas».
 */
test.describe('invitación', () => {
  test('pide iniciar sesión con Google antes de aceptar', async ({ page }) => {
    await page.goto(`/#/invitacion/${readSeed().inviteToken}`);
    await expect(page.getByRole('heading', { name: /Te invitaron/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continuar con Google' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Secciones' })).toHaveCount(0);
  });

  test('una invitación que no existe dice que ya no es válida', async ({ page }) => {
    await page.goto('/#/invitacion/no-existe');
    await expect(page.getByRole('heading', { name: 'Esta invitación ya no es válida' })).toBeVisible();
  });

  test('sin sesión, la entrada pide entrar con Google y no muestra datos', async ({ page }) => {
    await page.goto('/#/');
    await expect(page.getByRole('button', { name: 'Entrar con Google' })).toBeVisible();
    await expect(page.getByText('Tarea de prueba 01')).toHaveCount(0);
  });

  test.fixme('canjear la invitación: nombre y rol, tablero sin Bitácora, enlace de un solo uso', () => {
    // Necesita una cuenta de Google real: se recorre a mano (CUTOVER.md).
  });
});
