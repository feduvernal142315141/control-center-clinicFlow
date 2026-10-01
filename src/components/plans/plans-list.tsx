'use client';

import { createColumnHelper } from '@tanstack/react-table';
import Link from 'next/link';
import { EmptyState } from '@/components/states/empty-state';
import { ErrorState } from '@/components/states/error-state';
import { LoadingState } from '@/components/states/loading-state';
import { Badge } from '@/components/ui/badge';
import { DataTable, dataTableFeatures } from '@/components/ui/data-table';
import { usePlans } from '@/lib/api/hooks/use-catalogs';
import type { Plan } from '@/lib/api/schemas';

const helper = createColumnHelper<typeof dataTableFeatures, Plan>();

const columns = helper.columns([
  helper.accessor('name', {
    header: 'Plan',
    cell: (info) => (
      <div>
        <Link href={`/planes/${info.row.original.id}`} className="font-medium hover:underline">
          {info.getValue()}
        </Link>
        <p className="font-mono text-xs text-muted-foreground">{info.row.original.code}</p>
      </div>
    ),
  }),
  helper.accessor('description', {
    header: 'Descripción',
    cell: (info) => <span className="text-sm text-muted-foreground">{info.getValue() ?? '—'}</span>,
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
  helper.accessor('sortOrder', { header: 'Orden', cell: (info) => info.getValue() }),
  helper.display({
    id: 'modules',
    header: 'Módulos incluidos',
    cell: (info) => {
      const modules = info.row.original.modules;
      return (
        <span className="tabular-nums">
          {modules.filter((m) => m.enabled).length} / {modules.length}
        </span>
      );
    },
  }),
]);

export function PlansList() {
  const plans = usePlans();
  if (plans.isError) return <ErrorState error={plans.error} onRetry={() => plans.refetch()} />;
  if (!plans.data) return <LoadingState rows={4} label="Cargando planes…" />;
  return (
    <DataTable
      caption="Planes"
      columns={columns}
      data={plans.data}
      getRowId={(p) => p.id}
      empty={<EmptyState className="m-4" title="Aún no hay planes" />}
    />
  );
}
