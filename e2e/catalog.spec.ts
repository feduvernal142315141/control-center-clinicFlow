import { expect, test } from '@playwright/test';
import { loginAsAdmin } from './helpers';

test('crear plan y configurar su matriz con motivo', async ({ page }) => {
  const code = `E2E_${Date.now()}`;
  await loginAsAdmin(page, '/planes/nuevo');
  await page.getByLabel('Código').fill(code);
  await page.getByLabel('Nombre', { exact: true }).fill('Plan E2E');
  await page.getByRole('button', { name: 'Crear plan' }).click();
  await expect(page).toHaveURL(/\/planes\/p-\d+/);
  await expect(page.getByRole('heading', { name: 'Plan E2E' })).toBeVisible();

  const core = page.getByLabel('Incluir CORE_PATIENTS');
  await expect(core).toBeChecked();
  await expect(core).toBeDisabled();

  await page.getByLabel('Incluir AI_RECEPTIONIST').check();
  await expect(page.getByRole('list', { name: 'Dependencias faltantes' })).toContainText(
    'AI_RECEPTIONIST requiere COMMS_WHATSAPP',
  );
  await page.getByRole('button', { name: 'Guardar matriz' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Motivo (obligatorio)').fill('Plan de prueba e2e con IA');
  await dialog.getByRole('button', { name: 'Guardar matriz' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByLabel('Incluir AI_RECEPTIONIST')).toBeChecked();
});

test('el editor de dependencias muestra el camino del ciclo', async ({ page }) => {
  await loginAsAdmin(page, '/modulos');
  await page.getByRole('link', { name: 'Odontograma', exact: true }).click();
  await expect(page.getByLabel('Código')).toHaveValue('DENTAL_ODONTOGRAM');
  await page
    .getByRole('group', { name: 'Dependencias' })
    .getByRole('checkbox', { name: /^DENTAL_TREATMENT_PLANS/ })
    .check();
  await expect(page.getByTestId('dependency-issue')).toContainText(
    'DENTAL_ODONTOGRAM → DENTAL_TREATMENT_PLANS → DENTAL_ODONTOGRAM',
  );
  await expect(page.getByRole('button', { name: 'Guardar módulo' })).toBeDisabled();
});

test('un módulo core no se puede desactivar ni borrar', async ({ page }) => {
  await loginAsAdmin(page, '/modulos');
  await page.getByRole('link', { name: 'Pacientes', exact: true }).click();
  await expect(page.getByLabel('Activo')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Borrar módulo' })).toHaveCount(0);
});

test('especialidades con conteos', async ({ page }) => {
  await loginAsAdmin(page, '/especialidades');
  const row = page.getByRole('row', { name: /Podología/ });
  await expect(row.getByRole('link')).toHaveAttribute('href', '/clinicas?specialtyCode=PODIATRY');
});

test('dashboard: bloque Trials con vencidos y por vencer', async ({ page }) => {
  await loginAsAdmin(page);
  await page.getByRole('list', { name: 'Vencidos' }).getByRole('link').first().click();
  await expect(page.getByRole('heading', { name: 'Podología Trial Vencido' })).toBeVisible();
  await expect(page.getByText('Pago vencido')).toBeVisible();
  await expect(page.getByText('Activa').first()).toBeVisible();
});

test('desactivar un módulo comercial muestra el uso y exige motivo', async ({ page }) => {
  await loginAsAdmin(page, '/modulos/m-marketing-campaigns');
  await expect(page.getByRole('button', { name: /Borrar/ })).toHaveCount(0);
  await page.getByLabel('Activo').uncheck();
  await page.getByRole('button', { name: 'Guardar módulo' }).click();
  const dialog = page.getByRole('dialog', { name: 'Desactivar módulo' });
  await expect(dialog.getByTestId('usage-count')).toContainText('lo tiene');
  await dialog.getByLabel('Motivo (obligatorio)').fill('Campañas se pausan este trimestre');
  await dialog.getByRole('button', { name: 'Desactivar módulo' }).click();
  await expect(page).toHaveURL('/modulos');
  await expect(page.getByRole('row', { name: /Campañas/ }).getByText('Inactivo')).toBeVisible();
});

test('la matriz solo ofrece los límites del catálogo', async ({ page }) => {
  await loginAsAdmin(page, '/planes/p-pro');
  await expect(page.getByTestId('matrix-row-GROWTH_REVIEWS')).toContainText('No admite límites');
  const selects = page.getByLabel('Límite de COMMS_WHATSAPP');
  await expect(selects).toHaveCount(2);
});
