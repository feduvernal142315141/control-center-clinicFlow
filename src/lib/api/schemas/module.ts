import { z } from 'zod';
import { reasonSchema, versionSchema } from './common';

export const moduleCategorySchema = z.enum([
  'CORE',
  'COMMS',
  'AI',
  'MARKETING',
  'GROWTH',
  'SPECIALTY',
]);
export type ModuleCategory = z.infer<typeof moduleCategorySchema>;

export const moduleCodeSchema = z
  .string()
  .regex(/^[A-Z][A-Z0-9_]*$/, 'Solo mayúsculas, números y guion bajo');

/** Límite que un plan puede fijar para este módulo (D15). Lo define el backend. */
export const allowedLimitSchema = z.object({
  key: z.string(),
  label: z.string(),
  /** Unidad para mostrar, p. ej. "profesionales" o "mensajes/mes". */
  unit: z.string(),
});
export type AllowedLimit = z.infer<typeof allowedLimitSchema>;

export const platformModuleSchema = z.object({
  id: z.string(),
  code: moduleCodeSchema,
  name: z.string(),
  description: z.string().optional(),
  category: moduleCategorySchema,
  requiredCore: z.boolean(),
  active: z.boolean(),
  /** Vacío = compatible con todas las especialidades. */
  compatibleSpecialties: z.array(z.string()),
  /** Códigos de módulo. */
  dependsOn: z.array(moduleCodeSchema),
  /** Vacío = el módulo no admite límites por plan. No editable desde el Control Center en V1. */
  allowedLimits: z.array(allowedLimitSchema),
  version: versionSchema,
});
export type PlatformModule = z.infer<typeof platformModuleSchema>;

const moduleFields = {
  name: z.string().trim().min(2, 'El nombre es obligatorio').max(80),
  description: z.string().trim().max(500).optional(),
  category: moduleCategorySchema,
  requiredCore: z.boolean(),
  active: z.boolean(),
  compatibleSpecialties: z.array(z.string()),
  dependsOn: z.array(moduleCodeSchema),
};

/**
 * POST /platform/modules. El módulo nuevo se agrega a todos los planes en OFF
 * (en ON si es requiredCore) — D13.
 */
export const moduleCreateInputSchema = z.object({ code: moduleCodeSchema, ...moduleFields });
export type ModuleCreateInput = z.infer<typeof moduleCreateInputSchema>;

/**
 * PUT /platform/modules/{id}: sin `code` (inmutable). `version` obligatoria (D16).
 * `reason` es obligatorio cuando el cambio desactiva el módulo (D14).
 */
export const moduleUpdateInputSchema = z.object({
  ...moduleFields,
  version: versionSchema,
  reason: reasonSchema.optional(),
});
export type ModuleUpdateInput = z.infer<typeof moduleUpdateInputSchema>;

/** GET /platform/modules/{id}/usage: clínicas con el módulo ON hoy (efectivo). */
export const moduleUsageSchema = z.object({
  clinicCount: z.number().int().nonnegative(),
  /** Como máximo las primeras 10, ordenadas por nombre. */
  clinics: z.array(z.object({ clinicId: z.string(), name: z.string(), slug: z.string() })),
});
export type ModuleUsage = z.infer<typeof moduleUsageSchema>;
