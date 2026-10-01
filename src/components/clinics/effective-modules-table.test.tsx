import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { renderWithClient, setupMockApi } from '@test/render';
import { EffectiveModulesTable } from './effective-modules-table';

const server = setupMockApi();

const row = (code: string) => screen.getByText(code).closest('tr') as HTMLElement;

describe('EffectiveModulesTable', () => {
  it('Centro Podológico X: DENTAL_* OFF con el motivo de especialidad', async () => {
    renderWithClient(<EffectiveModulesTable clinicId="c-podologico-x" />);
    expect(await screen.findByText('DENTAL_ODONTOGRAM')).toBeInTheDocument();
    for (const code of ['DENTAL_ODONTOGRAM', 'DENTAL_TREATMENT_PLANS', 'DENTAL_PERIODONTOGRAM']) {
      const r = within(row(code));
      expect(r.getByText('OFF')).toBeInTheDocument();
      expect(
        r.getByText('OFF: no es compatible con la especialidad de la clínica'),
      ).toBeInTheDocument();
    }
    expect(within(row('PODIATRY_FOOT_EXAM')).getByText('Incluido en el plan')).toBeInTheDocument();
  });

  it('dependencia faltante: muestra qué módulo falta y el override', async () => {
    renderWithClient(<EffectiveModulesTable clinicId="c-lara" />);
    await screen.findByText('AI_RECEPTIONIST');
    const r = within(row('AI_RECEPTIONIST'));
    expect(r.getByText('OFF: falta dependencia COMMS_WHATSAPP')).toBeInTheDocument();
    expect(r.getByText(/Override ON: “Piloto comercial/)).toBeInTheDocument();
    expect(
      within(row('COMMS_WHATSAPP')).getByText('OFF: apagado por override'),
    ).toBeInTheDocument();
  });

  it('core obligatorio lleva badge', async () => {
    renderWithClient(<EffectiveModulesTable clinicId="c-darmas" />);
    await screen.findByText('CORE_PATIENTS');
    expect(within(row('CORE_PATIENTS')).getByText('Core obligatorio')).toBeInTheDocument();
    expect(within(row('COMMS_WHATSAPP')).queryByText('Core obligatorio')).not.toBeInTheDocument();
  });

  it('“Solo OFF” oculta los módulos ON', async () => {
    renderWithClient(<EffectiveModulesTable clinicId="c-darmas" />);
    await screen.findByText('CORE_PATIENTS');
    await userEvent.setup().click(screen.getByLabelText('Solo módulos OFF'));
    expect(screen.queryByText('CORE_PATIENTS')).not.toBeInTheDocument();
    expect(screen.getByText('GROWTH_REVIEWS')).toBeInTheDocument();
  });

  it('muestra exactamente lo que envía el backend (no recalcula)', async () => {
    server.use(
      http.get('http://localhost:3000/api/platform/clinics/x/effective-modules', () =>
        HttpResponse.json([
          {
            code: 'DENTAL_ODONTOGRAM',
            name: 'Odontograma',
            category: 'SPECIALTY',
            requiredCore: false,
            enabled: false,
            source: null,
            deniedReason: 'FLAG_KILL_SWITCH',
          },
        ]),
      ),
    );
    renderWithClient(<EffectiveModulesTable clinicId="x" />);
    expect(await screen.findByText('OFF: apagado globalmente (kill switch)')).toBeInTheDocument();
  });

  it('un motivo fuera del contrato es error visible, no una fila sin motivo', async () => {
    server.use(
      http.get('http://localhost:3000/api/platform/clinics/x/effective-modules', () =>
        HttpResponse.json([
          {
            code: 'X',
            name: 'X',
            category: 'CORE',
            requiredCore: false,
            enabled: false,
            source: null,
            deniedReason: null,
          },
        ]),
      ),
    );
    renderWithClient(<EffectiveModulesTable clinicId="x" />);
    expect(await screen.findByText('CONTRACT_MISMATCH · HTTP 200')).toBeInTheDocument();
  });

  it('deniedReason desconocido: fila OFF con el código y console.warn', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    server.use(
      http.get('http://localhost:3000/api/platform/clinics/x/effective-modules', () =>
        HttpResponse.json([
          {
            code: 'AI_RECEPTIONIST',
            name: 'Recepcionista IA',
            category: 'AI',
            requiredCore: false,
            enabled: false,
            source: null,
            deniedReason: 'BILLING_HOLD',
          },
          {
            code: 'CORE_PATIENTS',
            name: 'Pacientes',
            category: 'CORE',
            requiredCore: true,
            enabled: true,
            source: 'REQUIRED_CORE',
            deniedReason: null,
          },
        ]),
      ),
    );
    renderWithClient(<EffectiveModulesTable clinicId="x" />);
    expect(await screen.findByTestId('denied-AI_RECEPTIONIST')).toHaveTextContent(
      'OFF: Motivo no reconocido: BILLING_HOLD',
    );
    expect(screen.getByText('CORE_PATIENTS')).toBeInTheDocument();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('BILLING_HOLD'));
  });
});
