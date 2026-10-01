'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Loader2, Lock } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { ActionDialog, ReasonField, useResetOnOpen } from '@/components/shared/action-dialog';
import { ConflictBanner } from '@/components/shared/conflict-banner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import {
  useCreateModule,
  useModuleUsage,
  useUpdateModule,
} from '@/lib/api/hooks/use-catalog-admin';
import { useSpecialties } from '@/lib/api/hooks/use-catalogs';
import { errorMessage, fieldErrorsOf, isVersionConflict } from '@/lib/api/errors';
import {
  moduleCategorySchema,
  moduleCreateInputSchema,
  reasonSchema,
  type ModuleCreateInput,
  type ModuleUpdateInput,
  type PlatformModule,
} from '@/lib/api/schemas';
import { MODULE_CATEGORY_LABEL } from '@/lib/format';
import { applyFieldErrors } from '@/lib/forms';
import { useOptimisticVersion } from '@/lib/use-optimistic-version';
import { backendDependencyError, DependencyEditor, useDependencyIssue } from './dependency-editor';

const toValues = (m?: PlatformModule): ModuleCreateInput => ({
  code: m?.code ?? '',
  name: m?.name ?? '',
  description: m?.description ?? '',
  category: m?.category ?? 'COMMS',
  requiredCore: m?.requiredCore ?? false,
  active: m?.active ?? true,
  compatibleSpecialties: m?.compatibleSpecialties ?? [],
  dependsOn: m?.dependsOn ?? [],
});

const NEW_MODULE = { version: 0 };

/**
 * Crear o editar un módulo del catálogo. El `code` no se edita después de creado (D10).
 * En V1 un módulo no se borra: se desactiva, con motivo y viendo qué clínicas lo usan (D14).
 * Un core obligatorio no se puede desactivar ni dejar de ser core (D11).
 * `reload` recarga el catálogo y devuelve la versión actual del módulo editado (D16).
 */
