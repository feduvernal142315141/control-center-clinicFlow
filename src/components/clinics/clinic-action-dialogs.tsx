'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm, type FieldValues, type UseFormSetError } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { ActionDialog, ReasonField, useResetOnOpen } from '@/components/shared/action-dialog';
import { ConflictBanner } from '@/components/shared/conflict-banner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { usePlans, useSpecialties } from '@/lib/api/hooks/use-catalogs';
import {
  useChangeSpecialty,
  useChangeSubscription,
  useReactivateClinic,
  useSuspendClinic,
  useUpdateClinic,
} from '@/lib/api/hooks/use-clinics';
import { clinicNameSchema, reasonSchema, type ClinicDetail } from '@/lib/api/schemas';
import { fromDateInput, toDateInput } from '@/lib/dates';
import { OPERATIONAL_STATUS_LABEL } from '@/lib/format';
import { isVersionConflict } from '@/lib/api/errors';
import { applyFieldErrors } from '@/lib/forms';
import { ModuleImpactPreview } from './module-impact-preview';

export type ClinicAction = 'suspend' | 'reactivate' | 'plan' | 'specialty' | 'rename';

interface DialogProps {
  clinic: ClinicDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Recarga la clínica y devuelve su versión actual (D17). */
  reload?: () => Promise<number | undefined>;
}

/**
 * D17: cada acción manda la versión de la clínica con la que se abrió el diálogo.
 * Ante VERSION_CONFLICT: aviso, recarga y se conserva lo escrito; guardar de nuevo usa
 * la versión recargada.
 */
function useClinicVersion(
  clinic: ClinicDetail,
  open: boolean,
  reload?: () => Promise<number | undefined>,
) {
  const [base, setBase] = useState(clinic.version);
  const [conflict, setConflict] = useState(false);
  useEffect(() => {
    if (open) {
      setBase(clinic.version);
      setConflict(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir
  }, [open]);
  return {
    base,
    conflict,
    clear: () => setConflict(false),
    handleError: <T extends FieldValues>(e: unknown, setError: UseFormSetError<T>) => {
      if (!isVersionConflict(e)) {
        applyFieldErrors(e, setError);
        return;
      }
      setConflict(true);
      void reload?.().then((v) => v !== undefined && setBase(v));
    },
  };
}

// ---------------------------------------------------------------------------
// Suspender (confirmación reforzada: escribir el slug)
// ---------------------------------------------------------------------------

export function SuspendClinicDialog({ clinic, open, onOpenChange, reload }: DialogProps) {
  const suspend = useSuspendClinic(clinic.id);
  const v = useClinicVersion(clinic, open, reload);
  const schema = z.object({
    reason: reasonSchema,
    confirmSlug: z.string().refine((v) => v === clinic.slug, 'El slug no coincide'),
  });
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({ resolver: zodResolver(schema) });
  useResetOnOpen(form, open, { reason: '', confirmSlug: '' });
  const slugMatches = form.watch('confirmSlug') === clinic.slug;

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Suspender clínica"
      destructive
      submitLabel="Suspender clínica"
      pending={suspend.isPending}
      submitDisabled={!slugMatches}
      description={
        <p>
          <strong>{clinic.name}</strong> quedará bloqueada: ningún usuario de la clínica podrá usar
          la plataforma hasta que se reactive.
        </p>
      }
      onSubmit={form.handleSubmit(({ reason }) =>
        suspend.mutate(
          { reason, version: v.base },
          {
            onSuccess: () => {
              toast.success('Clínica suspendida');
              onOpenChange(false);
            },
            onError: (e) => v.handleError(e, form.setError),
          },
        ),
      )}
    >
      {v.conflict && (
        <ConflictBanner
          onDiscard={() => {
            form.reset({ reason: '', confirmSlug: '' });
            v.clear();
          }}
        />
      )}
      <Alert variant="destructive">
        <AlertTriangle />
        <AlertDescription>Todos los módulos de la clínica quedarán OFF.</AlertDescription>
      </Alert>
      <ReasonField form={form} />
      <FormField
        id="confirmSlug"
        label={
          <span>
            Escribe <code className="rounded bg-muted px-1 font-mono">{clinic.slug}</code> para
            confirmar
          </span>
        }
        error={form.formState.errors.confirmSlug?.message}
      >
        {(aria) => (
          <Input
            {...aria}
            autoComplete="off"
            spellCheck={false}
            className="font-mono"
            {...form.register('confirmSlug')}
          />
        )}
      </FormField>
    </ActionDialog>
  );
}

// ---------------------------------------------------------------------------
// Reactivar
// ---------------------------------------------------------------------------

const reasonOnlySchema = z.object({ reason: reasonSchema });

export function ReactivateClinicDialog({ clinic, open, onOpenChange, reload }: DialogProps) {
  const reactivate = useReactivateClinic(clinic.id);
  const v = useClinicVersion(clinic, open, reload);
  const form = useForm<z.infer<typeof reasonOnlySchema>>({
    resolver: zodResolver(reasonOnlySchema),
  });
  useResetOnOpen(form, open, { reason: '' });

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Reactivar clínica"
      submitLabel="Reactivar"
      pending={reactivate.isPending}
      description={
        <p>
          <strong>{clinic.name}</strong> está{' '}
          {OPERATIONAL_STATUS_LABEL[clinic.operationalStatus].toLowerCase()}. Volverá a estar activa
          y con acceso según su plan y overrides.
        </p>
      }
      onSubmit={form.handleSubmit((values) =>
        reactivate.mutate(
          { ...values, version: v.base },
          {
            onSuccess: () => {
              toast.success('Clínica reactivada');
              onOpenChange(false);
            },
            onError: (e) => v.handleError(e, form.setError),
          },
        ),
      )}
    >
      {v.conflict && (
        <ConflictBanner
          onDiscard={() => {
            form.reset({ reason: '' });
            v.clear();
          }}
        />
      )}
      <ReasonField form={form} />
    </ActionDialog>
  );
}

