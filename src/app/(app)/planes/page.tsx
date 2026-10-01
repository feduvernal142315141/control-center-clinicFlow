import { Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { PlansList } from '@/components/plans/plans-list';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Planes' };

export default function PlansPage() {
  return (
    <>
      <PageHeader
        title="Planes"
        description="Paquetes comerciales y su matriz de módulos."
        actions={
          <Button asChild>
            <Link href="/planes/nuevo">
              <Plus /> Nuevo plan
            </Link>
          </Button>
        }
      />
      <PlansList />
    </>
  );
}
