'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Info, Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { useForm, type FieldValues, type UseFormReturn } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { usePlans, useSpecialties } from '@/lib/api/hooks/use-catalogs';
import {
  useChangeSpecialty,
  useChangeSubscription,
  useReactivateClinic,
  useSuspendClinic,
} from '@/lib/api/hooks/use-clinics';
import { reasonSchema, type ClinicDetail } from '@/lib/api/schemas';
import { applyFieldErrors } from '@/lib/forms';

export type ClinicAction = 'suspend' | 'reactivate' | 'plan' | 'specialty';

interface DialogProps {
  clinic: ClinicDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ---------------------------------------------------------------------------
// Piezas comunes
// ---------------------------------------------------------------------------

function ReasonField<T extends FieldValues & { reason: string }>({
  form,
}: {
  form: UseFormReturn<T>;
}) {
  const error = (form.formState.errors as { reason?: { message?: string } }).reason?.message;
  return (
    <FormField
      id="reason"
      label="Motivo (obligatorio)"
      error={error}
      hint="Queda registrado en la auditoría. Mínimo 10 caracteres."
    >
      {(aria) => (
        <Textarea
          {...aria}
          rows={3}
          {...form.register('reason' as Parameters<typeof form.register>[0])}
        />
      )}
    </FormField>
  );
}

function ActionDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  submitLabel,
  pending,
  destructive,
  submitDisabled,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  children: React.ReactNode;
  submitLabel: string;
  pending: boolean;
  destructive?: boolean;
  submitDisabled?: boolean;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent>
        <form noValidate onSubmit={onSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription asChild>
              <div>{description}</div>
            </DialogDescription>
          </DialogHeader>
          {children}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant={destructive ? 'destructive' : 'default'}
              disabled={pending || submitDisabled}
            >
              {pending && <Loader2 className="animate-spin" />}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Resetea el formulario cada vez que se abre el diálogo. */
function useResetOnOpen<T extends FieldValues>(form: UseFormReturn<T>, open: boolean, values: T) {
  useEffect(() => {
    if (open) form.reset(values);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir
  }, [open]);
}

// ---------------------------------------------------------------------------
// Suspender (confirmación reforzada: escribir el slug)
// ---------------------------------------------------------------------------

export function SuspendClinicDialog({ clinic, open, onOpenChange }: DialogProps) {
  const suspend = useSuspendClinic(clinic.id);
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
          { reason },
          {
            onSuccess: () => {
              toast.success('Clínica suspendida');
              onOpenChange(false);
            },
            onError: (e) => applyFieldErrors(e, form.setError),
          },
        ),
      )}
    >
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

export function ReactivateClinicDialog({ clinic, open, onOpenChange }: DialogProps) {
  const reactivate = useReactivateClinic(clinic.id);
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
          <strong>{clinic.name}</strong> volverá a tener acceso según su plan y overrides.
        </p>
      }
      onSubmit={form.handleSubmit((values) =>
        reactivate.mutate(values, {
          onSuccess: () => {
            toast.success('Clínica reactivada');
            onOpenChange(false);
          },
          onError: (e) => applyFieldErrors(e, form.setError),
        }),
      )}
    >
      <ReasonField form={form} />
    </ActionDialog>
  );
}

// ---------------------------------------------------------------------------
// Cambiar especialidad
// ---------------------------------------------------------------------------

export function ChangeSpecialtyDialog({ clinic, open, onOpenChange }: DialogProps) {
  const specialties = useSpecialties();
  const change = useChangeSpecialty(clinic.id);
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

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Cambiar especialidad"
      submitLabel="Cambiar especialidad"
      pending={change.isPending}
      description={<p>Cambia el perfil clínico de {clinic.name}.</p>}
      onSubmit={form.handleSubmit((values) =>
        change.mutate(values, {
          onSuccess: () => {
            toast.success('Especialidad actualizada');
            onOpenChange(false);
          },
          onError: (e) => applyFieldErrors(e, form.setError),
        }),
      )}
    >
      <Alert>
        <Info />
        <AlertDescription>
          Los módulos de especialidad no compatibles quedarán OFF. Revisa la pestaña de módulos
          efectivos después del cambio.
        </AlertDescription>
      </Alert>
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
      <ReasonField form={form} />
    </ActionDialog>
  );
}

// ---------------------------------------------------------------------------
// Cambiar plan / suscripción
// ---------------------------------------------------------------------------

const toDateInput = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
/** Fecha local (inicio del día en la zona del navegador) → ISO 8601. */
const fromDateInput = (value: string) => new Date(`${value}T00:00:00`).toISOString();

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

export function ChangePlanDialog({ clinic, open, onOpenChange }: DialogProps) {
  const plans = usePlans();
  const change = useChangeSubscription(clinic.id);
  const form = useForm<z.infer<typeof subscriptionFormSchema>>({
    resolver: zodResolver(subscriptionFormSchema),
  });
  useResetOnOpen(form, open, {
    planCode: clinic.subscription?.planCode ?? '',
    startsAt: toDateInput(clinic.subscription?.startsAt ?? new Date().toISOString()),
    endsAt: toDateInput(clinic.subscription?.endsAt),
    trial: clinic.subscription?.trial ?? false,
    reason: '',
  });
  const { errors } = form.formState;

  return (
    <ActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Cambiar plan o suscripción"
      submitLabel="Guardar suscripción"
      pending={change.isPending}
      description={<p>Cambia el plan, las fechas o el trial de {clinic.name}.</p>}
      onSubmit={form.handleSubmit((v) =>
        change.mutate(
          {
            planCode: v.planCode,
            startsAt: fromDateInput(v.startsAt),
            endsAt: v.endsAt ? fromDateInput(v.endsAt) : null,
            trial: v.trial,
            reason: v.reason,
          },
          {
            onSuccess: () => {
              toast.success('Suscripción actualizada');
              onOpenChange(false);
            },
            onError: (e) => applyFieldErrors(e, form.setError),
          },
        ),
      )}
    >
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
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="startsAt" label="Inicio" error={errors.startsAt?.message}>
          {(aria) => <Input {...aria} type="date" {...form.register('startsAt')} />}
        </FormField>
        <FormField id="endsAt" label="Fin (opcional)" error={errors.endsAt?.message}>
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
