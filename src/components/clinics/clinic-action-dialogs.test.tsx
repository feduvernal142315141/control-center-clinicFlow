import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { renderWithClient, setupMockApi } from '@test/render';
import type { ClinicDetail } from '@/lib/api/schemas';
import { getDb } from '@/mocks/db';
import {
  ChangePlanDialog,
  ChangeSpecialtyDialog,
  ReactivateClinicDialog,
  RenameClinicDialog,
  SuspendClinicDialog,
} from './clinic-action-dialogs';

const server = setupMockApi();
const API = 'http://localhost:3000/api/platform';
const REASON = 'Falta de pago confirmada por finanzas';

const clinic = (id: string): ClinicDetail =>
  structuredClone(getDb().clinics.find((c) => c.id === id)!);

function spyBody(method: 'post' | 'put', path: string) {
  const bodies: unknown[] = [];
  server.events.on('request:start', async ({ request }) => {
    if (request.method === method.toUpperCase() && new URL(request.url).pathname === path) {
      bodies.push(await request.clone().json());
    }
  });
  return bodies;
}

describe('SuspendClinicDialog', () => {
  it('no permite suspender hasta escribir el slug exacto y un motivo', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const bodies = spyBody('post', '/api/platform/clinics/c-darmas/suspend');
    renderWithClient(
      <SuspendClinicDialog clinic={clinic('c-darmas')} open onOpenChange={onOpenChange} />,
    );
    const submit = screen.getByRole('button', { name: 'Suspender clínica' });
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText(/para confirmar/), 'clinica-dental');
    expect(submit).toBeDisabled();
    await user.type(screen.getByLabelText(/para confirmar/), '-darmas');
    expect(submit).toBeEnabled();

    await user.click(submit);
    expect(
      await screen.findByText('El motivo debe tener al menos 10 caracteres'),
    ).toBeInTheDocument();
    expect(bodies).toHaveLength(0);

    await user.type(screen.getByLabelText('Motivo (obligatorio)'), REASON);
    await user.click(submit);
    await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(bodies).toEqual([{ reason: REASON, version: 1 }]);
    expect(getDb().clinics.find((c) => c.id === 'c-darmas')!.operationalStatus).toBe('SUSPENDED');
  });

  it('si el backend falla, muestra el error y no cierra', async () => {
    server.use(
      http.post(`${API}/clinics/c-darmas/suspend`, () =>
        HttpResponse.json({ code: 'CONFLICT', message: 'Estado cambió' }, { status: 409 }),
      ),
    );
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderWithClient(
      <SuspendClinicDialog clinic={clinic('c-darmas')} open onOpenChange={onOpenChange} />,
    );
    await user.type(screen.getByLabelText('Motivo (obligatorio)'), REASON);
    await user.type(screen.getByLabelText(/para confirmar/), 'clinica-dental-darmas');
    await user.click(screen.getByRole('button', { name: 'Suspender clínica' }));
    expect(await screen.findByText('Estado cambió (CONFLICT)')).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});

describe('ReactivateClinicDialog', () => {
  it('exige motivo', async () => {
    const user = userEvent.setup();
    const bodies = spyBody('post', '/api/platform/clinics/c-sonrisas-norte/reactivate');
    renderWithClient(
      <ReactivateClinicDialog clinic={clinic('c-sonrisas-norte')} open onOpenChange={() => {}} />,
    );
    await user.click(screen.getByRole('button', { name: 'Reactivar' }));
    expect(
      await screen.findByText('El motivo debe tener al menos 10 caracteres'),
    ).toBeInTheDocument();
    expect(bodies).toHaveLength(0);
  });
});

describe('ReactivateClinicDialog (INACTIVE)', () => {
  it('reactiva una clínica inactiva con motivo', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderWithClient(
      <ReactivateClinicDialog clinic={clinic('c-piel-sana')} open onOpenChange={onOpenChange} />,
    );
    expect(screen.getByText(/está inactiva/)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Motivo (obligatorio)'), REASON);
    await user.click(screen.getByRole('button', { name: 'Reactivar' }));
    await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(getDb().clinics.find((c) => c.id === 'c-piel-sana')!.operationalStatus).toBe('ACTIVE');
  });
});

