import { Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { ClinicsList } from '@/components/clinics/clinics-list';
import { PageHeader } from '@/components/layout/page-header';
import { LoadingState } from '@/components/states/loading-state';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Clínicas' };

export default function ClinicsPage() {
  return (
    <>
      <PageHeader
        title="Clínicas"
        description="Busca, crea y administra clínicas."
        actions={
          <Button asChild>
            <Link href="/clinicas/nueva">
              <Plus /> Nueva clínica
            </Link>
          </Button>
        }
      />
      <Suspense fallback={<LoadingState rows={10} />}>
        <ClinicsList />
      </Suspense>
    </>
  );
}
