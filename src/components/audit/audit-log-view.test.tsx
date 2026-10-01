import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithClient, setupMockApi } from '@test/render';
import { AuditLogView } from './audit-log-view';

const nav = vi.hoisted(() => ({ params: new URLSearchParams(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace, push: vi.fn() }),
  useSearchParams: () => nav.params,
  usePathname: () => '/auditoria',
}));

const server = setupMockApi();

function captureQueries() {
  const queries: URLSearchParams[] = [];
  server.events.on('request:start', ({ request }) => {
    const url = new URL(request.url);
    if (url.pathname === '/api/platform/audit-logs') queries.push(url.searchParams);
  });
  return queries;
}

beforeEach(() => {
  nav.params = new URLSearchParams();
  nav.replace.mockReset();
});

describe('AuditLogView', () => {
  it('global: lista eventos con clínica, actor, acción y motivo', async () => {
    renderWithClient(<AuditLogView />);
    const row = await screen.findByTestId('audit-a-4');
    expect(row).toHaveTextContent('Plan / suscripción cambiado');
    expect(row).toHaveTextContent('PLAN_CHANGED');
    expect(within(row).getByRole('link', { name: "Clínica Dental D'Armas" })).toHaveAttribute(
      'href',
      '/clinicas/c-darmas',
    );
    expect(row).toHaveTextContent('mfa@kodewave.com');
    expect(row).toHaveTextContent('Upgrade a Premium');
  });

  it('acción desconocida: se muestra con su código y no rompe (D19)', async () => {
    renderWithClient(<AuditLogView />);
    const row = await screen.findByTestId('audit-a-5');
    expect(row).toHaveTextContent('Acción no reconocida: LEGACY_IMPORT');
    expect(row).toHaveTextContent('Sonrisas del Norte');
  });

  it('filtros desde la URL hacia el backend (fechas como rango del día)', async () => {
    nav.params = new URLSearchParams(
      'actorId=u-admin&action=CLINIC_SUSPENDED&from=2026-09-01&to=2026-09-30&page=0',
    );
    const queries = captureQueries();
    renderWithClient(<AuditLogView />);
    await screen.findByTestId('audit-a-1');
    const q = queries.at(-1)!;
    expect(q.get('actorId')).toBe('u-admin');
    expect(q.get('action')).toBe('CLINIC_SUSPENDED');
    expect(new Date(q.get('from')!).getTime()).toBe(new Date('2026-09-01T00:00:00').getTime());
    expect(new Date(q.get('to')!).getTime()).toBe(new Date('2026-09-30T23:59:59.999').getTime());
  });

  it('cambiar filtros actualiza la URL y vuelve a la página 1', async () => {
    nav.params = new URLSearchParams('page=2');
    const user = userEvent.setup();
    renderWithClient(<AuditLogView />);
    await screen.findByRole('option', { name: 'mfa@kodewave.com' });
    await user.selectOptions(screen.getByLabelText('Actor'), 'u-mfa');
    expect(nav.replace).toHaveBeenLastCalledWith('/auditoria?actorId=u-mfa', { scroll: false });
    await user.selectOptions(screen.getByLabelText('Acción'), 'PLAN_CHANGED');
    // Dos cambios seguidos no se pisan aunque la URL aún no se haya actualizado.
    expect(nav.replace).toHaveBeenLastCalledWith('/auditoria?actorId=u-mfa&action=PLAN_CHANGED', {
      scroll: false,
    });
  });

  it('filtro de clínica: buscar y elegir guarda el clinicId', async () => {
    const user = userEvent.setup();
    renderWithClient(<AuditLogView />);
    await user.type(screen.getByLabelText('Clínica'), 'lara');
    await user.click(await screen.findByRole('button', { name: /Odontología Integral Lara/ }));
    expect(nav.replace).toHaveBeenLastCalledWith('/auditoria?clinicId=c-lara', { scroll: false });
  });

  it('tab de clínica: clinicId fijo, sin columna ni filtro de clínica', async () => {
    const queries = captureQueries();
    renderWithClient(<AuditLogView clinicId="c-lara" />);
    await screen.findByTestId('audit-a-2');
    expect(queries.at(-1)!.get('clinicId')).toBe('c-lara');
    expect(screen.queryByLabelText('Clínica')).not.toBeInTheDocument();
    expect(screen.queryByTestId('audit-a-1')).not.toBeInTheDocument();
  });

  it('detalle: metadatos y diff con los campos cambiados resaltados', async () => {
    const user = userEvent.setup();
    renderWithClient(<AuditLogView />);
    const row = await screen.findByTestId('audit-a-4');
    await user.click(within(row).getByRole('button', { name: 'Ver detalle' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('mfa@kodewave.com');
    expect(dialog).toHaveTextContent('10.0.0.20');
    expect(dialog).toHaveTextContent('Upgrade a Premium acordado con la clínica.');
    expect(within(dialog).getByText('Cambios (1 campo)')).toBeInTheDocument();
    const changed = within(dialog).getByText('planCode').closest('tr')!;
    expect(changed).toHaveAttribute('data-kind', 'changed');
    expect(changed).toHaveTextContent('PRO');
    expect(changed).toHaveTextContent('PREMIUM');
    expect(within(dialog).queryByText('status')).not.toBeInTheDocument();
    await user.click(within(dialog).getByLabelText(/Mostrar campos sin cambios/));
    expect(within(dialog).getByText('status').closest('tr')).toHaveAttribute('data-kind', 'same');
  });
});