describe('vista previa de impacto', () => {
  it('cambiar especialidad lista qué pasa de ON a OFF y de OFF a ON', async () => {
    const user = userEvent.setup();
    const bodies = spyBody('put', '/api/platform/clinics/c-darmas/specialty');
    renderWithClient(
      <ChangeSpecialtyDialog clinic={clinic('c-darmas')} open onOpenChange={() => {}} />,
    );
    await screen.findByRole('option', { name: 'Podología' });
    await user.selectOptions(screen.getByLabelText('Nueva especialidad'), 'PODIATRY');

    const off = await screen.findByRole('list', { name: /Pasan de ON a OFF/ });
    expect(within(off).getByText('DENTAL_ODONTOGRAM')).toBeInTheDocument();
    expect(
      within(off).getAllByText('OFF: no es compatible con la especialidad de la clínica'),
    ).toHaveLength(3);
    const on = screen.getByRole('list', { name: /Pasan de OFF a ON/ });
    expect(within(on).getByText('PODIATRY_FOOT_EXAM')).toBeInTheDocument();
    expect(bodies).toHaveLength(0); // la vista previa no guarda nada
  });

  it('cambiar plan muestra los módulos que se pierden', async () => {
    const user = userEvent.setup();
    renderWithClient(<ChangePlanDialog clinic={clinic('c-darmas')} open onOpenChange={() => {}} />);
    await screen.findByRole('option', { name: 'Básico' });
    await user.selectOptions(screen.getByLabelText('Plan'), 'BASIC');
    const off = await screen.findByRole('list', { name: /Pasan de ON a OFF/ });
    expect(within(off).getByText('AI_RECEPTIONIST')).toBeInTheDocument();
    expect(within(off).getAllByText('OFF: no está incluido en el plan').length).toBeGreaterThan(0);
  });

  it('si nada cambia, lo dice', async () => {
    const user = userEvent.setup();
    renderWithClient(
      <ChangeSpecialtyDialog clinic={clinic('c-sonrisas-norte')} open onOpenChange={() => {}} />,
    );
    await screen.findByRole('option', { name: 'Podología' });
    await user.selectOptions(screen.getByLabelText('Nueva especialidad'), 'PODIATRY');
    expect(await screen.findByText('Ningún módulo cambia de estado.')).toBeInTheDocument();
  });
});

describe('RenameClinicDialog', () => {
  it('exige motivo y envía { name, reason }', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const bodies: unknown[] = [];
    server.events.on('request:start', async ({ request }) => {
      if (request.method === 'PATCH') bodies.push(await request.clone().json());
    });
    renderWithClient(
      <RenameClinicDialog clinic={clinic('c-darmas')} open onOpenChange={onOpenChange} />,
    );
    const name = screen.getByLabelText('Nombre');
    await user.clear(name);
    await user.type(name, "D'Armas Odontología");
    await user.click(screen.getByRole('button', { name: 'Guardar nombre' }));
    expect(
      await screen.findByText('El motivo debe tener al menos 10 caracteres'),
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText('Motivo (obligatorio)'), REASON);
    await user.click(screen.getByRole('button', { name: 'Guardar nombre' }));
    await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(bodies).toEqual([{ name: "D'Armas Odontología", reason: REASON, version: 1 }]);
  });
});

describe('ChangeSpecialtyDialog', () => {
  it('envía especialidad + motivo y no ofrece la actual', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const bodies = spyBody('put', '/api/platform/clinics/c-darmas/specialty');
    renderWithClient(
      <ChangeSpecialtyDialog clinic={clinic('c-darmas')} open onOpenChange={onOpenChange} />,
    );
    const select = screen.getByLabelText('Nueva especialidad');
    await screen.findByRole('option', { name: 'Podología' });
    expect(screen.getByRole('option', { name: 'Odontología (actual)' })).toBeDisabled();

    await user.selectOptions(select, 'PODIATRY');
    await user.click(screen.getByRole('button', { name: 'Cambiar especialidad' }));
    expect(
      await screen.findByText('El motivo debe tener al menos 10 caracteres'),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText('Motivo (obligatorio)'), REASON);
    await user.click(screen.getByRole('button', { name: 'Cambiar especialidad' }));
    await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(bodies).toEqual([{ specialtyCode: 'PODIATRY', reason: REASON, version: 1 }]);
  });
});

