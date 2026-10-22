import { expect, test } from '@playwright/test';
import { readSeed } from './seed';

test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

test('a 375 px no hay desborde horizontal y cada columna muestra 5 tarjetas con «Mostrar más»', async ({ page }) => {
  await page.goto(`/#/ver/${readSeed().shareToken}`);
  await expect(page.getByText('Tarea de prueba 01')).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  const todo = page.locator('[data-col="todo"]');
  await expect(todo.locator('.card')).toHaveCount(5);
  await expect(todo.getByRole('button', { name: 'Mostrar 25 más' })).toBeVisible();
  for (const column of await page.locator('[data-col]:not(.card)').all()) expect(await column.locator('.card').count()).toBeLessThanOrEqual(5);

  await todo.getByRole('button', { name: 'Mostrar 25 más' }).click();
  await expect(todo.locator('.card')).toHaveCount(30);
  await expect(todo.getByRole('button', { name: 'Mostrar menos' })).toBeVisible();
});

test('las pestañas siguen a ancho completo y el perfil se abre a pantalla completa', async ({ page }) => {
  await page.goto(`/#/ver/${readSeed().shareToken}`);
  await page.getByRole('button', { name: 'Ver el perfil de quien registra' }).click();
  const panel = page.getByRole('dialog', { name: 'Perfil' });
  await expect(panel).toBeVisible();
  const box = await panel.boundingBox();
  expect(Math.round(box!.width)).toBe(375);
});
