'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Copy, X } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
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
import { useClinicUsers, useClinics } from '@/lib/api/hooks/use-clinics';
import { useSystemErrorLogs } from '@/lib/api/hooks/use-system-errors';
import type { SystemErrorLogQuery } from '@/lib/api/schemas';
import { formatDateTime } from '@/lib/format';
import { useSearchParamsUpdater } from '@/lib/use-search-params-updater';

const PAGE_SIZE = 20;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function useErrorFilters() {
  const params = useSearchParams();
  const replaceParams = useSearchParamsUpdater();
  const filters = useMemo(
    () => ({
      clinicId: params.get('clinicId') ?? '',
      userId: params.get('userId') ?? '',
      exceptionClass: params.get('exceptionClass') ?? '',
      requestPath: params.get('requestPath') ?? '',
      operationName: params.get('operationName') ?? '',
      from: DATE_RE.test(params.get('from') ?? '') ? params.get('from')! : '',
      to: DATE_RE.test(params.get('to') ?? '') ? params.get('to')! : '',
      cursor: params.get('cursor') ?? undefined,
    }),
    [params],
  );
  const update = (patch: Partial<typeof filters>) =>
    replaceParams((next) => {
      if (!('cursor' in patch)) next.delete('cursor');
      for (const [key, value] of Object.entries(patch)) {
        if (!value) next.delete(key);
        else next.set(key, String(value));
      }
    });
  const queryFilters = [
    filters.clinicId && `clinicId__EQ__UUID:${filters.clinicId}`,
    filters.userId === 'anonymous' ? 'actor__EQ__ANONYMOUS' : filters.userId && `userId__EQ__UUID:${filters.userId}`,
    filters.exceptionClass && `exceptionClass__CONTAINS_IGNORE_CASE__${filters.exceptionClass}`,
    filters.requestPath && `requestPath__CONTAINS_IGNORE_CASE__${filters.requestPath}`,
    filters.operationName && `operationName__CONTAINS_IGNORE_CASE__${filters.operationName}`,
    filters.from && `occurredAt__GTE__DATE_TIME:${filters.from} 00:00:00`,
    filters.to && `occurredAt__LTE__DATE_TIME:${filters.to} 23:59:59`,
    filters.cursor && `cursor__EQ__${filters.cursor}`,
  ].filter((value): value is string => Boolean(value));
  const query: SystemErrorLogQuery = {
    filters: queryFilters,
    page: 0,
    pageSize: PAGE_SIZE,
  };
  return { filters, update, query };
}

