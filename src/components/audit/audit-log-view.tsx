'use client';

import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { EmptyState } from '@/components/states/empty-state';
import { ErrorState } from '@/components/states/error-state';
import { LoadingState } from '@/components/states/loading-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuditLogs, usePlatformUsers } from '@/lib/api/hooks/use-audit';
import { useClinic, useClinics } from '@/lib/api/hooks/use-clinics';
import { KNOWN_AUDIT_ACTIONS, type AuditLog, type AuditLogQuery } from '@/lib/api/schemas';
import { fromDateInput } from '@/lib/dates';
import { auditActionLabel, formatDateTime, isKnownAuditAction } from '@/lib/format';
import { useSearchParamsUpdater } from '@/lib/use-search-params-updater';
import { AuditEventDialog } from './audit-event-dialog';

export const AUDIT_PAGE_SIZE = 20;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Filtros ⇄ query string. En el tab de clínica, `clinicId` viene fijo y no se lee de la URL. */
function useAuditFilters(fixedClinicId?: string) {
  const params = useSearchParams();
  const replaceParams = useSearchParamsUpdater();

  const filters = useMemo(() => {
    const from = params.get('from') ?? '';
    const to = params.get('to') ?? '';
    const page = Number(params.get('page') ?? 0);
    return {
      clinicId: fixedClinicId ?? params.get('clinicId') ?? '',
      actorId: params.get('actorId') ?? '',
      action: params.get('action') ?? '',
      from: DATE_RE.test(from) ? from : '',
      to: DATE_RE.test(to) ? to : '',
      page: Number.isInteger(page) && page > 0 ? page : 0,
    };
  }, [params, fixedClinicId]);

  const update = (patch: Partial<Omit<typeof filters, 'clinicId'>> & { clinicId?: string }) =>
    replaceParams((next) => {
      if (!('page' in patch)) next.delete('page');
      for (const [key, value] of Object.entries(patch)) {
        if (key === 'clinicId' && fixedClinicId) continue;
        if (value === '' || value === undefined || (key === 'page' && value === 0))
          next.delete(key);
        else next.set(key, String(value));
      }
    });

  // Fechas del input (día local) → rango ISO: desde el inicio del día hasta su final.
  const query: AuditLogQuery = {
    clinicId: filters.clinicId || undefined,
    actorId: filters.actorId || undefined,
    action: filters.action || undefined,
    from: filters.from ? fromDateInput(filters.from) : undefined,
    to: filters.to ? new Date(`${filters.to}T23:59:59.999`).toISOString() : undefined,
    page: filters.page,
    size: AUDIT_PAGE_SIZE,
  };

  return { filters, update, query };
}

/**
 * Auditoría: global (`/auditoria`, con filtro de clínica) o de una clínica (tab, `clinicId` fijo).
 * Filtros en la URL, paginación del backend y detalle con diff before/after.
 */
