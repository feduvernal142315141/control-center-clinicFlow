import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BreadcrumbProvider, Breadcrumbs, useBreadcrumbLabel } from './breadcrumbs';

const nav = vi.hoisted(() => ({ pathname: '/clinicas/c-lara' }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }));

function Detail({ name }: { name?: string }) {
  useBreadcrumbLabel('c-lara', name);
  return null;
}

describe('Breadcrumbs', () => {
  it('ruta con secciones enlazadas y el nombre real del detalle', () => {
    render(
      <BreadcrumbProvider>
        <Breadcrumbs />
        <Detail name="Odontología Integral Lara" />
      </BreadcrumbProvider>,
    );
    const nav = screen.getByRole('navigation', { name: 'Ruta' });
    expect(nav).toHaveTextContent('Dashboard');
    expect(screen.getByRole('link', { name: 'Clínicas' })).toHaveAttribute('href', '/clinicas');
    expect(screen.getByText('Odontología Integral Lara')).toHaveAttribute('aria-current', 'page');
  });

  it('mientras carga el detalle muestra un marcador', () => {
    render(
      <BreadcrumbProvider>
        <Breadcrumbs />
        <Detail />
      </BreadcrumbProvider>,
    );
    expect(screen.getByText('…')).toHaveAttribute('aria-current', 'page');
  });
});
