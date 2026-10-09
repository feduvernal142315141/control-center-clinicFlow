'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Users } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { ActionDialog, ReasonField, useResetOnOpen } from '@/components/shared/action-dialog';
import { ConflictBanner } from '@/components/shared/conflict-banner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { errorMessage, isVersionConflict } from '@/lib/api/errors';
import { useClinicUserQuota, useUpdateClinicUserQuota } from '@/lib/api/hooks/use-clinics';
import { reasonSchema, type ClinicUserQuota } from '@/lib/api/schemas';
import { applyFieldErrors } from '@/lib/forms';
import { useOptimisticVersion } from '@/lib/use-optimistic-version';
import { ErrorState } from '../states/error-state';
import { LoadingState } from '../states/loading-state';

const formSchema = z.object({
  usersToAdd: z.number().int('Debe ser un número entero').positive('Debe agregar al menos un cupo'),
  reason: reasonSchema,
});
type FormValues = z.infer<typeof formSchema>;

const limitLabel = (value: number | null) => (value === null ? 'Ilimitado' : String(value));

function QuotaField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold">{value}</dd>
    </div>
  );
}

export function ClinicUserQuotaCard({ clinicId }: { clinicId: string }) {
  const quota = useClinicUserQuota(clinicId);

  if (quota.isError) return <ErrorState error={quota.error} onRetry={() => quota.refetch()} />;
  if (!quota.data) return <LoadingState rows={3} label="Cargando cupos de usuarios…" />;

  return (
    <QuotaCardContent
      data={quota.data}
      reload={async () => (await quota.refetch()).data?.version}
    />
  );
}

function QuotaCardContent({
  data,
  reload,
}: {
  data: ClinicUserQuota;
  reload: () => Promise<number | undefined>;
}) {
  const update = useUpdateClinicUserQuota(data.clinicId);
  const [open, setOpen] = useState(false);
  const form = useForm<FormValues>({ resolver: zodResolver(formSchema) });
  const versioning = useOptimisticVersion(data, {
    isDirty: form.formState.isDirty,
    resetTo: () => form.reset({ usersToAdd: 1, reason: '' }),
  });
  useResetOnOpen(form, open, { usersToAdd: 1, reason: '' });
  const usersToAdd = form.watch('usersToAdd');
  const validUsersToAdd = Number.isSafeInteger(usersToAdd) && usersToAdd > 0 ? usersToAdd : 0;
  const resultingAdditionalUsers = data.additionalUsers + validUsersToAdd;
  const resultingEffectiveLimit =
    data.planLimit === null ? null : data.planLimit + resultingAdditionalUsers;
  const snapshotLabel = data.planName
    ? `Cupos del snapshot del plan ${data.planName}.`
    : 'Cupos del snapshot sin plan asignado.';

  const changeOpen = (next: boolean) => {
    if (!next) versioning.discard();
    setOpen(next);
  };

  return (
    <>
      <Card className="lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Users className="size-5" /> Usuarios de la clínica
            </CardTitle>
            <p className="text-sm text-muted-foreground">{snapshotLabel}</p>
          </div>
          <Button variant="outline" disabled={!data.subscriptionId} onClick={() => setOpen(true)}>
            Ajustar cupos
          </Button>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <QuotaField label="Límite del plan" value={limitLabel(data.planLimit)} />
            <QuotaField label="Cupos adicionales" value={data.additionalUsers} />
            <QuotaField label="Límite efectivo" value={limitLabel(data.effectiveLimit)} />
            <QuotaField label="Usuarios utilizados" value={data.usedUsers} />
            <QuotaField label="Disponibles" value={limitLabel(data.availableUsers)} />
          </dl>
          <div className="mt-4">
            <Badge variant={data.canAddUser ? 'secondary' : 'destructive'}>
              {data.canAddUser ? 'Puede agregar usuarios' : 'Límite alcanzado'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <ActionDialog
        open={open}
        onOpenChange={changeOpen}
        title="Agregar cupos adicionales"
        description={
          <p>
            La cantidad ingresada se sumará a los {data.additionalUsers} cupos adicionales que ya
            tiene {data.planName ?? 'la clínica'}.
          </p>
        }
        submitLabel="Agregar cupos"
        pending={update.isPending}
        onSubmit={form.handleSubmit(({ usersToAdd, reason }) =>
          update.mutate(
            {
              additionalUsers: data.additionalUsers + usersToAdd,
              reason,
              version: versioning.baseVersion,
            },
            {
              onSuccess: (saved) => {
                versioning.onSaved(saved);
                toast.success('Cupos actualizados');
                setOpen(false);
              },
              onError: (error) => {
                if (!isVersionConflict(error)) {
                  applyFieldErrors(error, form.setError);
                  return;
                }
                void versioning.onConflict(reload);
              },
            },
          ),
        )}
      >
        {versioning.conflict && <ConflictBanner onDiscard={versioning.discard} />}
        {update.isError && !versioning.conflict && (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage(update.error)}</AlertDescription>
          </Alert>
        )}
        <FormField
          id="usersToAdd"
          label="Cantidad a agregar"
          hint={`Adicionales actuales: ${data.additionalUsers}. Después del cambio: ${resultingAdditionalUsers}. Nuevo límite efectivo: ${limitLabel(resultingEffectiveLimit)}.`}
          error={form.formState.errors.usersToAdd?.message}
        >
          {(aria) => (
            <Input
              {...aria}
              type="number"
              min={1}
              step={1}
              {...form.register('usersToAdd', { valueAsNumber: true })}
            />
          )}
        </FormField>
        <ReasonField form={form} />
      </ActionDialog>
    </>
  );
}
