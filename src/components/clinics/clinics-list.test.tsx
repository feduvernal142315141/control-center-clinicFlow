import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithClient, setupMockApi } from '@test/render';
import { ClinicsList } from './clinics-list';

const nav = vi.hoisted(() => ({ params: new URLSearchParams(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace, push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => nav.params,
  usePathname: () => '/clinicas',
}));

const server = setupMockApi();

function captureListQueries() {
  const queries: string[] = [];
  server.events.on('request:start', ({ request }) => {
    const url = new URL(request.url);
    if (url.pathname === '/api/platform/clinics') queries.push(url.search);
  });
  return queries;
}

beforeEach(() => {
  nav.params = new URLSearchParams();
  nav.replace.mockReset();
});

describe('ClinicsList', () => {
  it('lista paginada con estado, especialidad y plan legibles', async () => {
    renderWithClient(<ClinicsList />);
    const table = await screen.findByRole('table', { name: 'Clínicas' });
    expect(within(table).getAllByRole('row')).toHaveLength(11); // encabezado + 10
    expect(screen.getByText('Página 1 de 3')).toBeInTheDocument();
    expect(screen.getByText('24 clínicas')).toBeInTheDocument();
  });

  it('lee filtros de la URL y los manda al backend', async () => {
    nav.params = new URLSearchParams('status=SUSPENDED&specialtyCode=DENTAL&page=0');
    const queries = captureListQueries();
    renderWithClient(<ClinicsList />);
    await screen.findByText('Sonrisas del Norte');
    expect(queries.at(-1)).toContain('status=SUSPENDED');
    expect(queries.at(-1)).toContain('specialtyCode=DENTAL');
    expect(screen.queryByText("Clínica Dental D'Armas")).not.toBeInTheDocument();
  });

  it('cambiar un filtro actualiza la URL y vuelve a la página 1', async () => {
    nav.params = new URLSearchParams('page=2');
    const user = userEvent.setup();
    renderWithClient(<ClinicsList />);
    await screen.findByRole('option', { name: 'Premium' });
    await user.selectOptions(screen.getByLabelText('Plan'), 'PREMIUM');
    expect(nav.replace).toHaveBeenLastCalledWith('/clinicas?planCode=PREMIUM', { scroll: false });
  });

  it('la búsqueda se aplica con debounce', async () => {
    const user = userEvent.setup();
    renderWithClient(<ClinicsList />);
    await user.type(screen.getByLabelText('Buscar por nombre o slug'), 'lara');
    expect(nav.replace).not.toHaveBeenCalled();
    await vi.waitFor(() =>
      expect(nav.replace).toHaveBeenCalledWith('/clinicas?q=lara', { scroll: false }),
    );
  });

  it('estado vacío cuando no hay resultados', async () => {
    nav.params = new URLSearchParams('q=no-existe-ninguna');
    renderWithClient(<ClinicsList />);
    expect(await screen.findByText('Ninguna clínica coincide con los filtros')).toBeInTheDocument();
  });

  it('filtro de trial (suscripción) y badge Trial separado del estado', async () => {
    nav.params = new URLSearchParams('trial=true');
    const queries = captureListQueries();
    const user = userEvent.setup();
    renderWithClient(<ClinicsList />);
    const row = (await screen.findByText('Consultorio Médico Vida')).closest('tr')!;
    expect(within(row).getByText('Activa')).toBeInTheDocument();
    expect(within(row).getByText('Trial')).toBeInTheDocument();
    expect(queries.at(-1)).toContain('trial=true');
    await user.selectOptions(screen.getByLabelText('Suscripción'), 'false');
    expect(nav.replace).toHaveBeenLastCalledWith('/clinicas?trial=false', { scroll: false });
  });

  it('el filtro de estado no ofrece TRIAL', async () => {
    renderWithClient(<ClinicsList />);
    const status = screen.getByLabelText('Estado');
    expect(within(status).queryByRole('option', { name: 'Trial' })).not.toBeInTheDocument();
    expect(within(status).getAllByRole('option')).toHaveLength(4);
  });
});
