import { expect, test } from '@playwright/test';
import { login } from './helpers';

const REASON = (what: string) => `E2E: ${what} de punta a punta`;

/**
 * Cierre del MVP: login → crear clínica → cambiar plan con vista previa → override →
 * suspender → reactivar → todo visible en auditoría (tab de clínica y global).
 */
test('flujo completo del MVP', async ({ page }) => {
  const stamp = Date.now();
  const name = `MVP E2E ${stamp}`;
  const slug = `mvp-e2e-${stamp}`;

  await test.step('login', async () => {
    await page.goto('/login');
    await login(page, 'admin@kodewave.com');
    await expect(page.getByTestId('user-menu')).toBeVisible();
  });

  await test.step('crear clínica', async () => {
    await page.getByRole('link', { name: 'Clínicas', exact: true }).click();
    await page.getByRole('link', { name: 'Nueva clínica' }).click();
    await page.getByLabel('Nombre', { exact: true }).fill(name);
    await expect(page.getByLabel('Slug')).toHaveValue(slug);
    await page.getByLabel('Especialidad').selectOption('DENTAL');
    await page.getByLabel('Plan').selectOption('BASIC');
    await page.getByLabel('Nombre completo').fill('Admin MVP');
    await page.getByLabel('Correo').fill('admin@mvp-e2e.com');
    await page.getByRole('button', { name: 'Crear clínica' }).click();
    await expect(page.getByRole('heading', { name })).toBeVisible();
  });

  await test.step('cambiar plan con vista previa', async () => {
    await page.getByRole('button', { name: 'Cambiar plan' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Plan').selectOption('PREMIUM');
    const on = dialog.getByRole('list', { name: /Pasan de OFF a ON/ });
    await expect(on).toContainText('COMMS_WHATSAPP');
    await expect(on).toContainText('DENTAL_ODONTOGRAM');
    await dialog.getByLabel('Motivo (obligatorio)').fill(REASON('upgrade'));
    await dialog.getByRole('button', { name: 'Guardar suscripción' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText('Premium')).toBeVisible();
  });

  await test.step('override OFF de WhatsApp con efecto real', async () => {
    await page.getByRole('tab', { name: 'Overrides' }).click();
    await page.getByRole('button', { name: 'Nuevo override' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('OFF').check();
    await dialog.getByLabel('Módulo').selectOption('COMMS_WHATSAPP');
    await dialog.getByLabel('Motivo (obligatorio)').fill(REASON('pausa de WhatsApp'));
    await dialog.getByRole('button', { name: 'Guardar override' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId('effect-COMMS_WHATSAPP')).toHaveText('Con efecto');

    await page.getByRole('tab', { name: 'Módulos efectivos' }).click();
    await expect(page.getByTestId('denied-COMMS_WHATSAPP')).toHaveText('OFF: apagado por override');
    await expect(page.getByTestId('denied-AI_RECEPTIONIST')).toHaveText(
      'OFF: falta dependencia COMMS_WHATSAPP',
    );
  });

  await test.step('suspender', async () => {
    await page.getByRole('button', { name: 'Suspender' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Motivo (obligatorio)').fill(REASON('suspensión'));
    await dialog.getByLabel(/para confirmar/).fill(slug);
    await dialog.getByRole('button', { name: 'Suspender clínica' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId('denied-CORE_PATIENTS')).toHaveText(
      'OFF: la clínica está suspendida o inactiva',
    );
  });

  await test.step('reactivar', async () => {
    await page.getByRole('button', { name: 'Reactivar' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Motivo (obligatorio)').fill(REASON('reactivación'));
    await dialog.getByRole('button', { name: 'Reactivar' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('button', { name: 'Suspender' })).toBeVisible();
  });

  await test.step('todo queda en la auditoría de la clínica', async () => {
    await page.getByRole('tab', { name: 'Auditoría' }).click();
    const table = page.getByRole('table', { name: 'Eventos de auditoría' });
    const actions = table.locator('tbody tr code');
    await expect(actions).toHaveText([
      'CLINIC_REACTIVATED',
      'CLINIC_SUSPENDED',
      'MODULE_OVERRIDE_SET',
      'PLAN_CHANGED',
      'CLINIC_CREATED',
    ]);
    await table
      .getByRole('row', { name: /PLAN_CHANGED/ })
      .getByRole('button', { name: 'Ver detalle' })
      .click();
    const detail = page.getByRole('dialog');
    await expect(detail).toContainText(REASON('upgrade'));
    const planRow = detail.locator('tr[data-kind="changed"]', { hasText: 'planCode' });
    await expect(planRow).toContainText('BASIC');
    await expect(planRow).toContainText('PREMIUM');
    await page.keyboard.press('Escape');
  });

  await test.step('y en la auditoría global filtrando por clínica y acción', async () => {
    await page.getByRole('link', { name: 'Auditoría', exact: true }).click();
    await page.getByLabel('Clínica').fill(slug);
    await page.getByRole('button', { name: new RegExp(name) }).click();
    await page.getByLabel('Acción').selectOption('CLINIC_SUSPENDED');
    await expect(page).toHaveURL(/clinicId=c-\d+/);
    await expect(page).toHaveURL(/action=CLINIC_SUSPENDED/);
    const rows = page.getByRole('table', { name: 'Eventos de auditoría' }).locator('tbody tr');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText(REASON('suspensión'));
    await expect(rows.first().getByRole('link', { name })).toBeVisible();
  });
});
