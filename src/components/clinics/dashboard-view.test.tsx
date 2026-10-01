import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithClient, setupMockApi } from '@test/render';
import { getDb } from '@/mocks/db';
import { DashboardView } from './dashboard-view';

setupMockApi();

describe('DashboardView', () => {
  it('muestra los KPIs del backend y desgloses con nombres legibles', async () => {
    renderWithClient(<DashboardView />);
    const total = getDb().clinics.length;
    expect(await screen.findByTestId('kpi-totalClinics')).toHaveTextContent(String(total));
    const suspended = getDb().clinics.filter((c) => c.operationalStatus === 'SUSPENDED').length;
    expect(screen.getByTestId('kpi-suspended')).toHaveTextContent(String(suspended));
    const trial = getDb().clinics.filter((c) => c.subscription?.trial).length;
    expect(screen.getByTestId('kpi-trial')).toHaveTextContent(String(trial));
    expect(screen.getByTestId('kpi-trial').closest('a')).toHaveAttribute(
      'href',
      '/clinicas?trial=true',
    );

    const byPlan = await screen.findByRole('list', { name: 'Clínicas por plan' });
    expect(await within(byPlan).findByText('Legacy dental')).toBeInTheDocument();
    expect(within(byPlan).getByText('Sin plan')).toBeInTheDocument();
    const bySpecialty = screen.getByRole('list', { name: 'Clínicas por especialidad' });
    expect(within(bySpecialty).getByText('Podología').closest('a')).toHaveAttribute(
      'href',
      '/clinicas?specialtyCode=PODIATRY',
    );
  });
});