// ---------------------------------------------------------------------------
// Cambiar especialidad
// ---------------------------------------------------------------------------

export function ChangeSpecialtyDialog({ clinic, open, onOpenChange, reload }: DialogProps) {
  const specialties = useSpecialties();
  const change = useChangeSpecialty(clinic.id);
  const v = useClinicVersion(clinic, open, reload);
  const schema = z.object({
    specialtyCode: z
      .string()
      .min(1, 'Selecciona una especialidad')
      .refine((v) => v !== clinic.specialtyCode, 'Es la especialidad actual'),
    reason: reasonSchema,
  });
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({ resolver: zodResolver(schema) });
  useResetOnOpen(form, open, { specialtyCode: '', reason: '' });
  const selected = form.watch('specialtyCode');

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Cambiar especialidad"
      submitLabel="Cambiar especialidad"
      pending={change.isPending}
      description={<p>Cambia el perfil clínico de {clinic.name}.</p>}
      onSubmit={form.handleSubmit((values) =>
        change.mutate(
          { ...values, version: v.base },
          {
            onSuccess: () => {
              toast.success('Especialidad actualizada');
              onOpenChange(false);
            },
            onError: (e) => v.handleError(e, form.setError),
          },
        ),
      )}
    >
      {v.conflict && (
        <ConflictBanner
          onDiscard={() => {
            form.reset({ specialtyCode: '', reason: '' });
            v.clear();
          }}
        />
      )}
      <FormField
        id="specialtyCode"
        label="Nueva especialidad"
        error={form.formState.errors.specialtyCode?.message}
      >
        {(aria) => (
          <NativeSelect {...aria} {...form.register('specialtyCode')} disabled={!specialties.data}>
            <option value="">Selecciona…</option>
            {specialties.data
              ?.filter((s) => s.active)
              .map((s) => (
                <option key={s.code} value={s.code} disabled={s.code === clinic.specialtyCode}>
                  {s.name}
                  {s.code === clinic.specialtyCode ? ' (actual)' : ''}
                </option>
              ))}
          </NativeSelect>
        )}
      </FormField>
      {selected && selected !== clinic.specialtyCode && (
        <ModuleImpactPreview clinicId={clinic.id} preview={{ specialtyCode: selected }} />
      )}
      <ReasonField form={form} />
    </ActionDialog>
  );
}

// ---------------------------------------------------------------------------
// Cambiar plan / suscripción
// ---------------------------------------------------------------------------

const subscriptionFormSchema = z
  .object({
    planCode: z.string().min(1, 'Selecciona un plan'),
    startsAt: z.string().min(1, 'La fecha de inicio es obligatoria'),
    endsAt: z.string(),
    trial: z.boolean(),
    reason: reasonSchema,
  })
  .refine((v) => !v.endsAt || v.endsAt >= v.startsAt, {
    path: ['endsAt'],
    message: 'Debe ser igual o posterior al inicio',
  })
  .refine((v) => !v.trial || !!v.endsAt, {
    path: ['endsAt'],
    message: 'Un trial necesita fecha de fin',
  });

