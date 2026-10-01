'use client';

import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import type { FieldValues, UseFormReturn } from 'react-hook-form';
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
import { Textarea } from '@/components/ui/textarea';

/**
 * Piezas comunes de las acciones auditadas: modal de confirmación y motivo obligatorio.
 */

// ---------------------------------------------------------------------------
// Piezas comunes
// ---------------------------------------------------------------------------

export function ReasonField<T extends FieldValues & { reason: string }>({
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

export function ActionDialog({
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
  className,
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
  className?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className={className}>
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
export function useResetOnOpen<T extends FieldValues>(
  form: UseFormReturn<T>,
  open: boolean,
  values: T,
) {
  useEffect(() => {
    if (open) form.reset(values);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir
  }, [open]);
}
