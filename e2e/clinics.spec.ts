import { expect, test } from '@playwright/test';
import { loginAsAdmin } from './helpers';

// Cada test usa una clínica distinta: el estado de los mocks se comparte en el servidor.

test('dashboard muestra KPIs y enlaza a la lista filtrada', async ({ page }) => {
  await loginAsAdmin(page);
  await expect(page.getByTestId('kpi-totalClinics')).toHaveText(/\d+/);
  await page.getByRole('link', { name: /Suspendidas/ }).click();
  await expect(page).toHaveURL('/clinicas?status=SUSPENDED');
  await expect(page.getByRole('link', { name: 'Sonrisas del Norte' })).toBeVisible();
  await expect(page.getByRole('link', { name: "Clínica Dental D'Armas" })).toHaveCount(0);
});

test('buscar y filtrar clínicas', async ({ page }) => {
  await loginAsAdmin(page, '/clinicas');
  await page.getByLabel('Buscar por nombre o slug').fill('podol');
  await expect(page).toHaveURL(/q=podol/);
  await expect(page.getByRole('link', { name: 'Centro Podológico X' })).toBeVisible();
  await page.getByLabel('Plan').selectOption('PRO');
  await expect(page).toHaveURL(/planCode=PRO/);
  await expect(page.getByRole('link', { name: 'Pie Sano Valencia' })).toHaveCount(0);
});

test('módulos efectivos explican por qué están OFF', async ({ page }) => {
  await loginAsAdmin(page, '/clinicas/c-podologico-x?tab=modulos');
  await expect(page.getByTestId('denied-DENTAL_ODONTOGRAM')).toHaveText(
    'OFF: no es compatible con la especialidad de la clínica',
  );
  await page.goto('/clinicas/c-lara?tab=modulos');
  await expect(page.getByTestId('denied-AI_RECEPTIONIST')).toHaveText(
    'OFF: falta dependencia COMMS_WHATSAPP',
  );
});

test('crear clínica y ver su detalle', async ({ page }) => {
  const name = `E2E Clínica ${Date.now()}`;
  await loginAsAdmin(page, '/clinicas/nueva');
  await page.getByLabel('Nombre', { exact: true }).fill(name);
  await page.getByLabel('Especialidad').selectOption('GENERAL');
  await page.getByLabel('Plan').selectOption('BASIC');
  await page.getByLabel('Nombre completo').fill('Admin E2E');
  await page.getByLabel('Correo').fill('admin@e2e.com');
  await page.getByRole('button', { name: 'Crear clínica' }).click();
  await expect(page).toHaveURL(/\/clinicas\/c-\d+/);
  await expect(page.getByRole('heading', { name })).toBeVisible();
  await expect(page.getByText('Medicina general')).toBeVisible();
});

test('suspender exige slug y motivo; reactivar vuelve a activar', async ({ page }) => {
  await loginAsAdmin(page, '/clinicas/c-pie-sano-valencia');
  await page.getByRole('button', { name: 'Suspender' }).click();
  const dialog = page.getByRole('dialog');
  const confirm = dialog.getByRole('button', { name: 'Suspender clínica' });
  await dialog.getByLabel('Motivo (obligatorio)').fill('Prueba e2e de suspensión por impago');
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel(/para confirmar/).fill('pie-sano-valencia');
  await confirm.click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Suspendida').first()).toBeVisible();

  await page.getByRole('tab', { name: 'Módulos efectivos' }).click();
  await expect(page.getByTestId('denied-CORE_PATIENTS')).toHaveText(
    'OFF: la clínica está suspendida o inactiva',
  );

  await page.getByRole('button', { name: 'Reactivar' }).click();
  await page
    .getByRole('dialog')
    .getByLabel('Motivo (obligatorio)')
    .fill('Pago recibido, se reactiva');
  await page.getByRole('dialog').getByRole('button', { name: 'Reactivar' }).click();
  await expect(page.getByRole('button', { name: 'Suspender' })).toBeVisible();
});

test('cambiar especialidad con motivo', async ({ page }) => {
  await loginAsAdmin(page, '/clinicas/c-consultorio-san-rafael');
  await page.getByRole('button', { name: 'Cambiar especialidad' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nueva especialidad').selectOption('PODIATRY');
  await dialog.getByLabel('Motivo (obligatorio)').fill('La clínica cambió de rubro a podología');
  await dialog.getByRole('button', { name: 'Cambiar especialidad' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Podología')).toBeVisible();
});

test('cambiar plan con motivo', async ({ page }) => {
  await loginAsAdmin(page, '/clinicas/c-dental-care-maracay');
  await page.getByRole('button', { name: 'Cambiar plan' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Plan').selectOption('PREMIUM');
  await dialog.getByLabel('Motivo (obligatorio)').fill('Upgrade comercial acordado con la clínica');
  await dialog.getByRole('button', { name: 'Guardar suscripción' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Premium')).toBeVisible();
});

test('una clínica INACTIVE se reactiva con motivo', async ({ page }) => {
  await loginAsAdmin(page, '/clinicas/c-piel-sana');
  await expect(page.getByRole('button', { name: 'Suspender' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Reactivar' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Motivo (obligatorio)').fill('La clínica vuelve a operar este mes');
  await dialog.getByRole('button', { name: 'Reactivar' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Suspender' })).toBeVisible();
});

test('cambiar especialidad muestra el impacto antes de confirmar', async ({ page }) => {
  await loginAsAdmin(page, '/clinicas/c-darmas');
  await page.getByRole('button', { name: 'Cambiar especialidad' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nueva especialidad').selectOption('PODIATRY');
  const off = dialog.getByRole('list', { name: /Pasan de ON a OFF/ });
  await expect(off.getByText('DENTAL_ODONTOGRAM')).toBeVisible();
  await expect(dialog.getByRole('list', { name: /Pasan de OFF a ON/ })).toContainText(
    'PODIATRY_FOOT_EXAM',
  );
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByText('Odontología')).toBeVisible(); // no se guardó nada
});

test('editar el nombre exige motivo', async ({ page }) => {
  await loginAsAdmin(page, '/clinicas/c-sonrisa-perfecta');
  await page.getByRole('button', { name: 'Editar nombre' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nombre').fill('Sonrisa Perfecta Centro');
  await dialog.getByLabel('Motivo (obligatorio)').fill('Cambio de nombre comercial');
  await dialog.getByRole('button', { name: 'Guardar nombre' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Sonrisa Perfecta Centro' })).toBeVisible();
});
