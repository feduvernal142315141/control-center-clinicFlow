import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithClient, setupMockApi } from '@test/render';
import { getDb } from '@/mocks/db';
import { CreateClinicForm } from './create-clinic-form';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

setupMockApi();

async function fill(user: ReturnType<typeof userEvent.setup>, name: string) {
  await screen.findByRole('option', { name: 'Podología' });
  await user.type(screen.getByLabelText('Nombre'), name);
  await user.selectOptions(screen.getByLabelText('Especialidad'), 'PODIATRY');
  await user.selectOptions(screen.getByLabelText('Plan'), 'PRO');
  await user.type(screen.getByLabelText('Nombre completo'), 'Pedro Pie');
  await user.type(screen.getByLabelText('Correo'), 'pedro@pies.com');
}

describe('CreateClinicForm', () => {
  it('genera el slug desde el nombre, crea y navega al detalle', async () => {
    const user = userEvent.setup();
    renderWithClient(<CreateClinicForm />);
    await fill(user, 'Pies Felices Mérida');
    expect(screen.getByLabelText('Slug')).toHaveValue('pies-felices-merida');
    await user.click(screen.getByRole('button', { name: 'Crear clínica' }));
    await vi.waitFor(() =>
      expect(push).toHaveBeenCalledWith(expect.stringMatching(/^\/clinicas\/c-/)),
    );
    expect(getDb().clinics.find((c) => c.slug === 'pies-felices-merida')).toMatchObject({
      specialtyCode: 'PODIATRY',
      planCode: 'PRO',
    });
  });

  it('VALIDATION_ERROR del backend se muestra en el campo', async () => {
    const user = userEvent.setup();
    renderWithClient(<CreateClinicForm />);
    await fill(user, 'Centro Podologico X');
    await user.click(screen.getByRole('button', { name: 'Crear clínica' }));
    expect(await screen.findByText('Ese slug ya está en uso')).toBeInTheDocument();
    expect(screen.getByLabelText('Slug')).toHaveAttribute('aria-invalid', 'true');
  });

  it('valida en el cliente los campos obligatorios', async () => {
    const user = userEvent.setup();
    renderWithClient(<CreateClinicForm />);
    await screen.findByRole('option', { name: 'Podología' });
    await user.click(screen.getByRole('button', { name: 'Crear clínica' }));
    expect(await screen.findByText('Selecciona una especialidad')).toBeInTheDocument();
    expect(screen.getByText('Selecciona un plan')).toBeInTheDocument();
    expect(screen.getByText('Correo inválido')).toBeInTheDocument();
  });

  it('un trial exige fecha de fin y la envía como ISO', async () => {
    const user = userEvent.setup();
    renderWithClient(<CreateClinicForm />);
    await fill(user, 'Trial Podológico');
    await user.click(screen.getByLabelText('Empieza en periodo de prueba (trial)'));
    await user.click(screen.getByRole('button', { name: 'Crear clínica' }));
    expect(await screen.findByText('Un trial necesita fecha de fin')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Fin del trial'), '2026-11-30');
    await user.click(screen.getByRole('button', { name: 'Crear clínica' }));
    await vi.waitFor(() => expect(push).toHaveBeenCalled());
    const created = getDb().clinics.find((c) => c.slug === 'trial-podologico')!;
    expect(created).toMatchObject({ operationalStatus: 'ACTIVE', trial: true });
    expect(created.subscription?.endsAt).toBe(new Date('2026-11-30T00:00:00').toISOString());
  });
});
