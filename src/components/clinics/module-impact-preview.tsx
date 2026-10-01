'use client';

import { ArrowDownCircle, ArrowUpCircle, Loader2 } from 'lucide-react';
import { ErrorState } from '@/components/states/error-state';
import { useEffectiveModules, useEffectivePreview } from '@/lib/api/hooks/use-clinics';
import type { EffectiveModule, EffectivePreviewQuery } from '@/lib/api/schemas';
import { deniedReasonText, EFFECTIVE_SOURCE_LABEL } from '@/lib/format';

/**
 * Qué módulos cambiarían si se guarda el cambio. Ambos lados vienen del backend
 * (estado actual y vista previa); aquí solo se comparan para listarlos.
 */
export function ModuleImpactPreview({
  clinicId,
  preview,
}: {
  clinicId: string;
  preview: EffectivePreviewQuery;
}) {
  const current = useEffectiveModules(clinicId);
  const next = useEffectivePreview(clinicId, preview);

  if (!preview.specialtyCode && !preview.planCode) return null;
  if (current.isError || next.isError) {
    return (
      <ErrorState
        title="No se pudo calcular el impacto en módulos"
        error={current.error ?? next.error}
        onRetry={() => {
          void current.refetch();
          void next.refetch();
        }}
      />
    );
  }
  if (!current.data || !next.data) {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Calculando impacto en módulos…
      </p>
    );
  }

  const before = new Map(current.data.map((m) => [m.code, m.enabled]));
  const turnsOff = next.data.filter((m) => !m.enabled && before.get(m.code) === true);
  const turnsOn = next.data.filter((m) => m.enabled && before.get(m.code) === false);

  return (
    <section
      aria-label="Impacto en módulos"
      className="space-y-3 rounded-md border bg-muted/30 p-3 text-sm"
    >
      <p className="font-medium">Impacto en módulos</p>
      {turnsOff.length === 0 && turnsOn.length === 0 ? (
        <p className="text-muted-foreground">Ningún módulo cambia de estado.</p>
      ) : (
        <>
          <ImpactList
            title={`Pasan de ON a OFF (${turnsOff.length})`}
            icon={<ArrowDownCircle className="size-4 text-destructive" />}
            modules={turnsOff}
            detail={(m) => deniedReasonText(m)}
          />
          <ImpactList
            title={`Pasan de OFF a ON (${turnsOn.length})`}
            icon={<ArrowUpCircle className="size-4 text-success" />}
            modules={turnsOn}
            detail={(m) => (m.source ? EFFECTIVE_SOURCE_LABEL[m.source] : null)}
          />
        </>
      )}
    </section>
  );
}

function ImpactList({
  title,
  icon,
  modules,
  detail,
}: {
  title: string;
  icon: React.ReactNode;
  modules: EffectiveModule[];
  detail: (m: EffectiveModule) => string | null;
}) {
  if (modules.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-1.5 font-medium">
        {icon}
        {title}
      </p>
      <ul className="space-y-1 pl-6" aria-label={title}>
        {modules.map((m) => (
          <li key={m.code}>
            <span className="font-medium">{m.name}</span>{' '}
            <code className="font-mono text-xs text-muted-foreground">{m.code}</code>
            {detail(m) && <p className="text-xs text-muted-foreground">{detail(m)}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
