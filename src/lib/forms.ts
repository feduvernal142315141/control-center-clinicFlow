import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { fieldErrorsOf } from './api/errors';

/** Lleva los errores por campo de un VALIDATION_ERROR al formulario. Devuelve si aplicó alguno. */
export function applyFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
): boolean {
  const fields = fieldErrorsOf(error);
  for (const f of fields) setError(f.field as Path<T>, { message: f.message });
  return fields.length > 0;
}
