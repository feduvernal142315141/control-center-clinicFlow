'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { ActionDialog, ReasonField, useResetOnOpen } from '@/components/shared/action-dialog';
import { ConflictBanner } from '@/components/shared/conflict-banner';
import { EmptyState } from '@/components/states/empty-state';
import { ErrorState } from '@/components/states/error-state';
import { LoadingState } from '@/components/states/loading-state';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
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
import { useModules } from '@/lib/api/hooks/use-catalog-admin';
import { useCatalogNames } from '@/lib/api/hooks/use-catalogs';
import {
  useEffectiveModules,
  useModuleOverrides,
  useUpdateModuleOverrides,
} from '@/lib/api/hooks/use-clinics';
import { errorMessage, fieldErrorsOf, isVersionConflict } from '@/lib/api/errors';
import {
  reasonSchema,
  type ClinicDetail,
  type EffectiveModule,
  type ModuleOverride,
  type ModuleOverrideInput,
  type PlatformModule,
} from '@/lib/api/schemas';
import { toDateInput } from '@/lib/dates';
import { deniedReasonText, EFFECTIVE_SOURCE_LABEL, formatDate, formatDateTime } from '@/lib/format';
import { applyFieldErrors } from '@/lib/forms';

const isExpired = (o: ModuleOverride, now = Date.now()) =>
  o.expiresAt !== null && new Date(o.expiresAt).getTime() <= now;

const toInput = (o: ModuleOverride): ModuleOverrideInput => ({
  moduleCode: o.moduleCode,
  enabled: o.enabled,
  reason: o.reason,
  expiresAt: o.expiresAt,
});

/**
 * ¿El override tiene efecto hoy? Se lee de los módulos efectivos que calcula el backend;
 * aquí no se recalcula nada (D18).
 */
function overrideEffect(o: ModuleOverride, eff: EffectiveModule | undefined) {
  if (!eff) return { active: false, text: 'Sin datos de módulos efectivos' };
  const applies = o.enabled
    ? eff.enabled && eff.source === 'OVERRIDE'
    : !eff.enabled && eff.deniedReason === 'OVERRIDE_OFF';
  if (applies) return { active: true, text: 'Con efecto' };
  const now = eff.enabled
    ? `hoy ON (${eff.source ? EFFECTIVE_SOURCE_LABEL[eff.source] : '—'})`
    : (deniedReasonText(eff) ?? 'OFF');
  return { active: false, text: `Sin efecto: ${now}` };
}

type Dialog =
  { kind: 'edit'; override?: ModuleOverride } | { kind: 'remove'; override: ModuleOverride } | null;

/** Tab Overrides de la clínica: lista, crear/editar y quitar (D18). */
export function ClinicOverridesTab({ clinic }: { clinic: ClinicDetail }) {
  const overrides = useModuleOverrides(clinic.id);
  const effective = useEffectiveModules(clinic.id);
  const modules = useModules();
  const [dialog, setDialog] = useState<Dialog>(null);

  const error = overrides.error ?? modules.error;
  if (error) {
    return (
      <ErrorState
        error={error}
        onRetry={() => {
          void overrides.refetch();
          void modules.refetch();
        }}
      />
    );
  }
  if (!overrides.data || !modules.data)
    return <LoadingState rows={4} label="Cargando overrides…" />;

  const list = overrides.data.overrides;
  const active = list.filter((o) => !isExpired(o));
  const expired = list.filter((o) => isExpired(o));
  const byCode = new Map(modules.data.map((m) => [m.code, m]));
  const effByCode = new Map(effective.data?.map((m) => [m.code, m]));
  const reload = async () => {
    const [fresh] = await Promise.all([overrides.refetch(), effective.refetch()]);
    return fresh.data?.version;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Excepciones por clínica. Cada cambio pide motivo y queda auditado.
        </p>
        <Button onClick={() => setDialog({ kind: 'edit' })}>
          <Plus /> Nuevo override
        </Button>
      </div>

      {active.length === 0 ? (
        <EmptyState title="Esta clínica no tiene overrides vigentes" />
      ) : (
        <OverridesTable
          caption="Overrides vigentes"
          rows={active}
          byCode={byCode}
          effect={(o) => overrideEffect(o, effByCode.get(o.moduleCode))}
          effectLoading={!effective.data}
          onEdit={(o) => setDialog({ kind: 'edit', override: o })}
          onRemove={(o) => setDialog({ kind: 'remove', override: o })}
        />
      )}

      {expired.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-medium">Vencidos (sin efecto)</h3>
          <OverridesTable
            caption="Overrides vencidos"
            rows={expired}
            byCode={byCode}
            effect={() => ({ active: false, text: 'Vencido: sin efecto' })}
            effectLoading={false}
            expired
            onEdit={(o) => setDialog({ kind: 'edit', override: o })}
            onRemove={(o) => setDialog({ kind: 'remove', override: o })}
          />
        </section>
      )}

      <OverrideDialog
        open={dialog?.kind === 'edit'}
        editing={dialog?.kind === 'edit' ? dialog.override : undefined}
        onOpenChange={(open) => !open && setDialog(null)}
        clinic={clinic}
        catalog={modules.data}
        current={list}
        version={overrides.data.version}
        effective={effective.data}
        reload={reload}
      />
      <RemoveOverrideDialog
        open={dialog?.kind === 'remove'}
        target={dialog?.kind === 'remove' ? dialog.override : undefined}
        onOpenChange={(open) => !open && setDialog(null)}
        clinicId={clinic.id}
        current={list}
        version={overrides.data.version}
        reload={reload}
      />
    </div>
  );
}

