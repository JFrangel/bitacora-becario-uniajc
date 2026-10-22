import { expect, test } from '@playwright/test';
import { EDIT_BUTTONS, readSeed } from './seed';

test.describe('enlace de solo lectura', () => {
  test('muestra todo y no deja editar nada', async ({ page }) => {
    await page.goto(`/#/ver/${readSeed().shareToken}`);
    await expect(page.getByText('Tarea de prueba 01')).toBeVisible();
    await expect(page.locator('.who-text')).toHaveText('Solo lectura');
    for (const tab of ['Tablero', 'Calendario', 'Bitácora', 'Historial']) await expect(page.getByRole('button', { name: new RegExp(`^${tab}`) })).toBeVisible();
    for (const name of EDIT_BUTTONS) await expect(page.getByRole('button', { name })).toHaveCount(0);
  });

  test('las tarjetas no se pueden arrastrar', async ({ page }) => {
    await page.goto(`/#/ver/${readSeed().shareToken}`);
    const done = page.locator('[data-col="done"] .card');
    const before = await done.count();
    const card = page.locator('[data-col="todo"] .card').first();
    const [from, to] = [await card.boundingBox(), await page.locator('[data-col="done"]').boundingBox()];
    await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
    await page.mouse.down();
    await page.mouse.move(to!.x + to!.width / 2, to!.y + 120, { steps: 12 });
    await page.mouse.up();
    await expect(done).toHaveCount(before);
    await expect(page.locator('[data-col="todo"] .card').first()).toContainText('Tarea de prueba 01');
  });

  test('la tarea se abre como detalle, con los campos deshabilitados', async ({ page }) => {
    await page.goto(`/#/ver/${readSeed().shareToken}`);
    await page.getByText('Tarea de prueba 01').click();
    const dialog = page.getByRole('dialog', { name: 'Detalle de la tarea' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Nombre de la tarea')).toBeDisabled();
    await expect(dialog.getByRole('button', { name: /Guardar|Eliminar/ })).toHaveCount(0);
  });

  test('la Bitácora muestra los registros y el carné de la dueña', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/#/ver/${readSeed().shareToken}/bitacora`);
    await expect(page.getByText('Reunión de arranque')).toBeVisible();
    await expect(page.getByText('Vista de solo lectura')).toBeVisible();
    const hasWebGL = await page.evaluate(() => Boolean(document.createElement('canvas').getContext('webgl2')));
    test.skip(!hasWebGL, 'Este navegador no tiene WebGL: el carné se ve plano.');
    await expect(page.locator('#journalBadgeStage canvas')).toBeVisible();
    await expect(page.locator('.badge-hit')).toHaveCount(2);
  });

  test('un enlace que no existe muestra «Este enlace ya no está activo»', async ({ page }) => {
    await page.goto('/#/ver/enlace-que-no-existe');
    await expect(page.getByRole('heading', { name: 'Este enlace ya no está activo' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Secciones' })).toHaveCount(0);
  });

  test('no pide nada a otro dominio que no sea de Convex', async ({ page }) => {
    const foreign: string[] = [];
    page.on('request', (request) => {
      const { protocol, hostname } = new URL(request.url());
      if (/^https?:|^wss?:/.test(protocol) && !/^(localhost|127\.0\.0\.1)$/.test(hostname) && !hostname.endsWith('.convex.cloud') && hostname !== new URL(page.url() || 'http://x').hostname) foreign.push(request.url());
    });
    await page.goto(`/#/ver/${readSeed().shareToken}/bitacora`);
    await expect(page.getByText('Reunión de arranque')).toBeVisible();
    expect(foreign).toEqual([]);
  });
});
