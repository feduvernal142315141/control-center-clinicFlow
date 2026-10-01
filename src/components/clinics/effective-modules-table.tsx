'use client';

import { createColumnHelper } from '@tanstack/react-table';
import { CircleCheck, CircleX, Lock } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmptyState } from '@/components/states/empty-state';
import { ErrorState } from '@/components/states/error-state';
import { LoadingState } from '@/components/states/loading-state';
import { Badge } from '@/components/ui/badge';
import { DataTable, dataTableFeatures } from '@/components/ui/data-table';
import { useEffectiveModules } from '@/lib/api/hooks/use-clinics';
import type { EffectiveModule } from '@/lib/api/schemas';
import {
  deniedReasonText,
  EFFECTIVE_SOURCE_LABEL,
  formatDate,
  MODULE_CATEGORY_LABEL,
} from '@/lib/format';

const helper = createColumnHelper<typeof dataTableFeatures, EffectiveModule>();

export function CoreBadge() {
  return (
    <Badge variant="outline" className="gap-1">
      <Lock aria-hidden /> Core obligatorio
    </Badge>
  );
}

function OverrideNote({ m }: { m: EffectiveModule }) {
  if (!m.override) return null;
  return (
    <p className="text-xs text-muted-foreground">
      Override {m.override.enabled ? 'ON' : 'OFF'}: “{m.override.reason}” · {m.override.createdBy}
      {m.override.expiresAt ? ` · vence ${formatDate(m.override.expiresAt)}` : ' · sin vencimiento'}
    </p>
  );
}

/** Explica el estado tal como lo envía el backend. Nunca se recalcula aquí. */
export function EffectiveDetail({ m }: { m: EffectiveModule }) {
  if (m.enabled) {
    return (
      <div className="space-y-0.5">
        <p className="text-sm">{m.source ? EFFECTIVE_SOURCE_LABEL[m.source] : '—'}</p>
        <OverrideNote m={m} />
      </div>
    );
  }
  return (
    <div className="space-y-0.5">
      <p className="text-sm font-medium text-destructive" data-testid={`denied-${m.code}`}>
        {deniedReasonText(m)}
      </p>
      <OverrideNote m={m} />
    </div>
  );
}

const columns = helper.columns([
  helper.accessor('name', {
    header: 'Módulo',
    cell: (info) => {
      const m = info.row.original;
      return (
        <div className="space-y-1">
          <p className="font-medium">{m.name}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <code className="font-mono text-xs text-muted-foreground">{m.code}</code>
            {m.requiredCore && <CoreBadge />}
          </div>
        </div>
      );
    },
  }),
  helper.accessor('category', {
    header: 'Categoría',
    cell: (info) => MODULE_CATEGORY_LABEL[info.getValue()],
  }),
  helper.accessor('enabled', {
    header: 'Estado',
    cell: (info) =>
      info.getValue() ? (
        <Badge variant="success">
          <CircleCheck aria-hidden /> ON
        </Badge>
      ) : (
        <Badge variant="destructive">
          <CircleX aria-hidden /> OFF
        </Badge>
      ),
  }),
  helper.display({
    id: 'detail',
    header: 'Origen / motivo',
    cell: (info) => <EffectiveDetail m={info.row.original} />,
  }),
]);

export function EffectiveModulesTable({ clinicId }: { clinicId: string }) {
  const modules = useEffectiveModules(clinicId);
  const [onlyOff, setOnlyOff] = useState(false);
  const data = modules.data;
  const visible = useMemo(
    () => (onlyOff ? (data ?? []).filter((m) => !m.enabled) : (data ?? [])),
    [data, onlyOff],
  );

  if (modules.isError) {
    return <ErrorState error={modules.error} onRetry={() => modules.refetch()} />;
  }
  if (!data) return <LoadingState rows={8} label="Cargando módulos efectivos…" />;

  const on = data.filter((m) => m.enabled).length;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{on}</span> ON ·{' '}
          <span className="font-medium text-foreground">{data.length - on}</span> OFF · calculado
          por el backend
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={onlyOff}
            onChange={(e) => setOnlyOff(e.target.checked)}
          />
          Solo módulos OFF
        </label>
      </div>
      <DataTable
        caption="Módulos efectivos"
        columns={columns}
        data={visible}
        getRowId={(m) => m.code}
        empty={<EmptyState className="m-4" title="No hay módulos para mostrar" />}
      />
    </div>
  );
}
