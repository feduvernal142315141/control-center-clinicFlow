import * as React from 'react';
import { Label } from './label';

/**
 * Etiqueta + control + error, con aria enlazado. El control recibe `id`,
 * `aria-invalid` y `aria-describedby` por props.
 */
function FormField({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: React.ReactNode;
  error?: string;
  hint?: React.ReactNode;
  children: (aria: {
    id: string;
    'aria-invalid': boolean;
    'aria-describedby'?: string;
  }) => React.ReactNode;
}) {
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null]
    .filter(Boolean)
    .join(' ');
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children({ id, 'aria-invalid': !!error, 'aria-describedby': describedBy || undefined })}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export { FormField };
