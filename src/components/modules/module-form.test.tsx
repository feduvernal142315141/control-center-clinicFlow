import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { renderWithClient, setupMockApi } from '@test/render';
import { getDb } from '@/mocks/db';
import { ModuleForm } from './module-form';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

const server = setupMockApi();
const API = 'http://localhost:3000/api/platform';

function renderEdit(code: string) {
  const catalog = structuredClone(getDb().modules);
  const target = catalog.find((m) => m.code === code)!;
  renderWithClient(<ModuleForm module={target} catalog={catalog} />);
  return { target, user: userEvent.setup() };
}

const depCheckbox = (code: string) =>
  within(screen.getByRole('group', { name: 'Dependencias' })).getByRole('checkbox', {
    name: new RegExp(`^${code}`),
  });

describe('ModuleForm: core obligatorio', () => {
  it('no se puede desactivar, dejar de ser core ni borrar', () => {
    renderEdit('CORE_PATIENTS');
    expect(screen.getByLabelText('Activo')).toBeDisabled();
    expect(screen.getByLabelText('Activo')).toBeChecked();
    expect(screen.getByLabelText(/Core obligatorio \(siempre ON/)).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Borrar módulo' })).not.toBeInTheDocument();
  });

  it('el code no se puede editar', () => {
    renderEdit('COMMS_WHATSAPP');
    expect(screen.getByLabelText('Código')).toHaveAttribute('readonly');
  });
});

describe('ModuleForm: editor de dependencias', () => {
  it('auto-dependencia A → A', async () => {
    const { user } = renderEdit('GROWTH_REVIEWS');
    await user.click(depCheckbox('GROWTH_REVIEWS'));
    expect(screen.getByTestId('dependency-issue')).toHaveTextContent(
      'Un módulo no puede depender de sí mismo',
    );
    expect(screen.getByTestId('dependency-issue')).toHaveTextContent(
      'GROWTH_REVIEWS → GROWTH_REVIEWS',
    );
    expect(screen.getByRole('button', { name: 'Guardar módulo' })).toBeDisabled();
  });

  it('muestra el camino del ciclo y quitar la arista lo arregla', async () => {
    const { user } = renderEdit('CORE_PATIENTS');
    await user.click(depCheckbox('AI_RECEPTIONIST'));
    expect(screen.getByTestId('dependency-issue')).toHaveTextContent(
      'CORE_PATIENTS → AI_RECEPTIONIST → COMMS_WHATSAPP → CORE_APPOINTMENTS → CORE_PATIENTS',
    );
    expect(screen.getByRole('button', { name: 'Guardar módulo' })).toBeDisabled();

    await user.click(depCheckbox('AI_RECEPTIONIST'));
    expect(screen.queryByTestId('dependency-issue')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar módulo' })).toBeEnabled();
  });

  it('muestra MODULE_DEPENDENCY_CYCLE del backend aunque el cliente no lo detecte', async () => {
    server.use(
      http.put(`${API}/modules/:id`, () =>
        HttpResponse.json(
          {
            code: 'MODULE_DEPENDENCY_CYCLE',
            message: 'Ciclo de dependencias detectado por el backend',
            details: { cycle: ['GROWTH_REVIEWS', 'X_REMOTE', 'GROWTH_REVIEWS'] },
          },
          { status: 409 },
        ),
      ),
    );
    const { user } = renderEdit('GROWTH_REVIEWS');
    await user.click(depCheckbox('COMMS_EMAIL_REMINDERS'));
    await user.click(screen.getByRole('button', { name: 'Guardar módulo' }));
    const alert = await screen.findByTestId('dependency-backend-error');
    expect(alert).toHaveTextContent('Ciclo de dependencias detectado por el backend');
    expect(alert).toHaveTextContent('GROWTH_REVIEWS → X_REMOTE → GROWTH_REVIEWS');
    expect(push).not.toHaveBeenCalled();
  });

  it('guardar manda el módulo sin code (no editable)', async () => {
    const bodies: unknown[] = [];
    server.events.on('request:start', async ({ request }) => {
      if (request.method === 'PUT') bodies.push(await request.clone().json());
    });
    const { user, target } = renderEdit('GROWTH_REVIEWS');
    await user.click(depCheckbox('COMMS_EMAIL_REMINDERS'));
    await user.click(screen.getByRole('button', { name: 'Guardar módulo' }));
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith('/modulos'));
    expect(bodies[0]).not.toHaveProperty('code');
    expect(bodies[0]).toMatchObject({ dependsOn: ['COMMS_EMAIL_REMINDERS'] });
    expect(getDb().modules.find((m) => m.id === target.id)!.dependsOn).toEqual([
      'COMMS_EMAIL_REMINDERS',
    ]);
  });
});

describe('ModuleForm: borrar', () => {
  it('exige motivo y muestra el rechazo del backend (dependientes)', async () => {
    const { user } = renderEdit('COMMS_WHATSAPP');
    await user.click(screen.getByRole('button', { name: 'Borrar módulo' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Borrar módulo' }));
    expect(
      await within(dialog).findByText('El motivo debe tener al menos 10 caracteres'),
    ).toBeInTheDocument();
    await user.type(
      within(dialog).getByLabelText('Motivo (obligatorio)'),
      'Ya no se ofrece WhatsApp',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Borrar módulo' }));
    expect(
      await within(dialog).findByText(/AI_RECEPTIONIST depende\(n\) de COMMS_WHATSAPP/),
    ).toBeInTheDocument();
    expect(getDb().modules.some((m) => m.code === 'COMMS_WHATSAPP')).toBe(true);
  });
});

describe('ModuleForm: crear', () => {
  it('crea con code en mayúsculas y dependencias', async () => {
    const user = userEvent.setup();
    renderWithClient(<ModuleForm catalog={structuredClone(getDb().modules)} />);
    await user.type(screen.getByLabelText('Código'), 'comms_sms');
    await user.type(screen.getByLabelText('Nombre'), 'SMS');
    await user.click(depCheckbox('CORE_APPOINTMENTS'));
    await user.click(screen.getByRole('button', { name: 'Crear módulo' }));
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith('/modulos'));
    expect(getDb().modules.find((m) => m.code === 'COMMS_SMS')).toMatchObject({
      dependsOn: ['CORE_APPOINTMENTS'],
      requiredCore: false,
    });
  });
});
