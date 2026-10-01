import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/page-header';
import { SpecialtiesList } from '@/components/specialties-list';

export const metadata: Metadata = { title: 'Especialidades' };

export default function SpecialtiesPage() {
  return (
    <>
      <PageHeader title="Especialidades" description="Perfiles clínicos disponibles." />
      <SpecialtiesList />
    </>
  );
}
