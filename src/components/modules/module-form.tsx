'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Loader2, Lock, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { ActionDialog, ReasonField, useResetOnOpen } from '@/components/shared/action-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import {
  useCreateModule,
  useDeleteModule,
  useUpdateModule,
} from '@/lib/api/hooks/use-catalog-admin';
import { useSpecialties } from '@/lib/api/hooks/use-catalogs';
import { errorMessage, fieldErrorsOf } from '@/lib/api/errors';
import {
  moduleCategorySchema,
  moduleCreateInputSchema,
  reasonSchema,
  type ModuleCreateInput,
  type PlatformModule,
} from '@/lib/api/schemas';
import { MODULE_CATEGORY_LABEL } from '@/lib/format';
import { applyFieldErrors } from '@/lib/forms';
import { backendDependencyError, DependencyEditor, useDependencyIssue } from './dependency-editor';

/**
 * Crear o editar un módulo del catálogo. El `code` no se edita después de creado.
 * Un core obligatorio no se puede desactivar, dejar de ser core ni borrar.
 */
export function ModuleForm({
  module: editing,
  catalog,
}: {
  module?: PlatformModule;
  catalog: PlatformModule[];
}) {
  const router = useRouter();
  const specialties = useSpecialties();
  const create = useCreateModule();
  const update = useUpdateModule(editing?.id ?? '');
  const mutation = editing ? update : create;
  const [deleteOpen, setDeleteOpen] = useState(false);
  const lockedCore = !!editing?.requiredCore;

  const form = useForm<ModuleCreateInput>({
    resolver: zodResolver(moduleCreateInputSchema),
    defaultValues: {
      code: editing?.code ?? '',
      name: editing?.name ?? '',
      description: editing?.description ?? '',
      category: editing?.category ?? 'COMMS',
      requiredCore: editing?.requiredCore ?? false,
      active: editing?.active ?? true,
      compatibleSpecialties: editing?.compatibleSpecialties ?? [],
      dependsOn: editing?.dependsOn ?? [],
    },
  });
  const { errors } = form.formState;
  const code = form.watch('code');
  const dependsOn = form.watch('dependsOn');
  const compatible = form.watch('compatibleSpecialties');
  const requiredCore = form.watch('requiredCore');

  // Para validar ciclos, el módulo editado se reemplaza por su versión del formulario.
  const graph = catalog.filter((m) => m.code !== code);
  const issue = useDependencyIssue(graph, code, dependsOn);
  const backendDepError = backendDependencyError(mutation.error);
  const otherError =
    mutation.isError && !backendDepError && fieldErrorsOf(mutation.error).length === 0;

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
    const onError = (e: unknown) => applyFieldErrors(e, form.setError);
    if (editing) {
      update.mutate(fields, {
        onSuccess: () => {
          toast.success('Módulo actualizado');
          router.push('/modulos');
        },
        onError,
      });
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
                  <Lock className="size-3" /> Core obligatorio: no se puede desactivar ni borrar.
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

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={mutation.isPending || !!issue}>
            {mutation.isPending && <Loader2 className="animate-spin" />}
            {editing ? 'Guardar módulo' : 'Crear módulo'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push('/modulos')}>
            Cancelar
          </Button>
          {editing && !lockedCore && (
            <Button
              type="button"
              variant="destructive"
              className="ml-auto"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 /> Borrar módulo
            </Button>
          )}
        </div>
      </form>
      {editing && !lockedCore && (
        <DeleteModuleDialog target={editing} open={deleteOpen} onOpenChange={setDeleteOpen} />
      )}
    </>
  );
}

const reasonOnly = z.object({ reason: reasonSchema });

function DeleteModuleDialog({
  target,
  open,
  onOpenChange,
}: {
  target: PlatformModule;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const remove = useDeleteModule(target.id);
  const form = useForm<z.infer<typeof reasonOnly>>({ resolver: zodResolver(reasonOnly) });
  useResetOnOpen(form, open, { reason: '' });

  return (
    <ActionDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) remove.reset();
        onOpenChange(o);
      }}
      title="Borrar módulo"
      destructive
      submitLabel="Borrar módulo"
      pending={remove.isPending}
      description={
        <p>
          Se borra <code className="font-mono">{target.code}</code> del catálogo y de todos los
          planes. No se puede deshacer; si solo quieres apagarlo, desactívalo.
        </p>
      }
      onSubmit={form.handleSubmit((values) =>
        remove.mutate(values, {
          onSuccess: () => {
            toast.success(`Módulo ${target.code} borrado`);
            onOpenChange(false);
            router.push('/modulos');
          },
          onError: (e) => applyFieldErrors(e, form.setError),
        }),
      )}
    >
      {remove.isError && fieldErrorsOf(remove.error).length === 0 && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertDescription>{errorMessage(remove.error)}</AlertDescription>
        </Alert>
      )}
      <ReasonField form={form} />
    </ActionDialog>
  );
}
