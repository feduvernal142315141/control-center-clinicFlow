import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/page-header';
import { ComingSoon } from '@/components/states/coming-soon';

export const metadata: Metadata = { title: 'Clínicas' };

export default function Page() {
  return (
    <>
      <PageHeader title="Clínicas" description="Busca, crea y administra clínicas." />
      <ComingSoon phase="BO2" />
    </>
  );
}
