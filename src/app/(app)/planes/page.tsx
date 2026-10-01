import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/page-header';
import { ComingSoon } from '@/components/states/coming-soon';

export const metadata: Metadata = { title: 'Planes' };

export default function Page() {
  return (
    <>
      <PageHeader title="Planes" description="Paquetes comerciales y su matriz de módulos." />
      <ComingSoon phase="BO3" />
    </>
  );
}
