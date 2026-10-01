'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { AuditLog } from '@/lib/api/schemas';
import { diffAudit, formatDiffValue, type DiffKind } from '@/lib/audit-diff';
import { auditActionLabel, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

const KIND: Record<Exclude<DiffKind, 'same'>, { label: string; row: string }> = {
  changed: { label: 'Cambió', row: 'bg-warning/10' },
  added: { label: 'Nuevo', row: 'bg-success/10' },
  removed: { label: 'Quitado', row: 'bg-destructive/10' },
};

/** Detalle de un evento: metadatos + diff campo a campo (cambios resaltados). */
export function AuditEventDialog({ log, onClose }: { log: AuditLog | null; onClose: () => void }) {
  const [showSame, setShowSame] = useState(false);
  const rows = log ? diffAudit(log.before, log.after) : [];
  const changes = rows.filter((r) => r.kind !== 'same');
  const visible = showSame ? rows : changes;

  return (
    <Dialog
      open={!!log}
      onOpenChange={(open) => {
        if (!open) {
          setShowSame(false);
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-3xl">
        {log && (
          <>
            <DialogHeader>
              <DialogTitle>{auditActionLabel(log.action)}</DialogTitle>
              <DialogDescription>
                <code className="font-mono">{log.action}</code> · {formatDateTime(log.createdAt)}
              </DialogDescription>
            </DialogHeader>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <Meta label="Actor">{log.actor.email}</Meta>
              <Meta label="IP">{log.ip ?? '—'}</Meta>
              <Meta label="Clínica">
                {log.clinicId ? (
                  <Link href={`/clinicas/${log.clinicId}`} className="hover:underline">
                    {log.clinicName ?? log.clinicId}
                  </Link>
                ) : (
                  'Plataforma'
                )}
              </Meta>
              <Meta label="Entidad">
                {log.entityType} · <code className="font-mono text-xs">{log.entityId}</code>
              </Meta>
              <div className="sm:col-span-2">
                <Meta label="Motivo">{log.reason ?? '—'}</Meta>
              </div>
            </dl>

            <section className="space-y-2" aria-label="Cambios">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium">
                  Cambios ({changes.length}
                  {changes.length === 1 ? ' campo' : ' campos'})
                </h3>
                {rows.length > changes.length && (
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      className="size-3.5 accent-primary"
                      checked={showSame}
                      onChange={(e) => setShowSame(e.target.checked)}
                    />
                    Mostrar campos sin cambios ({rows.length - changes.length})
                  </label>
                )}
              </div>
              {visible.length === 0 ? (
                <p className="text-sm text-muted-foreground">El evento no registra cambios.</p>
              ) : (
                <Table>
                  <caption className="sr-only">Antes y después</caption>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Campo</TableHead>
                      <TableHead>Antes</TableHead>
                      <TableHead>Después</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.map((r) => (
                      <TableRow
                        key={r.path}
                        data-kind={r.kind}
                        className={cn(r.kind !== 'same' && KIND[r.kind].row)}
                      >
                        <TableCell className="align-top">
                          <code className="font-mono text-xs">{r.path}</code>
                          {r.kind !== 'same' && (
                            <Badge variant="outline" className="ml-2">
                              {KIND[r.kind].label}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="max-w-56 align-top font-mono text-xs break-all">
                          {r.kind === 'added' ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            formatDiffValue(r.before)
                          )}
                        </TableCell>
                        <TableCell className="max-w-56 align-top font-mono text-xs break-all">
                          {r.kind === 'removed' ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            formatDiffValue(r.after)
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">
                  Ver JSON completo
                </summary>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <pre className="overflow-auto rounded-md bg-muted p-2">
                    {JSON.stringify(log.before, null, 2)}
                  </pre>
                  <pre className="overflow-auto rounded-md bg-muted p-2">
                    {JSON.stringify(log.after, null, 2)}
                  </pre>
                </div>
              </details>
            </section>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