describe('ChangePlanDialog', () => {
  it('envía fechas ISO con offset, trial y motivo', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const bodies = spyBody('put', '/api/platform/clinics/c-vida/subscription');
    renderWithClient(
      <ChangePlanDialog clinic={clinic('c-vida')} open onOpenChange={onOpenChange} />,
    );
    await screen.findByRole('option', { name: 'Pro' });

    await user.selectOptions(screen.getByLabelText('Plan'), 'PRO');
    await user.click(screen.getByLabelText('Periodo de prueba (trial)')); // desmarca trial
    await user.clear(screen.getByLabelText('Fin'));
    await user.type(screen.getByLabelText('Motivo (obligatorio)'), REASON);
    await user.click(screen.getByRole('button', { name: 'Guardar suscripción' }));

    await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(bodies).toHaveLength(1);
    const body = bodies[0] as Record<string, unknown>;
    expect(body).toMatchObject({ planCode: 'PRO', trial: false, endsAt: null, reason: REASON });
    expect(body.startsAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*(Z|[+-]\d{2}:\d{2})$/);
  });

  it('un trial sin fecha de fin no se envía', async () => {
    const user = userEvent.setup();
    const bodies = spyBody('put', '/api/platform/clinics/c-vida/subscription');
    renderWithClient(<ChangePlanDialog clinic={clinic('c-vida')} open onOpenChange={() => {}} />);
    await screen.findByRole('option', { name: 'Pro' });
    await user.clear(screen.getByLabelText('Fin'));
    await user.type(screen.getByLabelText('Motivo (obligatorio)'), REASON);
    await user.click(screen.getByRole('button', { name: 'Guardar suscripción' }));
    expect(await screen.findByText('Un trial necesita fecha de fin')).toBeInTheDocument();
    expect(bodies).toHaveLength(0);
  });
});

describe('D17: VERSION_CONFLICT en acciones de clínica', () => {
  it('suspender: aviso, recarga, conserva lo escrito y reintenta con la versión nueva', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const bodies = spyBody('post', '/api/platform/clinics/c-darmas/suspend');
    const reload = vi.fn(async () => 3);
    renderWithClient(
      <SuspendClinicDialog
        clinic={clinic('c-darmas')}
        open
        onOpenChange={onOpenChange}
        reload={reload}
      />,
    );
    getDb().clinics.find((c) => c.id === 'c-darmas')!.version = 3; // otro editó
    await user.type(screen.getByLabelText('Motivo (obligatorio)'), REASON);
    await user.type(screen.getByLabelText(/para confirmar/), 'clinica-dental-darmas');
    await user.click(screen.getByRole('button', { name: 'Suspender clínica' }));

    expect(await screen.findByTestId('version-conflict')).toHaveTextContent(
      'Alguien modificó esto mientras editabas',
    );
    expect(reload).toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByLabelText('Motivo (obligatorio)')).toHaveValue(REASON);

    await user.click(screen.getByRole('button', { name: 'Suspender clínica' }));
    await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(bodies).toEqual([
      { reason: REASON, version: 1 },
      { reason: REASON, version: 3 },
    ]);
  });

  it('editar nombre: "Descartar mis cambios" vuelve al nombre actual', async () => {
    const user = userEvent.setup();
    renderWithClient(
      <RenameClinicDialog
        clinic={clinic('c-darmas')}
        open
        onOpenChange={() => {}}
        reload={async () => 2}
      />,
    );
    getDb().clinics.find((c) => c.id === 'c-darmas')!.version = 2;
    const name = screen.getByLabelText('Nombre');
    await user.clear(name);
    await user.type(name, 'Nombre nuevo');
    await user.type(screen.getByLabelText('Motivo (obligatorio)'), REASON);
    await user.click(screen.getByRole('button', { name: 'Guardar nombre' }));
    await user.click(await screen.findByRole('button', { name: 'Descartar mis cambios' }));
    expect(screen.getByLabelText('Nombre')).toHaveValue("Clínica Dental D'Armas");
    expect(screen.queryByTestId('version-conflict')).not.toBeInTheDocument();
  });
});