export function ChangePlanDialog({ clinic, open, onOpenChange, reload }: DialogProps) {
  const plans = usePlans();
  const change = useChangeSubscription(clinic.id);
  const v = useClinicVersion(clinic, open, reload);
  const form = useForm<z.infer<typeof subscriptionFormSchema>>({
    resolver: zodResolver(subscriptionFormSchema),
  });
  const initialValues = () => ({
    planCode: clinic.subscription?.planCode ?? '',
    startsAt: toDateInput(clinic.subscription?.startsAt ?? new Date().toISOString()),
    endsAt: toDateInput(clinic.subscription?.endsAt),
    trial: clinic.subscription?.trial ?? false,
    reason: '',
  });
  useResetOnOpen(form, open, initialValues());
  const { errors } = form.formState;
  const selectedPlan = form.watch('planCode');

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Cambiar plan o suscripción"
      submitLabel="Guardar suscripción"
      pending={change.isPending}
      description={<p>Cambia el plan, las fechas o el trial de {clinic.name}.</p>}
      onSubmit={form.handleSubmit((values) =>
        change.mutate(
          {
            planCode: values.planCode,
            startsAt: fromDateInput(values.startsAt),
            endsAt: values.endsAt ? fromDateInput(values.endsAt) : null,
            trial: values.trial,
            reason: values.reason,
            version: v.base,
          },
          {
            onSuccess: () => {
              toast.success('Suscripción actualizada');
              onOpenChange(false);
            },
            onError: (e) => v.handleError(e, form.setError),
          },
        ),
      )}
    >
      {v.conflict && (
        <ConflictBanner
          onDiscard={() => {
            form.reset(initialValues());
            v.clear();
          }}
        />
      )}
      <FormField id="planCode" label="Plan" error={errors.planCode?.message}>
        {(aria) => (
          <NativeSelect {...aria} {...form.register('planCode')} disabled={!plans.data}>
            <option value="">Selecciona…</option>
            {plans.data
              ?.filter((p) => p.active || p.code === clinic.subscription?.planCode)
              .map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                  {p.code === clinic.subscription?.planCode ? ' (actual)' : ''}
                </option>
              ))}
          </NativeSelect>
        )}
      </FormField>
      {selectedPlan && selectedPlan !== clinic.planCode && (
        <ModuleImpactPreview clinicId={clinic.id} preview={{ planCode: selectedPlan }} />
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="startsAt" label="Inicio" error={errors.startsAt?.message}>
          {(aria) => <Input {...aria} type="date" {...form.register('startsAt')} />}
        </FormField>
        <FormField
          id="endsAt"
          label="Fin"
          error={errors.endsAt?.message}
          hint="Obligatoria si es trial."
        >
          {(aria) => <Input {...aria} type="date" {...form.register('endsAt')} />}
        </FormField>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4 accent-primary" {...form.register('trial')} />
        Periodo de prueba (trial)
      </label>
      <ReasonField form={form} />
    </ActionDialog>
  );
}

// ---------------------------------------------------------------------------
// Editar nombre
// ---------------------------------------------------------------------------

const renameSchema = z.object({ name: clinicNameSchema, reason: reasonSchema });

export function RenameClinicDialog({ clinic, open, onOpenChange, reload }: DialogProps) {
  const update = useUpdateClinic(clinic.id);
  const v = useClinicVersion(clinic, open, reload);
  const schema = renameSchema.refine((v) => v.name !== clinic.name, {
    path: ['name'],
    message: 'Es el nombre actual',
  });
  const form = useForm<z.infer<typeof renameSchema>>({ resolver: zodResolver(schema) });
  useResetOnOpen(form, open, { name: clinic.name, reason: '' });

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Editar nombre"
      submitLabel="Guardar nombre"
      pending={update.isPending}
      description={<p>El slug no cambia.</p>}
      onSubmit={form.handleSubmit((values) =>
        update.mutate(
          { ...values, version: v.base },
          {
            onSuccess: () => {
              toast.success('Nombre actualizado');
              onOpenChange(false);
            },
            onError: (e) => v.handleError(e, form.setError),
          },
        ),
      )}
    >
      {v.conflict && (
        <ConflictBanner
          onDiscard={() => {
            form.reset({ name: clinic.name, reason: '' });
            v.clear();
          }}
        />
      )}
      <FormField id="name" label="Nombre" error={form.formState.errors.name?.message}>
        {(aria) => <Input {...aria} {...form.register('name')} />}
      </FormField>
      <ReasonField form={form} />
    </ActionDialog>
  );
}
