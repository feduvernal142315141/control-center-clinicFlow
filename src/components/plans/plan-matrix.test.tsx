import { QueryClientProvider } from '@tanstack/react-query';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
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
  const reload = vi.fn(async () => getDb().plans.find((p) => p.id === planId)!.version);
  const view = renderWithClient(
    <PlanMatrix plan={plan} catalog={structuredClone(db.modules)} reload={reload} />,
  );
  return { bodies, reload, view, plan, user: userEvent.setup() };
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

  it('límites: solo las claves de allowedLimits, sin texto libre', async () => {
    const { user, bodies } = setup('p-pro');
    // PRO trae COMMS_WHATSAPP: maxWhatsAppNumbers = 1, maxMonthlyMessages = 2000
    expect(row('COMMS_WHATSAPP').queryByRole('textbox')).not.toBeInTheDocument();
    const selects = row('COMMS_WHATSAPP').getAllByLabelText('Límite de COMMS_WHATSAPP');
    expect(selects).toHaveLength(2);
    expect(
      within(selects[0])
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Números de WhatsApp (números)']);
    // Ya están las dos claves permitidas: no se ofrece agregar más.
    expect(screen.queryByLabelText('Agregar límite a COMMS_WHATSAPP')).not.toBeInTheDocument();

    await user.click(screen.getByLabelText('maxMonthlyMessages ilimitado en COMMS_WHATSAPP'));
    await user.click(screen.getByRole('button', { name: 'Guardar matriz' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Motivo (obligatorio)'), REASON);
    await user.click(within(dialog).getByRole('button', { name: 'Guardar matriz' }));
    await vi.waitFor(() => expect(bodies).toHaveLength(1));
    const body = bodies[0] as {
      version: number;
      modules: { moduleCode: string; limits?: unknown }[];
    };
    expect(body.version).toBe(1);
    expect(body.modules.find((m) => m.moduleCode === 'COMMS_WHATSAPP')?.limits).toEqual({
      maxWhatsAppNumbers: 1,
      maxMonthlyMessages: null,
    });
  });

  it('agregar un límite ofrece solo las claves no usadas; valor inválido bloquea', async () => {
    const { user } = setup('p-basic');
    await user.click(screen.getByLabelText('Incluir MARKETING_CAMPAIGNS'));
    await user.click(screen.getByLabelText('Agregar límite a MARKETING_CAMPAIGNS'));
    const select = screen.getByLabelText('Límite de MARKETING_CAMPAIGNS');
    expect(select).toHaveValue('maxCampaignsPerMonth');
    expect(screen.getByText('Entero ≥ 0 o "ilimitado"')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar matriz' })).toBeDisabled();
    await user.type(
      screen.getByLabelText('Valor de maxCampaignsPerMonth en MARKETING_CAMPAIGNS'),
      '4',
    );
    expect(screen.getByRole('button', { name: 'Guardar matriz' })).toBeEnabled();
  });

  it('un módulo sin allowedLimits no muestra editor de límites', () => {
    setup();
    expect(row('GROWTH_REVIEWS').getByText('No admite límites')).toBeInTheDocument();
    expect(screen.queryByLabelText('Agregar límite a GROWTH_REVIEWS')).not.toBeInTheDocument();
  });

  it('los límites de un módulo no incluido están deshabilitados', () => {
    setup();
    expect(screen.getByLabelText('Agregar límite a MARKETING_CAMPAIGNS')).toBeDisabled();
  });

  it('VERSION_CONFLICT: avisa, recarga y conserva lo editado; guardar de nuevo usa la versión nueva', async () => {
    const { user, bodies, reload } = setup();
    // Otra persona guarda el plan mientras tanto.
    getDb().plans.find((p) => p.id === 'p-basic')!.version = 5;

    await user.click(screen.getByLabelText('Incluir GROWTH_REVIEWS'));
    await user.click(screen.getByRole('button', { name: 'Guardar matriz' }));
    let dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Motivo (obligatorio)'), REASON);
    await user.click(within(dialog).getByRole('button', { name: 'Guardar matriz' }));

    expect(await screen.findByTestId('version-conflict')).toHaveTextContent(
      'Alguien modificó esto mientras editabas',
    );
    expect(reload).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Incluir GROWTH_REVIEWS')).toBeChecked(); // se conservó

    await user.click(screen.getByRole('button', { name: 'Guardar matriz' }));
    dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Motivo (obligatorio)'), REASON);
    await user.click(within(dialog).getByRole('button', { name: 'Guardar matriz' }));
    await vi.waitFor(() => expect(bodies).toHaveLength(2));
    expect((bodies[0] as { version: number }).version).toBe(1);
    expect((bodies[1] as { version: number }).version).toBe(5);
    await vi.waitFor(() =>
      expect(screen.queryByTestId('version-conflict')).not.toBeInTheDocument(),
    );
  });

  it('VERSION_CONFLICT: "Descartar mis cambios" vuelve a lo del servidor', async () => {
    server.use(
      http.put('http://localhost:3000/api/platform/plans/p-basic/modules', () =>
        HttpResponse.json(
          { code: 'VERSION_CONFLICT', message: 'Cambió', details: { currentVersion: 2 } },
          { status: 409 },
        ),
      ),
    );
    const { user, plan, view } = setup();
    await user.click(screen.getByLabelText('Incluir GROWTH_REVIEWS'));
    await user.click(screen.getByRole('button', { name: 'Guardar matriz' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Motivo (obligatorio)'), REASON);
    await user.click(within(dialog).getByRole('button', { name: 'Guardar matriz' }));
    await screen.findByTestId('version-conflict');
    // Llega la versión nueva del servidor (el padre re-renderiza con el plan recargado).
    view.rerender(
      <QueryClientProvider client={view.queryClient}>
        <PlanMatrix
          plan={{ ...plan, version: 2 }}
          catalog={structuredClone(getDb().modules)}
          reload={async () => 2}
        />
      </QueryClientProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Descartar mis cambios' }));
    expect(screen.getByLabelText('Incluir GROWTH_REVIEWS')).not.toBeChecked();
    expect(screen.queryByTestId('version-conflict')).not.toBeInTheDocument();
  });
});
