'use client';

import { createColumnHelper } from '@tanstack/react-table';
import Link from 'next/link';
import { EmptyState } from '@/components/states/empty-state';
import { ErrorState } from '@/components/states/error-state';
import { LoadingState } from '@/components/states/loading-state';
import { Badge } from '@/components/ui/badge';
import { DataTable, dataTableFeatures } from '@/components/ui/data-table';
import { useSpecialties } from '@/lib/api/hooks/use-catalogs';
import type { Specialty } from '@/lib/api/schemas';

const helper = createColumnHelper<typeof dataTableFeatures, Specialty>();

const columns = helper.columns([
  helper.accessor('name', {
    header: 'Especialidad',
    cell: (info) => (
      <div>
        <p className="font-medium">{info.getValue()}</p>
        <code className="font-mono text-xs text-muted-foreground">{info.row.original.code}</code>
      </div>
    ),
  }),
  helper.accessor('active', {
    header: 'Estado',
    cell: (info) =>
      info.getValue() ? (
        <Badge variant="success">Activa</Badge>
      ) : (
        <Badge variant="outline">Inactiva</Badge>
      ),
  }),
  helper.accessor('clinicCount', {
    header: 'Clínicas',
    cell: (info) =>
      info.getValue() > 0 ? (
        <Link
          href={`/clinicas?specialtyCode=${info.row.original.code}`}
          className="tabular-nums hover:underline"
        >
          {info.getValue()}
        </Link>
      ) : (
        <span className="text-muted-foreground tabular-nums">0</span>
      ),
  }),
  helper.accessor('compatibleModuleCount', {
    header: 'Módulos compatibles',
    cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
  }),
]);

export function SpecialtiesList() {
  const specialties = useSpecialties();
  if (specialties.isError) {
    return <ErrorState error={specialties.error} onRetry={() => specialties.refetch()} />;
  }
  if (!specialties.data) return <LoadingState rows={4} label="Cargando especialidades…" />;
  return (
    <div className="space-y-2">
      <DataTable
        caption="Especialidades"
        columns={columns}
        data={specialties.data}
        getRowId={(s) => s.code}
        empty={<EmptyState className="m-4" title="No hay especialidades" />}
      />
      <p className="text-xs text-muted-foreground">
        Módulos compatibles: módulos activos que la incluyen o que son compatibles con todas.
      </p>
    </div>
  );
}
