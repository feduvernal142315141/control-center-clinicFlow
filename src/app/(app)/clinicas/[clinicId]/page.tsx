import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ClinicDetail } from '@/components/clinics/clinic-detail';
import { LoadingState } from '@/components/states/loading-state';

export const metadata: Metadata = { title: 'Clínica' };

export default async function ClinicPage({ params }: { params: Promise<{ clinicId: string }> }) {
  const { clinicId } = await params;
  return (
    <Suspense fallback={<LoadingState rows={6} />}>
      <ClinicDetail clinicId={clinicId} />
    </Suspense>
  );
}
