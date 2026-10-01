import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithClient, setupMockApi } from '@test/render';
import { getDb } from '@/mocks/db';
import { PlanMatrix } from './plan-matrix';

const server = setupMockApi();
const REASON = 'Ajuste comercial del plan acordado';

function setup(planId = 'p-basic') {
  const db = getDb();
  const plan = structuredClone(db.plans.find((p) => p.id === planId)!);
  const bodies: unknown[] = [];
  server.events.on('request:start', async ({ request }) => {
    if (request.method === 'PUT' && request.url.endsWith(`/plans/${planId}/modules`)) {
      bodies.push(await request.clone().json());
    }
  });
  renderWithClient(<PlanMatrix plan={plan} catalog={structuredClone(db.modules)} />);
  return { bodies, user: userEvent.setup() };
}

const row = (code: string) => within(screen.getByTestId(`matrix-row-${code}`));

describe('PlanMatrix', () => {
  it('core obligatorio: fila bloqueada en ON con badge', () => {
    setup();
    const core = screen.getByLabelText('Incluir CORE_PATIENTS');
    expect(core).toBeChecked();
    expect(core).toBeDisabled();
    expect(row('CORE_PATIENTS').getByText('Core obligatorio')).toBeInTheDocument();
    expect(screen.getByLabelText('Incluir COMMS_WHATSAPP')).toBeEnabled();
    expect(row('COMMS_WHATSAPP').queryByText('Core obligatorio')).not.toBeInTheDocument();
  });

  it('advierte (sin bloquear) un módulo ON sin sus dependencias', async () => {
    const { user } = setup();
    expect(screen.queryByRole('list', { name: 'Dependencias faltantes' })).not.toBeInTheDocument();
    await user.click(screen.getByLabelText('Incluir AI_RECEPTIONIST'));
    const warning = screen.getByRole('list', { name: 'Dependencias faltantes' });
    expect(warning).toHaveTextContent('AI_RECEPTIONIST requiere COMMS_WHATSAPP');
    expect(screen.getByRole('button', { name: 'Guardar matriz' })).toBeEnabled();

    await user.click(screen.getByLabelText('Incluir COMMS_WHATSAPP'));
    expect(screen.queryByRole('list', { name: 'Dependencias faltantes' })).not.toBeInTheDocument();
  });

  it('guardar exige motivo y manda la matriz completa con core en ON', async () => {
    const { user, bodies } = setup();
    await user.click(screen.getByLabelText('Incluir GROWTH_REVIEWS'));
    await user.click(screen.getByRole('button', { name: 'Guardar matriz' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar matriz' }));
    expect(
      await within(dialog).findByText('El motivo debe tener al menos 10 caracteres'),
    ).toBeInTheDocument();
    expect(bodies).toHaveLength(0);

    await user.type(within(dialog).getByLabelText('Motivo (obligatorio)'), REASON);
    await user.click(within(dialog).getByRole('button', { name: 'Guardar matriz' }));
    await vi.waitFor(() => expect(bodies).toHaveLength(1));
    const body = bodies[0] as {
      reason: string;
      modules: { moduleCode: string; enabled: boolean }[];
    };
    expect(body.reason).toBe(REASON);
    expect(body.modules).toHaveLength(getDb().modules.length);
    const byCode = Object.fromEntries(body.modules.map((m) => [m.moduleCode, m.enabled]));
    expect(byCode).toMatchObject({
      CORE_PATIENTS: true,
      GROWTH_REVIEWS: true,
      AI_RECEPTIONIST: false,
    });
  });

  it('límites: número o ilimitado (null); inválidos bloquean el guardado', async () => {
    const { user, bodies } = setup('p-pro');
    // PRO trae COMMS_WHATSAPP.monthlyMessages = 2000
    await user.click(screen.getByLabelText('Agregar límite a COMMS_WHATSAPP'));
    const names = screen.getAllByLabelText('Nombre del límite de COMMS_WHATSAPP');
    await user.type(names[1], 'Plantillas');
    expect(screen.getByText('Nombre inválido (camelCase)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar matriz' })).toBeDisabled();

    await user.clear(names[1]);
    await user.type(names[1], 'templates');
    const checks = row('COMMS_WHATSAPP').getAllByLabelText('Ilimitado');
    await user.click(checks[1]);
    expect(screen.getByRole('button', { name: 'Guardar matriz' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Guardar matriz' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Motivo (obligatorio)'), REASON);
    await user.click(within(dialog).getByRole('button', { name: 'Guardar matriz' }));
    await vi.waitFor(() => expect(bodies).toHaveLength(1));
    const wa = (bodies[0] as { modules: { moduleCode: string; limits?: unknown }[] }).modules.find(
      (m) => m.moduleCode === 'COMMS_WHATSAPP',
    );
    expect(wa?.limits).toEqual({ monthlyMessages: 2000, templates: null });
  });

  it('los límites de un módulo no incluido están deshabilitados', () => {
    setup();
    expect(screen.getByLabelText('Agregar límite a AI_RECEPTIONIST')).toBeDisabled();
  });
});
