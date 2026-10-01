'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { ErrorState } from '@/components/states/error-state';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { usePlans, useSpecialties } from '@/lib/api/hooks/use-catalogs';
import { useCreateClinic } from '@/lib/api/hooks/use-clinics';
import { errorMessage, fieldErrorsOf } from '@/lib/api/errors';
import { z } from 'zod';
import { createClinicInputSchema } from '@/lib/api/schemas';
import { fromDateInput } from '@/lib/dates';
import { slugify } from '@/lib/format';
import { applyFieldErrors } from '@/lib/forms';

/** Igual que el contrato, pero la fecha llega como `YYYY-MM-DD` del input. */
const formSchema = createClinicInputSchema
  .safeExtend({ trialEndsAt: z.string() })
  .refine((v) => !v.trial || v.trialEndsAt !== '', {
    path: ['trialEndsAt'],
    message: 'Un trial necesita fecha de fin',
  });
type FormValues = z.infer<typeof formSchema>;

export function CreateClinicForm() {
  const router = useRouter();
  const plans = usePlans();
  const specialties = useSpecialties();
  const create = useCreateClinic();
  const slugTouched = useRef(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      slug: '',
      specialtyCode: '',
      planCode: '',
      trial: false,
      trialEndsAt: '',
      admin: { fullName: '', email: '' },
    },
  });
  const { errors } = form.formState;
  const trial = form.watch('trial');

  const onSubmit = form.handleSubmit(({ trialEndsAt, ...values }) =>
    create.mutate(
      {
        ...values,
        trialEndsAt: values.trial && trialEndsAt ? fromDateInput(trialEndsAt) : null,
      },
      {
        onSuccess: (clinic) => {
          toast.success(`Clínica "${clinic.name}" creada`);
          router.push(`/clinicas/${clinic.id}`);
        },
        onError: (error) => applyFieldErrors(error, form.setError),
      },
    ),
  );

  if (plans.isError || specialties.isError) {
    return (
      <ErrorState
        error={plans.error ?? specialties.error}
        title="No se pudieron cargar planes o especialidades"
        onRetry={() => {
          void plans.refetch();
          void specialties.refetch();
        }}
      />
    );
  }

  const nameField = form.register('name');
  const slugField = form.register('slug');
  const globalError = create.isError && fieldErrorsOf(create.error).length === 0;

  return (
    <form noValidate onSubmit={onSubmit} className="max-w-2xl space-y-6">
      {globalError && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertDescription>{errorMessage(create.error)}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Clínica</CardTitle>
          <CardDescription>El slug identifica a la clínica y no debería cambiar.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField id="name" label="Nombre" error={errors.name?.message}>
            {(aria) => (
              <Input
                {...aria}
                {...nameField}
                onChange={(e) => {
                  void nameField.onChange(e);
                  if (!slugTouched.current) {
                    form.setValue('slug', slugify(e.target.value), { shouldValidate: false });
                  }
                }}
              />
            )}
          </FormField>
          <FormField
            id="slug"
            label="Slug"
            error={errors.slug?.message}
            hint="Minúsculas, números y guiones."
          >
            {(aria) => (
              <Input
                {...aria}
                {...slugField}
                className="font-mono"
                onChange={(e) => {
                  slugTouched.current = true;
                  void slugField.onChange(e);
                }}
              />
            )}
          </FormField>
          <FormField id="specialtyCode" label="Especialidad" error={errors.specialtyCode?.message}>
            {(aria) => (
              <NativeSelect
                {...aria}
                {...form.register('specialtyCode')}
                disabled={!specialties.data}
              >
                <option value="">Selecciona…</option>
                {specialties.data
                  ?.filter((s) => s.active)
                  .map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name}
                    </option>
                  ))}
              </NativeSelect>
            )}
          </FormField>
          <FormField id="planCode" label="Plan" error={errors.planCode?.message}>
            {(aria) => (
              <NativeSelect {...aria} {...form.register('planCode')} disabled={!plans.data}>
                <option value="">Selecciona…</option>
                {plans.data
                  ?.filter((p) => p.active)
                  .map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.name}
                    </option>
                  ))}
              </NativeSelect>
            )}
          </FormField>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" className="size-4 accent-primary" {...form.register('trial')} />
            Empieza en periodo de prueba (trial)
          </label>
          {trial && (
            <FormField id="trialEndsAt" label="Fin del trial" error={errors.trialEndsAt?.message}>
              {(aria) => <Input {...aria} type="date" {...form.register('trialEndsAt')} />}
            </FormField>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Administrador inicial</CardTitle>
          <CardDescription>Recibirá la invitación para entrar a la clínica.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="admin.fullName"
            label="Nombre completo"
            error={errors.admin?.fullName?.message}
          >
            {(aria) => <Input {...aria} {...form.register('admin.fullName')} />}
          </FormField>
          <FormField id="admin.email" label="Correo" error={errors.admin?.email?.message}>
            {(aria) => <Input {...aria} type="email" {...form.register('admin.email')} />}
          </FormField>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button type="submit" disabled={create.isPending}>
          {create.isPending && <Loader2 className="animate-spin" />}
          Crear clínica
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/clinicas">Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
