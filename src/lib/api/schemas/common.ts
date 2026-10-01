import { z } from 'zod';

/** ISO 8601 con offset (el backend usa timestamptz). */
export const isoDateTime = z.iso.datetime({ offset: true });

export const pageSchema = <T extends z.ZodType>(item: T) =>
  z.object({
    content: z.array(item),
    page: z.number().int().nonnegative(),
    size: z.number().int().positive(),
    totalElements: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  });

export type Page<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

/** Motivo obligatorio para acciones auditadas (suspender, cambiar plan, overrides…). */
export const reasonSchema = z
  .string()
  .trim()
  .min(10, 'El motivo debe tener al menos 10 caracteres')
  .max(500, 'El motivo no puede superar 500 caracteres');

/**
 * Control de concurrencia optimista (D16): toda entidad editable trae `version` y todo PUT
 * la devuelve. Si no coincide, el backend responde 409 VERSION_CONFLICT.
 */
export const versionSchema = z.number().int().nonnegative();
