import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithClient, setupMockApi } from '@test/render';
import { SystemErrorLogView } from './system-error-log-view';

const nav = vi.hoisted(() => ({ params: new URLSearchParams(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: nav.replace, push: vi.fn() }),
  useSearchParams: () => nav.params,
  usePathname: () => '/errores-sistema',
}));

const _server = setupMockApi();

beforeEach(() => {
  nav.params = new URLSearchParams();
  nav.replace.mockReset();
});

describe('SystemErrorLogView', () => {
  it('muestra contexto del error y permite expandir el stack trace', async () => {
    renderWithClient(<SystemErrorLogView />);
    expect(await screen.findByText('NullPointerException')).toBeInTheDocument();
    expect(screen.getAllByText('Clínica Dental D\'Armas').length).toBeGreaterThan(1);
    expect(screen.getByText('Ver stack trace')).toBeInTheDocument();
  });

  it('envía el filtro de clase al endpoint', async () => {
    renderWithClient(<SystemErrorLogView />);
    await screen.findByText('NullPointerException');
    fireEvent.change(screen.getByLabelText('Clase o paquete'), { target: { value: 'NullPointer' } });
    await waitFor(() => expect(nav.replace).toHaveBeenLastCalledWith(
      '/errores-sistema?exceptionClass=NullPointer', { scroll: false },
    ));
  });
});
