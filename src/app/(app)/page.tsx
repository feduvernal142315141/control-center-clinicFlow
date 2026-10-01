import type { Metadata } from 'next';
import { DashboardView } from '@/components/clinics/dashboard-view';
import { PageHeader } from '@/components/layout/page-header';

export const metadata: Metadata = { title: 'Dashboard' };

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Resumen de clínicas por estado, plan y especialidad."
      />
      <DashboardView />
    </>
  );
}
