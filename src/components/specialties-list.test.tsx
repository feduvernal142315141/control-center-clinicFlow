import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithClient, setupMockApi } from '@test/render';
import { getDb } from '@/mocks/db';
import { SpecialtiesList } from './specialties-list';

setupMockApi();

describe('SpecialtiesList', () => {
  it('muestra cuántas clínicas y módulos compatibles tiene cada especialidad', async () => {
    renderWithClient(<SpecialtiesList />);
    const row = (await screen.findByText('Podología')).closest('tr')!;
    const db = getDb();
    const clinics = db.clinics.filter((c) => c.specialtyCode === 'PODIATRY').length;
    const modules = db.modules.filter(
      (m) =>
        m.active &&
        (m.compatibleSpecialties.length === 0 || m.compatibleSpecialties.includes('PODIATRY')),
    ).length;
    expect(within(row).getByRole('link', { name: String(clinics) })).toHaveAttribute(
      'href',
      '/clinicas?specialtyCode=PODIATRY',
    );
    expect(within(row).getByText(String(modules))).toBeInTheDocument();
    expect(
      within((await screen.findByText('Dermatología')).closest('tr')!).getByText('Inactiva'),
    ).toBeInTheDocument();
  });
});
