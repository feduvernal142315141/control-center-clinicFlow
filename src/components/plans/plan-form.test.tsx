import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithClient, setupMockApi } from '@test/render';
import { getDb } from '@/mocks/db';
import { PlanForm } from './plan-form';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

const server = setupMockApi();

describe('PlanForm', () => {
  it('crear: valida el code y navega a la matriz del plan nuevo', async () => {
    const user = userEvent.setup();
    renderWithClient(<PlanForm />);
    await user.type(screen.getByLabelText('Código'), 'pro anual');
    await user.type(screen.getByLabelText('Nombre'), 'Pro anual');
    await user.click(screen.getByRole('button', { name: 'Crear plan' }));
    expect(await screen.findByText('Solo mayúsculas, números y guion bajo')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Código'));
    await user.type(screen.getByLabelText('Código'), 'PRO_ANUAL');
    await user.click(screen.getByRole('button', { name: 'Crear plan' }));
    await vi.waitFor(() =>
      expect(push).toHaveBeenCalledWith(expect.stringMatching(/^\/planes\/p-/)),
    );
    const created = getDb().plans.find((p) => p.code === 'PRO_ANUAL')!;
    // Un plan nuevo arranca solo con los core.
    expect(created.modules.filter((m) => m.enabled).map((m) => m.moduleCode)).toEqual([
      'CORE_PATIENTS',
      'CORE_APPOINTMENTS',
      'CORE_CLINICAL_RECORDS',
    ]);
  });

  it('editar: el code es de solo lectura y no se envía', async () => {
    const bodies: unknown[] = [];
    server.events.on('request:start', async ({ request }) => {
      if (request.method === 'PUT') bodies.push(await request.clone().json());
    });
    const user = userEvent.setup();
    renderWithClient(
      <PlanForm plan={structuredClone(getDb().plans.find((p) => p.code === 'PRO')!)} />,
    );
    expect(screen.getByLabelText('Código')).toHaveValue('PRO');
    expect(screen.getByLabelText('Código')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Guardar datos del plan' })).toBeDisabled();

    await user.clear(screen.getByLabelText('Nombre'));
    await user.type(screen.getByLabelText('Nombre'), 'Pro 2026');
    await user.click(screen.getByRole('button', { name: 'Guardar datos del plan' }));
    await vi.waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).not.toHaveProperty('code');
    expect(getDb().plans.find((p) => p.code === 'PRO')!.name).toBe('Pro 2026');
  });
});
