import { expect, test, type Page } from '@playwright/test';

const PASSWORD = 'KodeWave2026!';

// No usar getByRole('alert'): Next.js tiene su propio route announcer con ese rol.
const formAlert = (page: Page) => page.locator('[data-slot="alert"]');

async function login(page: Page, email: string, password = PASSWORD) {
  await page.getByLabel('Correo').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
}

test('sin sesión, una ruta protegida redirige a /login y vuelve tras autenticarse', async ({
  page,
}) => {
  await page.goto('/clinicas');
  await expect(page).toHaveURL(/\/login\?next=%2Fclinicas/);

  await login(page, 'admin@kodewave.com');
  await expect(page).toHaveURL('/clinicas');
  await expect(page.getByRole('heading', { name: 'Clínicas' })).toBeVisible();
  await expect(page.getByTestId('user-menu')).toContainText('admin@kodewave.com');
});

test('los tokens viven en cookies httpOnly, Secure y SameSite=Strict', async ({
  page,
  context,
}) => {
  await page.goto('/login');
  await login(page, 'admin@kodewave.com');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  const cookies = await context.cookies();
  for (const name of ['kw_at', 'kw_rt']) {
    const cookie = cookies.find((c) => c.name === name);
    expect(cookie, name).toBeDefined();
    expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: 'Strict' });
  }
  expect(await page.evaluate(() => document.cookie)).not.toContain('kw_');
  const storage = await page.evaluate(() => JSON.stringify({ ...window.localStorage }));
  expect(storage).toBe('{}');
});

test('credenciales inválidas muestran el error del backend', async ({ page }) => {
  await page.goto('/login');
  await login(page, 'nadie@kodewave.com', 'incorrecta');
  await expect(formAlert(page)).toContainText('Correo o contraseña incorrectos.');
  await expect(page).toHaveURL(/\/login/);
});

test('cuenta bloqueada muestra el error', async ({ page }) => {
  await page.goto('/login');
  await login(page, 'locked@kodewave.com');
  await expect(formAlert(page)).toContainText('bloqueada');
});

test('login con 2FA (TOTP)', async ({ page }) => {
  await page.goto('/login');
  await login(page, 'mfa@kodewave.com');

  const code = page.getByLabel('Código de verificación');
  await code.fill('000000');
  await page.getByRole('button', { name: 'Verificar' }).click();
  await expect(formAlert(page)).toContainText('Código incorrecto.');

  await code.fill('123456');
  await page.getByRole('button', { name: 'Verificar' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByTestId('user-menu')).toContainText('mfa@kodewave.com');
});

test('logout borra la sesión y protege las rutas otra vez', async ({ page, context }) => {
  await page.goto('/login');
  await login(page, 'admin@kodewave.com');
  await expect(page.getByTestId('user-menu')).toBeVisible();

  await page.getByTestId('user-menu').click();
  await page.getByRole('menuitem', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL('/login');
  expect((await context.cookies()).filter((c) => c.name.startsWith('kw_'))).toHaveLength(0);

  await page.goto('/modulos');
  await expect(page).toHaveURL(/\/login\?next=%2Fmodulos/);
});

test('el BFF no expone el backend sin sesión', async ({ request }) => {
  const res = await request.get('/api/platform/me');
  expect(res.status()).toBe(401);
  expect((await res.json()).code).toBe('UNAUTHENTICATED');
});
