import { expect, test } from '@playwright/test';
import { readSeed } from './seed';

const STYLES = [
  ['Grafito', 'grafito'],
  ['Papel', 'papel'],
  ['Tinta viva', 'tinta'],
] as const;
const MODES = [
  ['Oscuro', 'dark'],
  ['Claro', 'light'],
] as const;

test('los seis temas cambian data-theme y data-mode, y se conservan al recargar', async ({ page }) => {
  await page.goto(`/#/ver/${readSeed().shareToken}`);
  await expect(page.getByText('Tarea de prueba 01')).toBeVisible();
  const app = page.locator('.app');
  for (const [styleLabel, style] of STYLES) {
    for (const [modeLabel, mode] of MODES) {
      await page.getByRole('button', { name: 'Apariencia' }).click();
      await page.getByRole('button', { name: new RegExp(`^${styleLabel}`) }).click();
      await page.getByRole('button', { name: modeLabel, exact: true }).click();
      await expect(app).toHaveAttribute('data-theme', style);
      await expect(app).toHaveAttribute('data-mode', mode);
      await page.reload();
      await expect(page.getByText('Tarea de prueba 01')).toBeVisible();
      await expect(app).toHaveAttribute('data-theme', style);
      await expect(app).toHaveAttribute('data-mode', mode);
    }
  }
});
