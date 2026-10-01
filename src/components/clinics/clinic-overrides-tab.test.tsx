import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithClient, setupMockApi } from '@test/render';
import { getDb } from '@/mocks/db';
import { ClinicOverridesTab } from './clinic-overrides-tab';

const server = setupMockApi();
const REASON = 'Ajuste comercial acordado con la clínica';

function setup(clinicId: string) {
  const clinic = structuredClone(getDb().clinics.find((c) => c.id === clinicId)!);
  const requests: string[] = [];
  const bodies: unknown[] = [];
  server.events.on('request:start', async ({ request }) => {
    const path = new URL(request.url).pathname;
    requests.push(`${request.method} ${path}`);
    if (request.method === 'PUT') bodies.push(await request.clone().json());
  });
  renderWithClient(<ClinicOverridesTab clinic={clinic} />);
  return { user: userEvent.setup(), requests, bodies };
}

describe('ClinicOverridesTab', () => {
  it('lista vigentes con su efecto real (del backend) y los vencidos aparte', async () => {
    setup('c-lara');
    const vigentes = await screen.findByRole('table', { name: 'Overrides vigentes' });
    const wa = within(vigentes).getByTestId('override-COMMS_WHATSAPP');
    expect(wa).toHaveTextContent('OFF');
    expect(wa).toHaveTextContent('admin@kodewave.com');
    expect(wa).toHaveTextContent('La clínica pidió pausar WhatsApp');
    expect(await within(vigentes).findByTestId('effect-COMMS_WHATSAPP')).toHaveTextContent(
      'Con efecto',
    );
    // ON por override, pero el backend lo niega por dependencia: "sin efecto".
    expect(within(vigentes).getByTestId('effect-AI_RECEPTIONIST')).toHaveTextContent(
      'Sin efecto: OFF: falta dependencia COMMS_WHATSAPP',
    );
    expect(within(vigentes).getByTestId('override-AI_RECEPTIONIST')).toHaveTextContent(
      'Sin vencimiento',
    );
  });

  it('vencidos: sección aparte, "Vencido" y sin efecto', async () => {
    setup('c-darmas');
    const vencidos = await screen.findByRole('table', { name: 'Overrides vencidos' });
    expect(within(vencidos).getByText('Vencido')).toBeInTheDocument();
    expect(within(vencidos).getByTestId('effect-GROWTH_REVIEWS')).toHaveTextContent(
      'Vencido: sin efecto',
    );
    expect(screen.getByText('Esta clínica no tiene overrides vigentes')).toBeInTheDocument();
  });

  it('OFF no ofrece módulos core', async () => {
    const { user } = setup('c-vida');
    await user.click(await screen.findByRole('button', { name: 'Nuevo override' }));
    const dialog = screen.getByRole('dialog');
    const select = within(dialog).getByLabelText('Módulo');
    expect(within(select).getByRole('option', { name: /CORE_PATIENTS/ })).toBeInTheDocument();
    await user.click(within(dialog).getByLabelText('OFF'));
    expect(within(select).queryByRole('option', { name: /CORE_/ })).not.toBeInTheDocument();
  });

  it('ON advierte especialidad incompatible y dependencias faltantes, sin bloquear', async () => {
    const { user, bodies, requests } = setup('c-podologico-x');
    await user.click(await screen.findByRole('button', { name: 'Nuevo override' }));
    const dialog = screen.getByRole('dialog');
    await user.selectOptions(within(dialog).getByLabelText('Módulo'), 'DENTAL_TREATMENT_PLANS');
    const warnings = await within(dialog).findByTestId('override-warnings');
    expect(warnings).toHaveTextContent('El backend lo va a negar');
    expect(warnings).toHaveTextContent(
      'No es compatible con la especialidad de la clínica (Podología)',
    );
    expect(warnings).toHaveTextContent(
      'Faltan dependencias que hoy están OFF en la clínica: DENTAL_ODONTOGRAM',
    );

    await user.click(within(dialog).getByRole('button', { name: 'Guardar override' }));
    expect(
      await within(dialog).findByText('El motivo debe tener al menos 10 caracteres'),
    ).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Motivo (obligatorio)'), REASON);
    await user.click(within(dialog).getByRole('button', { name: 'Guardar override' }));
    await vi.waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({
      overrides: [
        { moduleCode: 'DENTAL_TREATMENT_PLANS', enabled: true, reason: REASON, expiresAt: null },
      ],
      reason: REASON,
      version: 1,
    });
    // Después de guardar se refrescan los módulos efectivos.
    const put = requests.indexOf('PUT /api/platform/clinics/c-podologico-x/module-overrides');
    await vi.waitFor(() =>
      expect(
        requests
          .slice(put + 1)
          .includes('GET /api/platform/clinics/c-podologico-x/effective-modules'),
      ).toBe(true),
    );
  });

  it('vencimiento: fecha pasada no se acepta', async () => {
    const { user } = setup('c-vida');
    await user.click(await screen.findByRole('button', { name: 'Nuevo override' }));
    const dialog = screen.getByRole('dialog');
    await user.selectOptions(within(dialog).getByLabelText('Módulo'), 'GROWTH_REVIEWS');
    await user.type(within(dialog).getByLabelText('Vence (opcional)'), '2020-01-01');
    await user.type(within(dialog).getByLabelText('Motivo (obligatorio)'), REASON);
    await user.click(within(dialog).getByRole('button', { name: 'Guardar override' }));
    expect(
      await within(dialog).findByText('El vencimiento debe ser una fecha futura'),
    ).toBeInTheDocument();
  });

  it('quitar exige motivo y manda la lista sin ese override', async () => {
    const { user, bodies } = setup('c-lara');
    await user.click(
      await screen.findByRole('button', { name: 'Quitar override de COMMS_WHATSAPP' }),
    );
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Quitar override' }));
    expect(
      await within(dialog).findByText('El motivo debe tener al menos 10 caracteres'),
    ).toBeInTheDocument();
    expect(bodies).toHaveLength(0);
    await user.type(within(dialog).getByLabelText('Motivo (obligatorio)'), REASON);
    await user.click(within(dialog).getByRole('button', { name: 'Quitar override' }));
    await vi.waitFor(() => expect(bodies).toHaveLength(1));
    const body = bodies[0] as { overrides: { moduleCode: string }[]; reason: string };
    expect(body.overrides.map((o) => o.moduleCode)).toEqual(['AI_RECEPTIONIST']);
    expect(body.reason).toBe(REASON);
    expect(getDb().auditLogs[0]).toMatchObject({ action: 'MODULE_OVERRIDE_REMOVED' });
  });

  it('VERSION_CONFLICT: aviso, recarga y conserva lo escrito', async () => {
    const { user, bodies } = setup('c-lara');
    await user.click(
      await screen.findByRole('button', { name: 'Editar override de AI_RECEPTIONIST' }),
    );
    getDb().clinics.find((c) => c.id === 'c-lara')!.version = 4; // otro editó la clínica
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Motivo (obligatorio)'), REASON);
    await user.click(within(dialog).getByRole('button', { name: 'Guardar override' }));
    expect(await within(dialog).findByTestId('version-conflict')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Motivo (obligatorio)')).toHaveValue(REASON);
    await user.click(within(dialog).getByRole('button', { name: 'Guardar override' }));
    await vi.waitFor(() => expect(bodies).toHaveLength(2));
    expect((bodies[1] as { version: number }).version).toBe(4);
  });
});
