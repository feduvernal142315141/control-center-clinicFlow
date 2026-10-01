import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/page-header';
import { ComingSoon } from '@/components/states/coming-soon';

export const metadata: Metadata = { title: 'Especialidades' };

export default function Page() {
  return (
    <>
      <PageHeader title="Especialidades" description="Perfiles clínicos disponibles." />
      <ComingSoon phase="BO3" />
    </>
  );
}
