import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/page-header';
import { ComingSoon } from '@/components/states/coming-soon';

export const metadata: Metadata = { title: 'Módulos' };

export default function Page() {
  return (
    <>
      <PageHeader title="Módulos" description="Catálogo de módulos y dependencias." />
      <ComingSoon phase="BO3" />
    </>
  );
}
