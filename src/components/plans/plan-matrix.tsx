'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Lock, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { ActionDialog, ReasonField, useResetOnOpen } from '@/components/shared/action-dialog';
import { ConflictBanner } from '@/components/shared/conflict-banner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useUpdatePlanModules } from '@/lib/api/hooks/use-catalog-admin';
import { errorMessage, isVersionConflict } from '@/lib/api/errors';
import {
  reasonSchema,
  type AllowedLimit,
  type Plan,
  type PlanModule,
  type PlatformModule,
} from '@/lib/api/schemas';
import { missingPlanDependencies } from '@/lib/dependency-graph';
import { MODULE_CATEGORY_LABEL } from '@/lib/format';
import { useOptimisticVersion } from '@/lib/use-optimistic-version';

interface LimitRow {
  id: number;
  key: string;
  value: string;
  unlimited: boolean;
}

interface RowState {
  enabled: boolean;
  limits: LimitRow[];
}

type MatrixState = Record<string, RowState>;

let limitSeq = 0;

function rowFromPlan(plan: Plan, m: PlatformModule): RowState {
  const pm = plan.modules.find((x) => x.moduleCode === m.code);
  return {
    // Un core siempre está ON, diga lo que diga el plan.
    enabled: m.requiredCore || !!pm?.enabled,
    limits: Object.entries(pm?.limits ?? {}).map(([key, value]) => ({
      id: ++limitSeq,
      key,
      value: value === null ? '' : String(value),
      unlimited: value === null,
    })),
  };
}

const stateFromPlan = (plan: Plan, catalog: PlatformModule[]): MatrixState =>
  Object.fromEntries(catalog.map((m) => [m.code, rowFromPlan(plan, m)]));

function limitError(limit: LimitRow, siblings: LimitRow[], allowed: AllowedLimit[]): string | null {
  if (!allowed.some((a) => a.key === limit.key)) return 'Límite no permitido para este módulo';
  if (siblings.some((l) => l.id !== limit.id && l.key === limit.key)) return 'Límite repetido';
  if (!limit.unlimited && !/^\d+$/.test(limit.value)) return 'Entero ≥ 0 o "ilimitado"';
  return null;
}

function toPayload(
  state: MatrixState,
  catalog: PlatformModule[],
  fallback: (m: PlatformModule) => RowState,
): PlanModule[] {
  return catalog.map((m) => {
    const row = state[m.code] ?? fallback(m);
    const limits = Object.fromEntries(
      row.limits.map((l) => [l.key, l.unlimited ? null : Number(l.value)]),
    );
    return {
      moduleCode: m.code,
      enabled: m.requiredCore || row.enabled,
      ...(row.limits.length > 0 ? { limits } : {}),
    };
  });
}

/**
 * Matriz plan × módulo. Core bloqueado en ON, límites solo de `allowedLimits` (D15),
 * advertencia de dependencias (D12), motivo obligatorio y control de versión (D16).
 * `reload` recarga el plan y devuelve su versión actual.
 */
