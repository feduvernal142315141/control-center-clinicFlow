import { Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { ModulesCatalog } from '@/components/modules/modules-catalog';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Módulos' };

export default function ModulesPage() {
  return (
    <>
      <PageHeader
        title="Módulos"
        description="Catálogo de módulos, compatibilidad y dependencias."
        actions={
          <Button asChild>
            <Link href="/modulos/nuevo">
              <Plus /> Nuevo módulo
            </Link>
          </Button>
        }
      />
      <ModulesCatalog />
    </>
  );
}
