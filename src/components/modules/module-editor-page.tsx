'use client';

import Link from 'next/link';
import { useBreadcrumbLabel } from '@/components/layout/breadcrumbs';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/states/empty-state';
import { ErrorState } from '@/components/states/error-state';
import { LoadingState } from '@/components/states/loading-state';
import { Button } from '@/components/ui/button';
import { useModules } from '@/lib/api/hooks/use-catalog-admin';
import { ModuleForm } from './module-form';

/** Crear (sin `moduleId`) o editar un módulo. Usa el catálogo completo para validar ciclos. */
export function ModuleEditorPage({ moduleId }: { moduleId?: string }) {
  const modules = useModules();
  useBreadcrumbLabel(moduleId ?? '', modules.data?.find((m) => m.id === moduleId)?.name);
  if (modules.isError) {
    return <ErrorState error={modules.error} onRetry={() => modules.refetch()} />;
  }
  if (!modules.data) return <LoadingState rows={6} label="Cargando catálogo…" />;

  const current = moduleId ? modules.data.find((m) => m.id === moduleId) : undefined;
  if (moduleId && !current) {
    return (
      <EmptyState
        title="Módulo no encontrado"
        action={
          <Button asChild variant="outline">
            <Link href="/modulos">Volver al catálogo</Link>
          </Button>
        }
      />
    );
  }

  return (
    <>
      <PageHeader
        title={current ? current.name : 'Nuevo módulo'}
        description={current ? undefined : 'Agrega una capacidad al catálogo.'}
        meta={
          current && <code className="font-mono text-xs text-muted-foreground">{current.code}</code>
        }
      />
      {/* Sin `key` por versión: remontar borraría lo que el usuario está editando. */}
      <ModuleForm
        module={current}
        catalog={modules.data}
        reload={async () => {
          const fresh = await modules.refetch();
          return fresh.data?.find((m) => m.id === moduleId)?.version;
        }}
      />
    </>
  );
}
