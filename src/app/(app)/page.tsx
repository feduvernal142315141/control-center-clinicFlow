import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/page-header';
import { ComingSoon } from '@/components/states/coming-soon';

export const metadata: Metadata = { title: 'Dashboard' };

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Resumen de clínicas por estado, plan y especialidad."
      />
      <ComingSoon phase="BO2" />
    </>
  );
}