function OverridesTable({
  caption,
  rows,
  byCode,
  effect,
  effectLoading,
  expired,
  onEdit,
  onRemove,
}: {
  caption: string;
  rows: ModuleOverride[];
  byCode: Map<string, PlatformModule>;
  effect: (o: ModuleOverride) => { active: boolean; text: string };
  effectLoading: boolean;
  expired?: boolean;
  onEdit: (o: ModuleOverride) => void;
  onRemove: (o: ModuleOverride) => void;
}) {
  return (
    <Table>
      <caption className="sr-only">{caption}</caption>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Módulo</TableHead>
          <TableHead>Override</TableHead>
          <TableHead>Motivo</TableHead>
          <TableHead>Creado</TableHead>
          <TableHead>Vence</TableHead>
          <TableHead>Efecto hoy</TableHead>
          <TableHead className="sr-only">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((o) => {
          const e = effect(o);
          return (
            <TableRow key={o.moduleCode} data-testid={`override-${o.moduleCode}`}>
              <TableCell>
                <p className="font-medium">{byCode.get(o.moduleCode)?.name ?? o.moduleCode}</p>
                <code className="font-mono text-xs text-muted-foreground">{o.moduleCode}</code>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  <Badge variant={o.enabled ? 'success' : 'destructive'}>
                    {o.enabled ? 'ON' : 'OFF'}
                  </Badge>
                  {expired && <Badge variant="outline">Vencido</Badge>}
                </div>
              </TableCell>
              <TableCell className="max-w-64 text-sm">{o.reason}</TableCell>
              <TableCell className="text-sm">
                <p>{o.createdBy}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(o.createdAt)}</p>
              </TableCell>
              <TableCell className="text-sm">
                {o.expiresAt ? formatDate(o.expiresAt) : 'Sin vencimiento'}
              </TableCell>
              <TableCell className="text-sm" data-testid={`effect-${o.moduleCode}`}>
                {effectLoading ? (
                  <span className="text-muted-foreground">…</span>
                ) : (
                  <span className={e.active ? 'text-success' : 'text-muted-foreground'}>
                    {e.text}
                  </span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Editar override de ${o.moduleCode}`}
                    onClick={() => onEdit(o)}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Quitar override de ${o.moduleCode}`}
                    onClick={() => onRemove(o)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

// ---------------------------------------------------------------------------
// Crear / editar
// ---------------------------------------------------------------------------

const todayInput = () => toDateInput(new Date().toISOString());

const overrideFormSchema = z.object({
  moduleCode: z.string().min(1, 'Selecciona un módulo'),
  enabled: z.enum(['ON', 'OFF']),
  reason: reasonSchema,
  expiresOn: z
    .string()
    .refine((v) => v === '' || v >= todayInput(), 'El vencimiento debe ser una fecha futura'),
});
type OverrideFormValues = z.infer<typeof overrideFormSchema>;

/** El override vence al final del día elegido, en la zona del navegador. */
const expiresAtFromInput = (value: string) =>
  value ? new Date(`${value}T23:59:59`).toISOString() : null;

function useSaveOverrides(
  clinicId: string,
  version: number,
  open: boolean,
  reload: () => Promise<number | undefined>,
) {
  const save = useUpdateModuleOverrides(clinicId);
  const [base, setBase] = useState(version);
  const [conflict, setConflict] = useState(false);
  useEffect(() => {
    if (open) {
      setBase(version);
      setConflict(false);
      save.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir
  }, [open]);
  return {
    save,
    base,
    conflict,
    clearConflict: () => setConflict(false),
    onConflict: () => {
      setConflict(true);
      void reload().then((v) => v !== undefined && setBase(v));
    },
  };
}

function OverrideDialog({
  open,
  editing,
  onOpenChange,
  clinic,
  catalog,
  current,
  version,
  effective,
  reload,
}: {
  open: boolean;
  editing?: ModuleOverride;
  onOpenChange: (open: boolean) => void;
  clinic: ClinicDetail;
  catalog: PlatformModule[];
  current: ModuleOverride[];
  version: number;
  effective: EffectiveModule[] | undefined;
  reload: () => Promise<number | undefined>;
}) {
  const { specialtyName } = useCatalogNames();
  const { save, base, conflict, clearConflict, onConflict } = useSaveOverrides(
    clinic.id,
    version,
    open,
    reload,
  );
  const form = useForm<OverrideFormValues>({ resolver: zodResolver(overrideFormSchema) });
  const initial = (): OverrideFormValues => ({
    moduleCode: editing?.moduleCode ?? '',
    enabled: editing ? (editing.enabled ? 'ON' : 'OFF') : 'ON',
    reason: '',
    expiresOn: editing?.expiresAt && !isExpired(editing) ? toDateInput(editing.expiresAt) : '',
  });
  useResetOnOpen(form, open, initial());

  const enabled = form.watch('enabled') === 'ON';
  const moduleCode = form.watch('moduleCode');
  const selected = catalog.find((m) => m.code === moduleCode);

  // Un módulo con override se edita, no se duplica. Un core no se ofrece para OFF.
  const options = catalog.filter(
    (m) =>
      (m.code === editing?.moduleCode || !current.some((o) => o.moduleCode === m.code)) &&
      (enabled || !m.requiredCore),
  );

  useEffect(() => {
    if (moduleCode && !options.some((m) => m.code === moduleCode)) form.setValue('moduleCode', '');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reacciona al cambio ON/OFF
  }, [enabled]);

  // Advertencias para override ON: el backend lo va a negar (no se bloquea).
  const warnings = useMemo(() => {
    if (!enabled || !selected) return [];
    const list: string[] = [];
    const effByCode = new Map(effective?.map((m) => [m.code, m]));
    if (
      selected.compatibleSpecialties.length > 0 &&
      !selected.compatibleSpecialties.includes(clinic.specialtyCode)
    ) {
      list.push(
        `No es compatible con la especialidad de la clínica (${specialtyName(clinic.specialtyCode)}).`,
      );
    }
    const missing = selected.dependsOn.filter((d) => effByCode.get(d)?.enabled === false);
    if (missing.length > 0) {
      list.push(`Faltan dependencias que hoy están OFF en la clínica: ${missing.join(', ')}.`);
    }
    if (!selected.active) list.push('El módulo está desactivado en el catálogo.');
    return list;
  }, [enabled, selected, effective, clinic.specialtyCode, specialtyName]);

  const otherError =
    save.isError && !isVersionConflict(save.error) && fieldErrorsOf(save.error).length === 0;

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? `Editar override de ${editing.moduleCode}` : 'Nuevo override'}
      submitLabel="Guardar override"
      pending={save.isPending}
      description={<p>Prende o apaga un módulo solo para {clinic.name}.</p>}
      onSubmit={form.handleSubmit((values) => {
        const next: ModuleOverrideInput = {
          moduleCode: values.moduleCode,
          enabled: values.enabled === 'ON',
          reason: values.reason,
          expiresAt: expiresAtFromInput(values.expiresOn),
        };
        const overrides = [
          ...current.filter((o) => o.moduleCode !== values.moduleCode).map(toInput),
          next,
        ];
        save.mutate(
          { overrides, reason: values.reason, version: base },
          {
            onSuccess: () => {
              toast.success(`Override de ${values.moduleCode} guardado`);
              onOpenChange(false);
            },
            onError: (e) =>
              isVersionConflict(e) ? onConflict() : applyFieldErrors(e, form.setError),
          },
        );
      })}
    >
      {conflict && (
        <ConflictBanner
          onDiscard={() => {
            form.reset(initial());
            clearConflict();
          }}
        />
      )}
      {otherError && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertDescription>{errorMessage(save.error)}</AlertDescription>
        </Alert>
      )}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Estado forzado</legend>
        <div className="flex gap-4 text-sm">
          {(['ON', 'OFF'] as const).map((v) => (
            <label key={v} className="flex items-center gap-2">
              <input
                type="radio"
                value={v}
                className="size-4 accent-primary"
                {...form.register('enabled')}
              />
              {v}
            </label>
          ))}
        </div>
      </fieldset>
      <FormField
        id="moduleCode"
        label="Módulo"
        error={form.formState.errors.moduleCode?.message}
        hint={!enabled ? 'Los módulos core obligatorios no se pueden apagar.' : undefined}
      >
        {(aria) =>
          editing ? (
            // Fijo al editar (sin `disabled` en un campo registrado: RHF mandaría undefined).
            <Input
              {...aria}
              readOnly
              value={`${selected?.name ?? editing.moduleCode} (${editing.moduleCode})`}
            />
          ) : (
            <NativeSelect {...aria} {...form.register('moduleCode')}>
              <option value="">Selecciona…</option>
              {options.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.name} ({m.code})
                </option>
              ))}
            </NativeSelect>
          )
        }
      </FormField>
      {warnings.length > 0 && (
        <Alert data-testid="override-warnings">
          <AlertTriangle className="text-warning" />
          <AlertTitle>El backend lo va a negar</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
            <p>Puedes guardarlo igual: quedará registrado, pero el módulo seguirá OFF.</p>
          </AlertDescription>
        </Alert>
      )}
      <FormField
        id="expiresOn"
        label="Vence (opcional)"
        error={form.formState.errors.expiresOn?.message}
        hint="Sin fecha = sin vencimiento. Vence al final del día elegido."
      >
        {(aria) => (
          <Input {...aria} type="date" min={todayInput()} {...form.register('expiresOn')} />
        )}
      </FormField>
      <ReasonField form={form} />
    </ActionDialog>
  );
}

// ---------------------------------------------------------------------------
// Quitar
// ---------------------------------------------------------------------------

const reasonOnly = z.object({ reason: reasonSchema });

function RemoveOverrideDialog({
  open,
  target,
  onOpenChange,
  clinicId,
  current,
  version,
  reload,
}: {
  open: boolean;
  target?: ModuleOverride;
  onOpenChange: (open: boolean) => void;
  clinicId: string;
  current: ModuleOverride[];
  version: number;
  reload: () => Promise<number | undefined>;
}) {
  const { save, base, conflict, clearConflict, onConflict } = useSaveOverrides(
    clinicId,
    version,
    open,
    reload,
  );
  const form = useForm<z.infer<typeof reasonOnly>>({ resolver: zodResolver(reasonOnly) });
  useResetOnOpen(form, open, { reason: '' });
  const otherError = save.isError && !isVersionConflict(save.error);

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Quitar override"
      destructive
      submitLabel="Quitar override"
      pending={save.isPending}
      description={
        <p>
          <code className="font-mono">{target?.moduleCode}</code> volverá a depender del plan y de
          las reglas normales.
        </p>
      }
      onSubmit={form.handleSubmit(({ reason }) =>
        target
          ? save.mutate(
              {
                overrides: current.filter((o) => o.moduleCode !== target.moduleCode).map(toInput),
                reason,
                version: base,
              },
              {
                onSuccess: () => {
                  toast.success(`Override de ${target.moduleCode} quitado`);
                  onOpenChange(false);
                },
                onError: (e) => (isVersionConflict(e) ? onConflict() : undefined),
              },
            )
          : undefined,
      )}
    >
      {conflict && (
        <ConflictBanner
          onDiscard={() => {
            form.reset({ reason: '' });
            clearConflict();
          }}
        />
      )}
      {otherError && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertDescription>{errorMessage(save.error)}</AlertDescription>
        </Alert>
      )}
      <ReasonField form={form} />
    </ActionDialog>
  );
}
