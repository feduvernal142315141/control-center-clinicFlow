'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Lock, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { ActionDialog, ReasonField, useResetOnOpen } from '@/components/shared/action-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useUpdatePlanModules } from '@/lib/api/hooks/use-catalog-admin';
import {
  limitKeySchema,
  reasonSchema,
  type Plan,
  type PlanModule,
  type PlatformModule,
} from '@/lib/api/schemas';
import { missingPlanDependencies } from '@/lib/dependency-graph';
import { MODULE_CATEGORY_LABEL } from '@/lib/format';

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

let limitSeq = 0;

function initialState(plan: Plan, catalog: PlatformModule[]): Record<string, RowState> {
  return Object.fromEntries(
    catalog.map((m) => {
      const pm = plan.modules.find((x) => x.moduleCode === m.code);
      return [
        m.code,
        {
          // Un core siempre está ON, diga lo que diga el plan.
          enabled: m.requiredCore || !!pm?.enabled,
          limits: Object.entries(pm?.limits ?? {}).map(([key, value]) => ({
            id: ++limitSeq,
            key,
            value: value === null ? '' : String(value),
            unlimited: value === null,
          })),
        },
      ];
    }),
  );
}

function limitError(limit: LimitRow, siblings: LimitRow[]): string | null {
  if (!limitKeySchema.safeParse(limit.key).success) return 'Nombre inválido (camelCase)';
  if (siblings.some((l) => l.id !== limit.id && l.key === limit.key)) return 'Nombre repetido';
  if (!limit.unlimited && !/^\d+$/.test(limit.value)) return 'Entero ≥ 0 o "ilimitado"';
  return null;
}

function toPayload(state: Record<string, RowState>, catalog: PlatformModule[]): PlanModule[] {
  return catalog.map((m) => {
    const row = state[m.code];
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

export function PlanMatrix({ plan, catalog }: { plan: Plan; catalog: PlatformModule[] }) {
  const [initial] = useState(() => initialState(plan, catalog));
  const [state, setState] = useState(initial);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const setRow = (code: string, patch: (row: RowState) => RowState) =>
    setState((s) => ({ ...s, [code]: patch(s[code]) }));

  const payload = useMemo(() => toPayload(state, catalog), [state, catalog]);
  const dirty = JSON.stringify(payload) !== JSON.stringify(toPayload(initial, catalog));
  const invalid = catalog.some((m) =>
    state[m.code].limits.some((l) => limitError(l, state[m.code].limits)),
  );
  const missing = useMemo(
    () =>
      missingPlanDependencies(
        catalog,
        new Set(payload.filter((p) => p.enabled).map((p) => p.moduleCode)),
      ),
    [catalog, payload],
  );

  return (
    <div className="space-y-4">
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
            const row = state[m.code];
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
                    checked={m.requiredCore || row.enabled}
                    disabled={m.requiredCore}
                    title={m.requiredCore ? 'Core obligatorio: siempre ON' : undefined}
                    onChange={(e) => setRow(m.code, (r) => ({ ...r, enabled: e.target.checked }))}
                  />
                </TableCell>
                <TableCell className="align-top">
                  <LimitsEditor
                    moduleCode={m.code}
                    limits={row.limits}
                    disabled={!(m.requiredCore || row.enabled)}
                    onChange={(limits) => setRow(m.code, (r) => ({ ...r, limits }))}
                  />
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
        onOpenChange={setConfirmOpen}
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

function LimitsEditor({
  moduleCode,
  limits,
  disabled,
  onChange,
}: {
  moduleCode: string;
  limits: LimitRow[];
  disabled: boolean;
  onChange: (limits: LimitRow[]) => void;
}) {
  const update = (id: number, patch: Partial<LimitRow>) =>
    onChange(limits.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  return (
    <div className="space-y-2">
      {limits.length === 0 && <p className="text-xs text-muted-foreground">Sin límites</p>}
      {limits.map((l) => {
        const error = limitError(l, limits);
        return (
          <div key={l.id} className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                aria-label={`Nombre del límite de ${moduleCode}`}
                placeholder="monthlyMessages"
                className="h-8 w-40 font-mono text-xs"
                value={l.key}
                disabled={disabled}
                aria-invalid={!!error}
                onChange={(e) => update(l.id, { key: e.target.value.trim() })}
              />
              <Input
                aria-label={`Valor del límite ${l.key || 'nuevo'} de ${moduleCode}`}
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
                aria-label={`Quitar límite ${l.key || 'nuevo'} de ${moduleCode}`}
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
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 text-xs"
        disabled={disabled}
        aria-label={`Agregar límite a ${moduleCode}`}
        onClick={() =>
          onChange([...limits, { id: ++limitSeq, key: '', value: '', unlimited: false }])
        }
      >
        <Plus /> Límite
      </Button>
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
}: {
  plan: Plan;
  payload: PlanModule[];
  missing: ReturnType<typeof missingPlanDependencies>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const save = useUpdatePlanModules(plan.id);
  const form = useForm<z.infer<typeof reasonOnly>>({ resolver: zodResolver(reasonOnly) });
  useResetOnOpen(form, open, { reason: '' });
  const enabled = payload.filter((p) => p.enabled).length;

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Guardar matriz de ${plan.name}`}
      submitLabel="Guardar matriz"
      pending={save.isPending}
      description={
        <p>
          Afecta a todas las clínicas con el plan <code className="font-mono">{plan.code}</code>.
          Quedarán {enabled} de {payload.length} módulos incluidos.
        </p>
      }
      onSubmit={form.handleSubmit(({ reason }) =>
        save.mutate(
          { modules: payload, reason },
          {
            onSuccess: () => {
              toast.success('Matriz guardada');
              onOpenChange(false);
            },
          },
        ),
      )}
    >
      {missing.length > 0 && <MissingDependenciesAlert missing={missing} />}
      <ReasonField form={form} />
    </ActionDialog>
  );
}
