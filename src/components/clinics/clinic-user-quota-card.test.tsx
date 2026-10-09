import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderWithClient, setupMockApi } from '@test/render';
import { getDb } from '@/mocks/db';
import { ClinicUserQuotaCard } from './clinic-user-quota-card';

setupMockApi();

const quotaValue = (label: string) => screen.getByText(label).parentElement as HTMLElement;

describe('ClinicUserQuotaCard', () => {
  it('muestra el snapshot y permite aumentar los cupos adicionales', async () => {
    const user = userEvent.setup();
    getDb().clinics.find(
      (clinic) => clinic.id === 'c-podologico-x',
    )!.subscription!.additionalUsers = 2;
    renderWithClient(<ClinicUserQuotaCard clinicId="c-podologico-x" />);

    expect(await screen.findByText('Usuarios de la clínica')).toBeInTheDocument();
    expect(screen.getByText('Cupos del snapshot del plan Pro.')).toBeInTheDocument();
    expect(quotaValue('Límite del plan')).toHaveTextContent('5');
    expect(quotaValue('Cupos adicionales')).toHaveTextContent('2');
    expect(quotaValue('Límite efectivo')).toHaveTextContent('7');
    expect(quotaValue('Disponibles')).toHaveTextContent('5');

    await user.click(screen.getByRole('button', { name: 'Ajustar cupos' }));
    const dialog = screen.getByRole('dialog', { name: 'Agregar cupos adicionales' });
    const input = within(dialog).getByLabelText('Cantidad a agregar');
    await user.clear(input);
    await user.type(input, '3');
    expect(within(dialog).getByText(/Después del cambio: 5/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Nuevo límite efectivo: 10/)).toBeInTheDocument();
    await user.type(
      within(dialog).getByLabelText('Motivo (obligatorio)'),
      'Ampliación comercial aprobada',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Agregar cupos' }));

    expect(await screen.findByText('Cupos actualizados')).toBeInTheDocument();
    expect(quotaValue('Cupos adicionales')).toHaveTextContent('5');
    expect(quotaValue('Límite efectivo')).toHaveTextContent('10');
    expect(quotaValue('Disponibles')).toHaveTextContent('8');
    expect(
      getDb().clinics.find((clinic) => clinic.id === 'c-podologico-x')?.subscription,
    ).toMatchObject({ additionalUsers: 5 });
    expect(getDb().auditLogs[0]).toMatchObject({
      action: 'USER_QUOTA_CHANGED',
      reason: 'Ampliación comercial aprobada',
    });
  });

  it('deshabilita el ajuste cuando la clínica no tiene suscripción', async () => {
    renderWithClient(<ClinicUserQuotaCard clinicId="c-piel-sana" />);
    expect(await screen.findByText('Cupos del snapshot sin plan asignado.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ajustar cupos' })).toBeDisabled();
    expect(screen.getByText('Límite alcanzado')).toBeInTheDocument();
  });

  it('no permite enviar una cantidad negativa', async () => {
    const user = userEvent.setup();
    const clinic = getDb().clinics.find((item) => item.id === 'c-podologico-x')!;
    const initialAdditionalUsers = clinic.subscription!.additionalUsers;
    renderWithClient(<ClinicUserQuotaCard clinicId="c-podologico-x" />);

    await screen.findByText('Usuarios de la clínica');
    await user.click(screen.getByRole('button', { name: 'Ajustar cupos' }));
    const dialog = screen.getByRole('dialog', { name: 'Agregar cupos adicionales' });
    const input = within(dialog).getByLabelText('Cantidad a agregar');
    await user.clear(input);
    await user.type(input, '-1');
    await user.type(within(dialog).getByLabelText('Motivo (obligatorio)'), 'Intento inválido');
    await user.click(within(dialog).getByRole('button', { name: 'Agregar cupos' }));

    expect(await within(dialog).findByText('Debe agregar al menos un cupo')).toBeInTheDocument();
    expect(clinic.subscription!.additionalUsers).toBe(initialAdditionalUsers);
  });
});
