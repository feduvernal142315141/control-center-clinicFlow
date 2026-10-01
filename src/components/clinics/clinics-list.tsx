'use client';

import { createColumnHelper } from '@tanstack/react-table';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from '@/components/states/empty-state';
import { ErrorState } from '@/components/states/error-state';
import { LoadingState } from '@/components/states/loading-state';
import { Button } from '@/components/ui/button';
import { DataTable, dataTableFeatures } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { useCatalogNames, usePlans, useSpecialties } from '@/lib/api/hooks/use-catalogs';
import { useClinics } from '@/lib/api/hooks/use-clinics';
import {
  operationalStatusSchema,
  type ClinicListQuery,
  type ClinicSummary,
} from '@/lib/api/schemas';
import { formatDate, OPERATIONAL_STATUS_LABEL } from '@/lib/format';
import { useSearchParamsUpdater } from '@/lib/use-search-params-updater';
import { ClinicStatusBadge, TrialBadge } from './clinic-status-badge';

export const PAGE_SIZE = 10;

/** Estado de la lista ⇄ query string (enlaces compartibles, botón atrás). */
function useListQuery(): [ClinicListQuery, (patch: Partial<ClinicListQuery>) => void] {
  const params = useSearchParams();
  const replaceParams = useSearchParamsUpdater();

  const query = useMemo<ClinicListQuery>(() => {
    const status = operationalStatusSchema.safeParse(params.get('status'));
    const page = Number(params.get('page') ?? 0);
    return {
      q: params.get('q') || undefined,
      status: status.success ? status.data : undefined,
      planCode: params.get('planCode') || undefined,
      specialtyCode: params.get('specialtyCode') || undefined,
      trial:
        params.get('trial') === 'true' ? true : params.get('trial') === 'false' ? false : undefined,
      page: Number.isInteger(page) && page > 0 ? page : 0,
      size: PAGE_SIZE,
    };
  }, [params]);

  const update = (patch: Partial<ClinicListQuery>) =>
    replaceParams((next) => {
      // Cualquier cambio de filtro vuelve a la primera página.
      if (!('page' in patch)) next.delete('page');
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined || value === '' || (key === 'page' && value === 0))
          next.delete(key);
        else next.set(key, String(value));
      }
    });

  return [query, update];
}

const helper = createColumnHelper<typeof dataTableFeatures, ClinicSummary>();

export function ClinicsList() {
  const [query, update] = useListQuery();
  const clinics = useClinics(query);
  const plans = usePlans();
  const specialties = useSpecialties();
  const { planName, specialtyName } = useCatalogNames();

  // Búsqueda con debounce: el input es local, la URL se actualiza a los 300 ms.
  const [search, setSearch] = useState(query.q ?? '');
  useEffect(() => setSearch(query.q ?? ''), [query.q]);
  useEffect(() => {
    if ((query.q ?? '') === search.trim()) return;
    const t = setTimeout(() => update({ q: search.trim() || undefined }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- update cambia con cada render
  }, [search]);

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor('name', {
          header: 'Clínica',
          cell: (info) => (
            <div>
              <Link
                href={`/clinicas/${info.row.original.id}`}
                className="font-medium hover:underline"
              >
                {info.getValue()}
              </Link>
              <p className="font-mono text-xs text-muted-foreground">{info.row.original.slug}</p>
            </div>
          ),
        }),
        helper.accessor('operationalStatus', {
          header: 'Estado',
          cell: (info) => (
            <div className="flex flex-wrap gap-1">
              <ClinicStatusBadge status={info.getValue()} />
              {info.row.original.trial && <TrialBadge />}
            </div>
          ),
        }),
        helper.accessor('specialtyCode', {
          header: 'Especialidad',
          cell: (info) => specialtyName(info.getValue()),
        }),
        helper.accessor('planCode', {
          header: 'Plan',
          cell: (info) => planName(info.getValue()),
        }),
        helper.accessor('createdAt', {
          header: 'Creada',
          cell: (info) => formatDate(info.getValue()),
        }),
      ]),
    [planName, specialtyName],
  );

  const hasFilters = !!(
    query.q ||
    query.status ||
    query.planCode ||
    query.specialtyCode ||
    query.trial !== undefined
  );
  const page = clinics.data;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label="Buscar por nombre o slug"
            placeholder="Buscar por nombre o slug…"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-40">
          <NativeSelect
            aria-label="Estado"
            value={query.status ?? ''}
            onChange={(e) =>
              update({ status: (e.target.value || undefined) as ClinicListQuery['status'] })
            }
          >
            <option value="">Todos los estados</option>
            {operationalStatusSchema.options.map((s) => (
              <option key={s} value={s}>
                {OPERATIONAL_STATUS_LABEL[s]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="w-40">
          <NativeSelect
            aria-label="Plan"
            value={query.planCode ?? ''}
            onChange={(e) => update({ planCode: e.target.value || undefined })}
          >
            <option value="">Todos los planes</option>
            {plans.data?.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="w-56">
          <NativeSelect
            aria-label="Especialidad"
            value={query.specialtyCode ?? ''}
            onChange={(e) => update({ specialtyCode: e.target.value || undefined })}
          >
            <option value="">Todas las especialidades</option>
            {specialties.data?.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="w-44">
          <NativeSelect
            aria-label="Suscripción"
            value={query.trial === undefined ? '' : String(query.trial)}
            onChange={(e) =>
              update({ trial: e.target.value === '' ? undefined : e.target.value === 'true' })
            }
          >
            <option value="">Toda suscripción</option>
            <option value="true">En trial</option>
            <option value="false">Sin trial</option>
          </NativeSelect>
        </div>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch('');
              update({
                q: undefined,
                status: undefined,
                planCode: undefined,
                specialtyCode: undefined,
                trial: undefined,
              });
            }}
          >
            <X /> Limpiar filtros
          </Button>
        )}
      </div>

      {clinics.isError ? (
        <ErrorState error={clinics.error} onRetry={() => clinics.refetch()} />
      ) : !page ? (
        <LoadingState rows={PAGE_SIZE} label="Cargando clínicas…" />
      ) : (
        <>
          <div className={clinics.isFetching ? 'opacity-60 transition-opacity' : undefined}>
            <DataTable
              caption="Clínicas"
              columns={columns}
              data={page.content}
              getRowId={(c) => c.id}
              empty={
                <EmptyState
                  className="m-4"
                  title={
                    hasFilters ? 'Ninguna clínica coincide con los filtros' : 'Aún no hay clínicas'
                  }
                  description={hasFilters ? 'Prueba con otros filtros.' : undefined}
                />
              }
            />
          </div>
          <Pagination
            page={page.page}
            totalPages={page.totalPages}
            totalElements={page.totalElements}
            onPage={(p) => update({ page: p })}
          />
        </>
      )}
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  totalElements,
  onPage,
}: {
  page: number;
  totalPages: number;
  totalElements: number;
  onPage: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
      <p>
        {totalElements} {totalElements === 1 ? 'clínica' : 'clínicas'}
      </p>
      <div className="flex items-center gap-2">
        <span>
          Página {totalPages === 0 ? 0 : page + 1} de {totalPages}
        </span>
        <Button
          variant="outline"
          size="icon"
          aria-label="Página anterior"
          disabled={page <= 0}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Página siguiente"
          disabled={page + 1 >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