export function ModuleForm({
  module: editing,
  catalog,
  reload,
}: {
  module?: PlatformModule;
  catalog: PlatformModule[];
  reload?: () => Promise<number | undefined>;
}) {
  const router = useRouter();
  const specialties = useSpecialties();
  const create = useCreateModule();
  const update = useUpdateModule(editing?.id ?? '');
  const mutation = editing ? update : create;
  const [pendingDeactivation, setPendingDeactivation] = useState<ModuleUpdateInput | null>(null);
  const lockedCore = !!editing?.requiredCore;

  const form = useForm<ModuleCreateInput>({
    resolver: zodResolver(moduleCreateInputSchema),
    defaultValues: toValues(editing),
  });
  const { errors, isDirty } = form.formState;
  const versioning = useOptimisticVersion<{ version: number } & Partial<PlatformModule>>(
    editing ?? NEW_MODULE,
    { isDirty, resetTo: (server) => form.reset(toValues(server as PlatformModule)) },
  );
  const code = form.watch('code');
  const dependsOn = form.watch('dependsOn');
  const compatible = form.watch('compatibleSpecialties');
  const requiredCore = form.watch('requiredCore');

  // Para validar ciclos, el módulo editado se reemplaza por su versión del formulario.
  const graph = catalog.filter((m) => m.code !== code);
  const issue = useDependencyIssue(graph, code, dependsOn);
  const backendDepError = backendDependencyError(mutation.error);
  const otherError =
    mutation.isError &&
    !backendDepError &&
    !isVersionConflict(mutation.error) &&
    fieldErrorsOf(mutation.error).length === 0;

  const onError = (e: unknown) => {
    if (isVersionConflict(e) && reload) void versioning.onConflict(reload);
    else applyFieldErrors(e, form.setError);
  };

  const runUpdate = (input: ModuleUpdateInput, onDone?: () => void) =>
    update.mutate(input, {
      onSuccess: (saved) => {
        toast.success('Módulo actualizado');
        onDone?.();
        versioning.onSaved(saved);
        router.push('/modulos');
      },
      onError: (e) => {
        onDone?.();
        onError(e);
      },
    });

  const setDependsOn = (next: string[]) => {
    mutation.reset(); // el error del backend ya no aplica a la nueva selección
    form.setValue('dependsOn', next, { shouldDirty: true });
  };

  const onSubmit = form.handleSubmit((values) => {
    if (issue) return;
    const { code: _code, ...fields } = {
      ...values,
      description: values.description || undefined,
      // Un core siempre está activo.
      active: values.requiredCore ? true : values.active,
    };
    if (editing) {
      const input: ModuleUpdateInput = { ...fields, version: versioning.baseVersion };
      // Desactivar un módulo comercial: primero ver impacto y pedir motivo (D14).
      if (editing.active && !input.active) setPendingDeactivation(input);
      else runUpdate(input);
    } else {
      create.mutate(
        { ...fields, code: values.code },
        {
          onSuccess: (saved) => {
            toast.success(`Módulo ${saved.code} creado`);
            router.push('/modulos');
          },
          onError,
        },
      );
    }
  });

  return (
    <>
      <form noValidate onSubmit={onSubmit} className="max-w-3xl space-y-6">
        {versioning.conflict && (
          <ConflictBanner
            onDiscard={() => {
              update.reset();
              versioning.discard();
            }}
          />
        )}
        {otherError && (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertDescription>{errorMessage(mutation.error)}</AlertDescription>
          </Alert>
        )}
        <Card>
          <CardHeader>
            <CardTitle>Datos</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="code"
              label="Código"
              error={errors.code?.message}
              hint={editing ? 'El código no se puede cambiar después de creado.' : 'Ej.: COMMS_SMS'}
            >
              {(aria) => (
                <Input
                  {...aria}
                  className="font-mono uppercase read-only:bg-muted read-only:text-muted-foreground"
                  // readOnly y no disabled: RHF manda undefined para campos disabled.
                  readOnly={!!editing}
                  {...form.register('code', {
                    setValueAs: (v: string) => v.trim().toUpperCase(),
                  })}
                />
              )}
            </FormField>
            <FormField id="name" label="Nombre" error={errors.name?.message}>
              {(aria) => <Input {...aria} {...form.register('name')} />}
            </FormField>
            <div className="sm:col-span-2">
              <FormField
                id="description"
                label="Descripción (opcional)"
                error={errors.description?.message}
              >
                {(aria) => <Textarea {...aria} rows={2} {...form.register('description')} />}
              </FormField>
            </div>
            <FormField id="category" label="Categoría" error={errors.category?.message}>
              {(aria) => (
                <NativeSelect {...aria} {...form.register('category')}>
                  {moduleCategorySchema.options.map((c) => (
                    <option key={c} value={c}>
                      {MODULE_CATEGORY_LABEL[c]}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
            <div className="space-y-2 self-end pb-1 text-sm">
              <label className="flex items-center gap-2">
                {lockedCore ? (
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked
                    disabled
                    readOnly
                  />
                ) : (
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    {...form.register('requiredCore')}
                  />
                )}
                Core obligatorio (siempre ON en todos los planes)
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  disabled={requiredCore}
                  checked={requiredCore || form.watch('active')}
                  onChange={(e) => form.setValue('active', e.target.checked, { shouldDirty: true })}
                />
                Activo
              </label>
              {lockedCore && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Lock className="size-3" /> Core obligatorio: no se puede desactivar.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Compatibilidad y dependencias</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Especialidades compatibles</legend>
              <p className="text-xs text-muted-foreground">
                Ninguna marcada = compatible con todas.
              </p>
              <div className="flex flex-wrap gap-4">
                {specialties.data?.map((s) => (
                  <label key={s.code} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={compatible.includes(s.code)}
                      onChange={(e) =>
                        form.setValue(
                          'compatibleSpecialties',
                          e.target.checked
                            ? [...compatible, s.code]
                            : compatible.filter((c) => c !== s.code),
                          { shouldDirty: true },
                        )
                      }
                    />
                    {s.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <DependencyEditor
              catalog={catalog}
              code={code}
              value={dependsOn}
              onChange={setDependsOn}
              issue={issue}
              backendError={backendDepError}
            />
          </CardContent>
        </Card>

        {editing && (
          <Card>
            <CardHeader>
              <CardTitle>Límites por plan</CardTitle>
            </CardHeader>
            <CardContent>
              {editing.allowedLimits.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Este módulo no admite límites por plan.
                </p>
              ) : (
                <ul className="space-y-1 text-sm" aria-label="Límites permitidos">
                  {editing.allowedLimits.map((l) => (
                    <li key={l.key}>
                      {l.label} <span className="text-muted-foreground">({l.unit})</span> ·{' '}
                      <code className="font-mono text-xs">{l.key}</code>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Los define el backend; se asignan valores en la matriz de cada plan.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={mutation.isPending || !!issue}>
            {mutation.isPending && <Loader2 className="animate-spin" />}
            {editing ? 'Guardar módulo' : 'Crear módulo'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push('/modulos')}>
            Cancelar
          </Button>
        </div>
      </form>
      {editing && (
        <DeactivateModuleDialog
          target={editing}
          open={pendingDeactivation !== null}
          pending={update.isPending}
          onOpenChange={(open) => !open && setPendingDeactivation(null)}
          onConfirm={(reason) =>
            pendingDeactivation &&
            runUpdate({ ...pendingDeactivation, reason }, () => setPendingDeactivation(null))
          }
        />
      )}
    </>
  );
}

const reasonOnly = z.object({ reason: reasonSchema });

/** D14: antes de desactivar, cuántas clínicas lo tienen ON hoy (primeras 10) + motivo. */
function DeactivateModuleDialog({
  target,
  open,
  pending,
  onOpenChange,
  onConfirm,
}: {
  target: PlatformModule;
  open: boolean;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
}) {
  const usage = useModuleUsage(target.id, open);
  const form = useForm<z.infer<typeof reasonOnly>>({ resolver: zodResolver(reasonOnly) });
  useResetOnOpen(form, open, { reason: '' });
  const data = usage.data;

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Desactivar módulo"
      destructive
      submitLabel="Desactivar módulo"
      pending={pending}
      submitDisabled={!data}
      description={
        <p>
          <code className="font-mono">{target.code}</code> quedará OFF en todas las clínicas
          (motivo: módulo desactivado en el catálogo). Se puede volver a activar.
        </p>
      }
      onSubmit={form.handleSubmit(({ reason }) => onConfirm(reason))}
    >
      {usage.isError ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertDescription>
            No se pudo consultar el uso actual: {errorMessage(usage.error)}
          </AlertDescription>
        </Alert>
      ) : !data ? (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Consultando clínicas que lo usan…
        </p>
      ) : (
        <section aria-label="Uso actual" className="space-y-2 rounded-md border p-3 text-sm">
          <p className="font-medium" data-testid="usage-count">
            {data.clinicCount === 0
              ? 'Ninguna clínica lo tiene ON hoy.'
              : `${data.clinicCount} ${data.clinicCount === 1 ? 'clínica lo tiene' : 'clínicas lo tienen'} ON hoy.`}
          </p>
          {data.clinics.length > 0 && (
            <ul className="space-y-1" aria-label="Clínicas afectadas">
              {data.clinics.map((c) => (
                <li key={c.clinicId}>
                  <Link
                    href={`/clinicas/${c.clinicId}`}
                    target="_blank"
                    className="hover:underline"
                  >
                    {c.name}
                  </Link>{' '}
                  <code className="font-mono text-xs text-muted-foreground">{c.slug}</code>
                </li>
              ))}
            </ul>
          )}
          {data.clinicCount > data.clinics.length && (
            <p className="text-xs text-muted-foreground">
              …y {data.clinicCount - data.clinics.length} más.
            </p>
          )}
        </section>
      )}
      <ReasonField form={form} />
    </ActionDialog>
  );
}
