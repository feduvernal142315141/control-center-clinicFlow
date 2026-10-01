'use client';

import { createColumnHelper } from '@tanstack/react-table';
import { Lock } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { EmptyState } from '@/components/states/empty-state';
import { ErrorState } from '@/components/states/error-state';
import { LoadingState } from '@/components/states/loading-state';
import { Badge } from '@/components/ui/badge';
import { DataTable, dataTableFeatures } from '@/components/ui/data-table';
import { useModules } from '@/lib/api/hooks/use-catalog-admin';
import { useCatalogNames } from '@/lib/api/hooks/use-catalogs';
import type { PlatformModule } from '@/lib/api/schemas';
import { MODULE_CATEGORY_LABEL } from '@/lib/format';

const helper = createColumnHelper<typeof dataTableFeatures, PlatformModule>();

export function ModulesCatalog() {
  const modules = useModules();
  const { specialtyName } = useCatalogNames();

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor('name', {
          header: 'Módulo',
          cell: (info) => {
            const m = info.row.original;
            return (
              <div className="space-y-1">
                <Link href={`/modulos/${m.id}`} className="font-medium hover:underline">
                  {m.name}
                </Link>
                <div className="flex flex-wrap items-center gap-1.5">
                  <code className="font-mono text-xs text-muted-foreground">{m.code}</code>
                  {m.requiredCore && (
                    <Badge variant="outline">
                      <Lock aria-hidden /> Core obligatorio
                    </Badge>
                  )}
                </div>
              </div>
            );
          },
        }),
        helper.accessor('category', {
          header: 'Categoría',
          cell: (info) => MODULE_CATEGORY_LABEL[info.getValue()],
        }),
        helper.accessor('active', {
          header: 'Estado',
          cell: (info) =>
            info.getValue() ? (
              <Badge variant="success">Activo</Badge>
            ) : (
              <Badge variant="outline">Inactivo</Badge>
            ),
        }),
        helper.accessor('compatibleSpecialties', {
          header: 'Especialidades',
          cell: (info) =>
            info.getValue().length === 0 ? (
              <span className="text-muted-foreground">Todas</span>
            ) : (
              info.getValue().map(specialtyName).join(', ')
            ),
        }),
        helper.accessor('dependsOn', {
          header: 'Depende de',
          cell: (info) =>
            info.getValue().length === 0 ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              <div className="flex flex-wrap gap-1">
                {info.getValue().map((d) => (
                  <code key={d} className="rounded bg-muted px-1 font-mono text-xs">
                    {d}
                  </code>
                ))}
              </div>
            ),
        }),
      ]),
    [specialtyName],
  );

  if (modules.isError) {
    return <ErrorState error={modules.error} onRetry={() => modules.refetch()} />;
  }
  if (!modules.data) return <LoadingState rows={8} label="Cargando módulos…" />;
  return (
    <DataTable
      caption="Catálogo de módulos"
      columns={columns}
      data={modules.data}
      getRowId={(m) => m.id}
      empty={<EmptyState className="m-4" title="El catálogo está vacío" />}
    />
  );
}