export function AuditLogView({ clinicId }: { clinicId?: string }) {
  const { filters, update, query } = useAuditFilters(clinicId);
  const logs = useAuditLogs(query);
  const users = usePlatformUsers();
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const global = !clinicId;

  const hasFilters = !!(
    (global && filters.clinicId) ||
    filters.actorId ||
    filters.action ||
    filters.from ||
    filters.to
  );
  const page = logs.data;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        {global && (
          <ClinicFilter value={filters.clinicId} onChange={(id) => update({ clinicId: id })} />
        )}
        <div className="w-56 space-y-1">
          <Label htmlFor="audit-actor">Actor</Label>
          <NativeSelect
            id="audit-actor"
            value={filters.actorId}
            onChange={(e) => update({ actorId: e.target.value })}
          >
            <option value="">Todos</option>
            {users.data?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.email}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="w-60 space-y-1">
          <Label htmlFor="audit-action">Acción</Label>
          <NativeSelect
            id="audit-action"
            value={filters.action}
            onChange={(e) => update({ action: e.target.value })}
          >
            <option value="">Todas</option>
            {KNOWN_AUDIT_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {auditActionLabel(a)}
              </option>
            ))}
            {filters.action && !isKnownAuditAction(filters.action) && (
              <option value={filters.action}>{filters.action}</option>
            )}
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <Label htmlFor="audit-from">Desde</Label>
          <Input
            id="audit-from"
            type="date"
            className="w-40"
            value={filters.from}
            max={filters.to || undefined}
            onChange={(e) => update({ from: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="audit-to">Hasta</Label>
          <Input
            id="audit-to"
            type="date"
            className="w-40"
            value={filters.to}
            min={filters.from || undefined}
            onChange={(e) => update({ to: e.target.value })}
          />
        </div>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => update({ clinicId: '', actorId: '', action: '', from: '', to: '' })}
          >
            <X /> Limpiar filtros
          </Button>
        )}
      </div>

      {logs.isError ? (
        <ErrorState error={logs.error} onRetry={() => logs.refetch()} />
      ) : !page ? (
        <LoadingState rows={8} label="Cargando auditoría…" />
      ) : page.content.length === 0 ? (
        <EmptyState
          title={hasFilters ? 'Ningún evento coincide con los filtros' : 'Todavía no hay eventos'}
        />
      ) : (
        <>
          <div className={logs.isFetching ? 'opacity-60 transition-opacity' : undefined}>
            <Table>
              <caption className="sr-only">Eventos de auditoría</caption>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Fecha</TableHead>
                  <TableHead>Acción</TableHead>
                  {global && <TableHead>Clínica</TableHead>}
                  <TableHead>Actor</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="sr-only">Detalle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {page.content.map((log) => (
                  <TableRow key={log.id} data-testid={`audit-${log.id}`}>
                    <TableCell className="text-sm whitespace-nowrap">
                      {formatDateTime(log.createdAt)}
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-medium">{auditActionLabel(log.action)}</p>
                      <code className="font-mono text-xs text-muted-foreground">{log.action}</code>
                    </TableCell>
                    {global && (
                      <TableCell className="text-sm">
                        {log.clinicId ? (
                          <Link href={`/clinicas/${log.clinicId}`} className="hover:underline">
                            {log.clinicName ?? log.clinicId}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">Plataforma</span>
                        )}
                      </TableCell>
                    )}
                    <TableCell className="text-sm">{log.actor.email}</TableCell>
                    <TableCell className="max-w-72 truncate text-sm" title={log.reason ?? ''}>
                      {log.reason ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => setSelected(log)}>
                        Ver detalle
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
            <p>
              {page.totalElements} {page.totalElements === 1 ? 'evento' : 'eventos'}
            </p>
            <div className="flex items-center gap-2">
              <span>
                Página {page.totalPages === 0 ? 0 : page.page + 1} de {page.totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                aria-label="Página anterior"
                disabled={page.page <= 0}
                onClick={() => update({ page: page.page - 1 })}
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label="Página siguiente"
                disabled={page.page + 1 >= page.totalPages}
                onClick={() => update({ page: page.page + 1 })}
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
        </>
      )}

      <AuditEventDialog log={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

/** Buscador de clínica para el filtro global: escribe y elige; guarda el `clinicId`. */
function ClinicFilter({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [text, setText] = useState('');
  const selected = useClinic(value);
  const results = useClinics({ q: text.trim() || undefined, size: 8 });
  const options = text.trim() ? (results.data?.content ?? []) : [];

  if (value) {
    return (
      <div className="space-y-1">
        <span className="text-sm font-medium">Clínica</span>
        <div className="flex h-9 items-center gap-2 rounded-md border px-3 text-sm">
          <span data-testid="audit-clinic-filter">
            {selected.data?.name ?? (selected.isError ? value : '…')}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            aria-label="Quitar filtro de clínica"
            onClick={() => onChange('')}
          >
            <X />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-64 space-y-1">
      <Label htmlFor="audit-clinic">Clínica</Label>
      <Input
        id="audit-clinic"
        placeholder="Buscar por nombre o slug…"
        autoComplete="off"
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-controls="audit-clinic-options"
      />
      {options.length > 0 && (
        <ul
          id="audit-clinic-options"
          role="listbox"
          aria-label="Clínicas encontradas"
          className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-md"
        >
          {options.map((c) => (
            <li key={c.id} role="option" aria-selected={false}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                onClick={() => {
                  setText('');
                  onChange(c.id);
                }}
              >
                {c.name}
                <span className="block font-mono text-xs text-muted-foreground">{c.slug}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
