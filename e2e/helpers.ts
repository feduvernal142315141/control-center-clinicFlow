import { expect, type Page } from '@playwright/test';

export const PASSWORD = 'KodeWave2026!';

/** No usar getByRole('alert'): Next.js tiene su propio route announcer con ese rol. */
export const formAlert = (page: Page) => page.locator('[data-slot="alert"]');

export async function login(page: Page, email: string, password = PASSWORD) {
  await page.getByLabel('Correo').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
}

export async function loginAsAdmin(page: Page, path = '/') {
  await page.goto(`/login?next=${encodeURIComponent(path)}`);
  await login(page, 'admin@kodewave.com');
  await expect(page).toHaveURL(path);
  await expect(page.getByTestId('user-menu')).toBeVisible();
}