export function SystemErrorLogView() {
  const { filters, update, query } = useErrorFilters();
  const logs = useSystemErrorLogs(query);
  const clinics = useClinics({ page: 0, size: 100 });
  const users = useClinicUsers(filters.clinicId);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [copiedLogId, setCopiedLogId] = useState<string | null>(null);
  const hasFilters = Object.entries(filters).some(
    ([key, value]) => key !== 'cursor' && Boolean(value),
  );
  const clear = () => {
    setCursorHistory([]);
    update({ clinicId: '', userId: '', exceptionClass: '', requestPath: '', operationName: '', from: '', to: '', cursor: undefined });
  };
  const next = () => {
    if (!logs.data?.nextCursor) return;
    setCursorHistory((history) => [...history, filters.cursor ?? '']);
    update({ cursor: logs.data.nextCursor });
  };
  const previous = () => {
    const history = [...cursorHistory];
    const cursor = history.pop();
    setCursorHistory(history);
    update({ cursor: cursor || undefined });
  };
  const copyStackTrace = async (id: string, stackTrace: string) => {
    await navigator.clipboard.writeText(stackTrace);
    setCopiedLogId(id);
    window.setTimeout(() => setCopiedLogId((current) => (current === id ? null : current)), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-56 space-y-1">
          <Label htmlFor="error-clinic">Clínica</Label>
          <NativeSelect
            id="error-clinic"
            value={filters.clinicId}
            onChange={(e) => update({ clinicId: e.target.value, userId: '' })}
          >
            <option value="">Todas</option>
            {clinics.data?.content.map((clinic) => (
              <option key={clinic.id} value={clinic.id}>
                {clinic.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="w-56 space-y-1">
          <Label htmlFor="error-user">Usuario de clínica</Label>
          <NativeSelect
            id="error-user"
            value={filters.userId}
            onChange={(e) => update({ userId: e.target.value })}
          >
            <option value="" disabled={!filters.clinicId}>
              {filters.clinicId ? 'Todos' : 'Selecciona una clínica'}
            </option>
            <option value="anonymous">Anónimo</option>
            {users.data?.map((user) => (
              <option key={user.id} value={user.id}>
                {user.email}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="w-64 space-y-1">
          <Label htmlFor="error-class">Clase o paquete</Label>
          <Input
            id="error-class"
            value={filters.exceptionClass}
            onChange={(e) => update({ exceptionClass: e.target.value })}
            placeholder="Ej. NullPointerException"
          />
        </div>
        <div className="w-64 space-y-1">
          <Label htmlFor="error-path">Endpoint</Label>
          <Input
            id="error-path"
            value={filters.requestPath}
            onChange={(e) => update({ requestPath: e.target.value })}
            placeholder="Ej. /platform/system-error-logs"
          />
        </div>
        <div className="w-64 space-y-1">
          <Label htmlFor="error-operation">Command / Query</Label>
          <Input
            id="error-operation"
            value={filters.operationName}
            onChange={(e) => update({ operationName: e.target.value })}
            placeholder="Ej. GetPlatformSystemErrorLogsQuery"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="error-from">Desde</Label>
          <Input
            id="error-from"
            type="date"
            value={filters.from}
            max={filters.to || undefined}
            onChange={(e) => update({ from: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="error-to">Hasta</Label>
          <Input
            id="error-to"
            type="date"
            value={filters.to}
            min={filters.from || undefined}
            onChange={(e) => update({ to: e.target.value })}
          />
        </div>
        {hasFilters && (
          <Button variant="ghost" onClick={clear}>
            <X /> Limpiar filtros
          </Button>
        )}
      </div>
      {logs.isError ? (
        <ErrorState error={logs.error} onRetry={() => logs.refetch()} />
      ) : !logs.data ? (
        <LoadingState rows={8} label="Cargando errores del sistema…" />
      ) : logs.data.content.length === 0 ? (
        <EmptyState
          title={
            hasFilters
              ? 'Ningún error coincide con los filtros'
              : 'Todavía no hay errores registrados'
          }
        />
      ) : (
        <>
          <div className={logs.isFetching ? 'opacity-60 transition-opacity' : undefined}>
            <Table>
              <caption className="sr-only">Errores del sistema</caption>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Clínica</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Excepción</TableHead>
                  <TableHead>Ruta</TableHead>
                  <TableHead>Detalle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.data.content.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm whitespace-nowrap">
                      {formatDateTime(log.occurredAt)}
                    </TableCell>
                    <TableCell className="text-sm">{log.clinicName ?? 'Plataforma'}</TableCell>
                    <TableCell className="text-sm">{log.userEmail ?? 'Anónimo'}</TableCell>
                    <TableCell>
                      <p
                        className="max-w-72 truncate text-sm font-medium"
                        title={log.exceptionClass}
                      >
                        {log.exceptionClass}
                      </p>
                      <code className="text-xs text-muted-foreground">HTTP {log.httpStatus}</code>
                    </TableCell>
                    <TableCell className="max-w-64 truncate text-sm" title={log.requestPath ?? ''}>
                      {log.requestMethod} {log.requestPath}
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xl">
                        <pre
                          className="max-h-20 overflow-hidden rounded bg-muted p-3 text-xs whitespace-pre-wrap"
                          title="Vista previa del stack trace"
                        >
                          {log.stackTrace}
                        </pre>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="mt-1"
                          onClick={() => void copyStackTrace(log.id, log.stackTrace)}
                          aria-label={`Copiar stack trace de ${log.exceptionClass}`}
                        >
                          {copiedLogId === log.id ? <><Check /> Copiado</> : <><Copy /> Copiar stack trace</>}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={!cursorHistory.length || logs.isFetching}
              onClick={previous}
            >
              <ChevronLeft /> Anterior
            </Button>
            <Button disabled={!logs.data.hasNext || logs.isFetching} onClick={next}>
              Siguiente <ChevronRight />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