export function PlanMatrix({
  plan,
  catalog,
  reload,
}: {
  plan: Plan;
  catalog: PlatformModule[];
  reload: () => Promise<number | undefined>;
}) {
  const [initial, setInitial] = useState(() => stateFromPlan(plan, catalog));
  const [state, setState] = useState(initial);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const save = useUpdatePlanModules(plan.id);

  // Módulos que aparecieron en el catálogo después de cargar: se toman del servidor.
  const fallback = (m: PlatformModule) => rowFromPlan(plan, m);
  const rowOf = (m: PlatformModule) => state[m.code] ?? fallback(m);

  const payload = toPayload(state, catalog, fallback);
  const dirty = JSON.stringify(payload) !== JSON.stringify(toPayload(initial, catalog, fallback));

  const versioning = useOptimisticVersion(plan, {
    isDirty: dirty,
    resetTo: (server) => {
      const next = stateFromPlan(server, catalog);
      setInitial(next);
      setState(next);
    },
  });

  const setRow = (m: PlatformModule, patch: (row: RowState) => RowState) =>
    setState((s) => ({ ...s, [m.code]: patch(s[m.code] ?? fallback(m)) }));

  const invalid = catalog.some((m) => {
    const limits = rowOf(m).limits;
    return limits.some((l) => limitError(l, limits, m.allowedLimits));
  });
  const enabledCodes = useMemo(
    () => new Set(payload.filter((p) => p.enabled).map((p) => p.moduleCode)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- payload se recalcula por render
    [JSON.stringify(payload)],
  );
  const missing = useMemo(
    () => missingPlanDependencies(catalog, enabledCodes),
    [catalog, enabledCodes],
  );

  const confirmSave = (reason: string) =>
    save.mutate(
      { modules: payload, reason, version: versioning.baseVersion },
      {
        onSuccess: (saved) => {
          toast.success('Matriz guardada');
          setConfirmOpen(false);
          versioning.onSaved(saved);
        },
        onError: (e) => {
          if (isVersionConflict(e)) {
            setConfirmOpen(false);
            save.reset();
            void versioning.onConflict(reload);
          }
        },
      },
    );

  return (
    <div className="space-y-4">
      {versioning.conflict && <ConflictBanner onDiscard={versioning.discard} />}
      {missing.length > 0 && <MissingDependenciesAlert missing={missing} />}
      <Table>
        <caption className="sr-only">Matriz de módulos del plan {plan.code}</caption>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Módulo</TableHead>
            <TableHead>Categoría</TableHead>
            <TableHead>Incluido</TableHead>
            <TableHead>Límites</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {catalog.map((m) => {
            const row = rowOf(m);
            const on = m.requiredCore || row.enabled;
            return (
              <TableRow key={m.code} data-testid={`matrix-row-${m.code}`}>
                <TableCell className="align-top">
                  <p className="font-medium">{m.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <code className="font-mono text-xs text-muted-foreground">{m.code}</code>
                    {m.requiredCore && (
                      <Badge variant="outline">
                        <Lock aria-hidden /> Core obligatorio
                      </Badge>
                    )}
                    {!m.active && <Badge variant="secondary">Inactivo en catálogo</Badge>}
                  </div>
                  {m.dependsOn.length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Depende de: {m.dependsOn.join(', ')}
                    </p>
                  )}
                </TableCell>
                <TableCell className="align-top">{MODULE_CATEGORY_LABEL[m.category]}</TableCell>
                <TableCell className="align-top">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary disabled:opacity-60"
                    aria-label={`Incluir ${m.code}`}
                    checked={on}
                    disabled={m.requiredCore}
                    title={m.requiredCore ? 'Core obligatorio: siempre ON' : undefined}
                    onChange={(e) => setRow(m, (r) => ({ ...r, enabled: e.target.checked }))}
                  />
                </TableCell>
                <TableCell className="align-top">
                  {m.allowedLimits.length === 0 && row.limits.length === 0 ? (
                    <span className="text-xs text-muted-foreground">No admite límites</span>
                  ) : (
                    <LimitsEditor
                      moduleCode={m.code}
                      allowed={m.allowedLimits}
                      limits={row.limits}
                      disabled={!on}
                      onChange={(limits) => setRow(m, (r) => ({ ...r, limits }))}
                    />
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <div className="flex items-center gap-3">
        <Button onClick={() => setConfirmOpen(true)} disabled={!dirty || invalid}>
          Guardar matriz
        </Button>
        {dirty && (
          <Button variant="ghost" onClick={() => setState(initial)}>
            Descartar cambios
          </Button>
        )}
        {invalid && <p className="text-sm text-destructive">Corrige los límites marcados.</p>}
      </div>
      <SaveMatrixDialog
        plan={plan}
        payload={payload}
        missing={missing}
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!open) save.reset();
          setConfirmOpen(open);
        }}
        pending={save.isPending}
        error={save.error}
        onConfirm={confirmSave}
      />
    </div>
  );
}

function MissingDependenciesAlert({
  missing,
}: {
  missing: ReturnType<typeof missingPlanDependencies>;
}) {
  return (
    <Alert>
      <AlertTriangle className="text-warning" />
      <AlertTitle>Módulos ON sin sus dependencias en el plan</AlertTitle>
      <AlertDescription>
        <ul className="list-disc pl-4" aria-label="Dependencias faltantes">
          {missing.map((r) => (
            <li key={r.moduleCode}>
              <code className="font-mono">{r.moduleCode}</code> requiere{' '}
              {r.missing.map((d) => (
                <code key={d} className="mr-1 font-mono">
                  {d}
                </code>
              ))}
            </li>
          ))}
        </ul>
        <p>
          Se puede guardar igual: en las clínicas quedarán OFF por dependencia faltante (lo decide
          el backend).
        </p>
      </AlertDescription>
    </Alert>
  );
}

const limitLabel = (a: AllowedLimit) => `${a.label} (${a.unit})`;

/** Solo ofrece las claves de `allowedLimits` del módulo; sin texto libre (D15). */
function LimitsEditor({
  moduleCode,
  allowed,
  limits,
  disabled,
  onChange,
}: {
  moduleCode: string;
  allowed: AllowedLimit[];
  limits: LimitRow[];
  disabled: boolean;
  onChange: (limits: LimitRow[]) => void;
}) {
  const update = (id: number, patch: Partial<LimitRow>) =>
    onChange(limits.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const unused = allowed.filter((a) => !limits.some((l) => l.key === a.key));

  return (
    <div className="space-y-2">
      {limits.length === 0 && <p className="text-xs text-muted-foreground">Sin límites</p>}
      {limits.map((l) => {
        const error = limitError(l, limits, allowed);
        const known = allowed.find((a) => a.key === l.key);
        // Opciones: la clave propia + las no usadas por otras filas.
        const options = allowed.filter(
          (a) => a.key === l.key || !limits.some((o) => o.id !== l.id && o.key === a.key),
        );
        return (
          <div key={l.id} className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-56">
                <NativeSelect
                  aria-label={`Límite de ${moduleCode}`}
                  className="h-8 text-xs"
                  value={l.key}
                  disabled={disabled}
                  aria-invalid={!known}
                  onChange={(e) => update(l.id, { key: e.target.value })}
                >
                  {!known && <option value={l.key}>{l.key} (no permitido)</option>}
                  {options.map((a) => (
                    <option key={a.key} value={a.key}>
                      {limitLabel(a)}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <Input
                aria-label={`Valor de ${l.key} en ${moduleCode}`}
                type="number"
                min={0}
                step={1}
                className="h-8 w-28"
                value={l.unlimited ? '' : l.value}
                placeholder={l.unlimited ? '∞' : '0'}
                disabled={disabled || l.unlimited}
                aria-invalid={!!error}
                onChange={(e) => update(l.id, { value: e.target.value })}
              />
              <label className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  className="size-3.5 accent-primary"
                  aria-label={`${l.key} ilimitado en ${moduleCode}`}
                  checked={l.unlimited}
                  disabled={disabled}
                  onChange={(e) => update(l.id, { unlimited: e.target.checked })}
                />
                Ilimitado
              </label>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={`Quitar ${l.key} de ${moduleCode}`}
                disabled={disabled}
                onClick={() => onChange(limits.filter((x) => x.id !== l.id))}
              >
                <Trash2 />
              </Button>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        );
      })}
      {unused.length > 0 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          disabled={disabled}
          aria-label={`Agregar límite a ${moduleCode}`}
          onClick={() =>
            onChange([
              ...limits,
              { id: ++limitSeq, key: unused[0].key, value: '', unlimited: false },
            ])
          }
        >
          <Plus /> Límite
        </Button>
      )}
    </div>
  );
}

const reasonOnly = z.object({ reason: reasonSchema });

function SaveMatrixDialog({
  plan,
  payload,
  missing,
  open,
  onOpenChange,
  pending,
  error,
  onConfirm,
}: {
  plan: Plan;
  payload: PlanModule[];
  missing: ReturnType<typeof missingPlanDependencies>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  error: unknown;
  onConfirm: (reason: string) => void;
}) {
  const form = useForm<z.infer<typeof reasonOnly>>({ resolver: zodResolver(reasonOnly) });
  useResetOnOpen(form, open, { reason: '' });
  const enabled = payload.filter((p) => p.enabled).length;

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Guardar matriz de ${plan.name}`}
      submitLabel="Guardar matriz"
      pending={pending}
      description={
        <p>
          Afecta a todas las clínicas con el plan <code className="font-mono">{plan.code}</code>.
          Quedarán {enabled} de {payload.length} módulos incluidos.
        </p>
      }
      onSubmit={form.handleSubmit(({ reason }) => onConfirm(reason))}
    >
      {!!error && !isVersionConflict(error) && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertDescription>{errorMessage(error)}</AlertDescription>
        </Alert>
      )}
      {missing.length > 0 && <MissingDependenciesAlert missing={missing} />}
      <ReasonField form={form} />
    </ActionDialog>
  );
}
