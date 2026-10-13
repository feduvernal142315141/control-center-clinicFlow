'use client';
import { useState } from 'react';
import { useSystemErrorLogs } from '@/lib/api/hooks/use-system-errors';
import { useClinics } from '@/lib/api/hooks/use-clinics';
import type { SystemErrorLogQuery } from '@/lib/api/schemas';
import { formatDateTime } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/states/empty-state';
import { ErrorState } from '@/components/states/error-state';
import { LoadingState } from '@/components/states/loading-state';

const SIZE = 20;
export function SystemErrorLogView() {
  const clinics = useClinics({ page: 0, size: 100 });
  const [filters, setFilters] = useState({ clinicId: '', exceptionClass: '', cursor: undefined as string | undefined });
  const query: SystemErrorLogQuery = { clinicId: filters.clinicId || undefined, exceptionClass: filters.exceptionClass || undefined, cursor: filters.cursor, size: SIZE };
  const logs = useSystemErrorLogs(query);
  const update = (patch: Partial<typeof filters>) => setFilters((current) => ({ ...current, ...patch, cursor: patch.cursor }));
  return <div className="space-y-4">
    <div className="flex flex-wrap items-end gap-3">
      <div className="w-64 space-y-1"><Label htmlFor="error-clinic">Clínica</Label><NativeSelect id="error-clinic" value={filters.clinicId} onChange={(e) => update({ clinicId: e.target.value, cursor: undefined })}><option value="">Todas</option>{clinics.data?.content.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect></div>
      <div className="w-72 space-y-1"><Label htmlFor="error-class">Clase o paquete</Label><Input id="error-class" value={filters.exceptionClass} placeholder="NullPointerException" onChange={(e) => update({ exceptionClass: e.target.value, cursor: undefined })} onKeyDown={(e) => { if (e.key === 'Enter') logs.refetch(); }} /></div>
      {(filters.clinicId || filters.exceptionClass) && <Button variant="ghost" onClick={() => setFilters({ clinicId: '', exceptionClass: '', cursor: undefined })}>Limpiar filtros</Button>}
    </div>
    {logs.isError ? <ErrorState error={logs.error} onRetry={() => logs.refetch()} /> : !logs.data ? <LoadingState rows={8} label="Cargando errores…" /> : logs.data.content.length === 0 ? <EmptyState title="No hay errores registrados" /> : <>
      <div className={logs.isFetching ? 'opacity-60 transition-opacity' : undefined}><Table><caption className="sr-only">Errores del sistema</caption><TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Clínica</TableHead><TableHead>Usuario</TableHead><TableHead>Excepción</TableHead><TableHead>Ruta</TableHead><TableHead>Detalle</TableHead></TableRow></TableHeader><TableBody>{logs.data.content.map((log) => <TableRow key={log.id}><TableCell className="whitespace-nowrap text-sm">{formatDateTime(log.occurredAt)}</TableCell><TableCell className="text-sm">{log.clinicName ?? 'Plataforma'}</TableCell><TableCell className="text-sm">{log.userEmail ?? 'Anónimo'}</TableCell><TableCell><p className="max-w-72 truncate text-sm font-medium" title={log.exceptionClass}>{log.exceptionClass}</p><code className="text-xs text-muted-foreground">HTTP {log.httpStatus}</code></TableCell><TableCell className="max-w-64 truncate text-sm" title={log.requestPath ?? ''}>{log.requestMethod} {log.requestPath}</TableCell><TableCell><details><summary className="cursor-pointer text-sm text-primary">Ver stack trace</summary><pre className="mt-2 max-h-64 max-w-xl overflow-auto whitespace-pre-wrap rounded bg-muted p-3 text-xs">{log.stackTrace}</pre></details></TableCell></TableRow>)}</TableBody></Table></div>
      <div className="flex justify-end gap-2"><Button variant="outline" disabled={!filters.cursor || logs.isFetching} onClick={() => setFilters((f) => ({ ...f, cursor: undefined }))}>Primera</Button><Button disabled={!logs.data.hasNext || logs.isFetching} onClick={() => setFilters((f) => ({ ...f, cursor: logs.data.nextCursor ?? undefined }))}>Siguiente</Button></div>
    </>}
  </div>;
}
