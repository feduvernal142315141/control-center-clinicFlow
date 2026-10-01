import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/page-header';
import { ComingSoon } from '@/components/states/coming-soon';

export const metadata: Metadata = { title: 'Auditoría' };

export default function Page() {
  return (
    <>
      <PageHeader title="Auditoría" description="Registro de cambios con before/after." />
      <ComingSoon phase="BO4" />
    </>
  );
}
