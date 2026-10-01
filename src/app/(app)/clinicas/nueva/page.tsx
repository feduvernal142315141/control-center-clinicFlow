import type { Metadata } from 'next';
import { CreateClinicForm } from '@/components/clinics/create-clinic-form';
import { PageHeader } from '@/components/layout/page-header';

export const metadata: Metadata = { title: 'Nueva clínica' };

export default function NewClinicPage() {
  return (
    <>
      <PageHeader
        title="Nueva clínica"
        description="Crea la clínica con su especialidad, plan y administrador inicial."
      />
      <CreateClinicForm />
    </>
  );
}
