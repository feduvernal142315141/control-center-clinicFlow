'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useCreatePlan, useUpdatePlan } from '@/lib/api/hooks/use-catalog-admin';
import { errorMessage, fieldErrorsOf, isVersionConflict } from '@/lib/api/errors';
import {
  planCreateInputSchema,
  type Plan,
  type PlanCreateInput,
  type PlanUpdateInput,
} from '@/lib/api/schemas';
import { applyFieldErrors } from '@/lib/forms';
import { useOptimisticVersion } from '@/lib/use-optimistic-version';
import { ConflictBanner } from '@/components/shared/conflict-banner';

function GlobalError({ error }: { error: unknown }) {
  if (!error || fieldErrorsOf(error).length > 0 || isVersionConflict(error)) return null;
  return (
    <Alert variant="destructive">
      <AlertTriangle />
      <AlertDescription>{errorMessage(error)}</AlertDescription>
    </Alert>
  );
}

const toValues = (plan?: Plan): PlanCreateInput => ({
  code: plan?.code ?? '',
  name: plan?.name ?? '',
  description: plan?.description ?? '',
  active: plan?.active ?? true,
  sortOrder: plan?.sortOrder ?? 50,
});

const NEW_PLAN = { version: 0 };

/**
 * Crear: incluye `code`. Editar: el `code` se muestra, pero no se puede cambiar, y se
 * guarda con `version` (D16). `reload` recarga el plan y devuelve su versión actual.
 */
export function PlanForm({
  plan,
  reload,
}: {
  plan?: Plan;
  reload?: () => Promise<number | undefined>;
}) {
  const router = useRouter();
  const create = useCreatePlan();
  const update = useUpdatePlan(plan?.id ?? '');
  const mutation = plan ? update : create;

  const form = useForm<PlanCreateInput>({
    // Al editar, `code` lleva el valor actual (válido) y no se envía al backend.
    resolver: zodResolver(planCreateInputSchema),
    defaultValues: toValues(plan),
  });
  const { errors, isDirty } = form.formState;
  const versioning = useOptimisticVersion<{ version: number } & Partial<Plan>>(plan ?? NEW_PLAN, {
    isDirty,
    resetTo: (server) => form.reset(toValues(server as Plan)),
  });

  const onSubmit = form.handleSubmit((values) => {
    const fields = {
      name: values.name,
      description: values.description || undefined,
      active: values.active,
      sortOrder: values.sortOrder,
    };
    const onError = (e: unknown) => {
      if (isVersionConflict(e) && reload) void versioning.onConflict(reload);
      else applyFieldErrors(e, form.setError);
    };
    if (plan) {
      const input: PlanUpdateInput = { ...fields, version: versioning.baseVersion };
      update.mutate(input, {
        onSuccess: (saved) => {
          toast.success('Plan actualizado');
          versioning.onSaved(saved);
        },
        onError,
      });
    } else {
      create.mutate(
        { ...fields, code: values.code },
        {
          onSuccess: (saved) => {
            toast.success(`Plan ${saved.code} creado`);
            router.push(`/planes/${saved.id}`);
          },
          onError,
        },
      );
    }
  });

  return (
    <form noValidate onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2">
        {versioning.conflict && (
          <ConflictBanner
            onDiscard={() => {
              update.reset();
              versioning.discard();
            }}
          />
        )}
        <GlobalError error={mutation.error} />
      </div>
      <FormField
        id="code"
        label="Código"
        error={errors.code?.message}
        hint={plan ? 'El código no se puede cambiar después de creado.' : 'Ej.: PRO_ANUAL'}
      >
        {(aria) =>
          plan ? (
            <Input {...aria} value={plan.code} readOnly disabled className="font-mono" />
          ) : (
            <Input {...aria} className="font-mono uppercase" {...form.register('code')} />
          )
        }
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
      <FormField id="sortOrder" label="Orden" error={errors.sortOrder?.message}>
        {(aria) => (
          <Input
            {...aria}
            type="number"
            step={1}
            {...form.register('sortOrder', { valueAsNumber: true })}
          />
        )}
      </FormField>
      <label className="flex items-center gap-2 self-end pb-2 text-sm">
        <input type="checkbox" className="size-4 accent-primary" {...form.register('active')} />
        Activo (se puede asignar a clínicas)
      </label>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={mutation.isPending || (!!plan && !isDirty)}>
          {mutation.isPending && <Loader2 className="animate-spin" />}
          {plan ? 'Guardar datos del plan' : 'Crear plan'}
        </Button>
      </div>
    </form>
  );
}
