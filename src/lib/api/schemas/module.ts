import { z } from 'zod';

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
});
export type PlatformModule = z.infer<typeof platformModuleSchema>;

/** POST /platform/modules */
export const moduleCreateInputSchema = platformModuleSchema.omit({ id: true }).extend({
  name: z.string().trim().min(2, 'El nombre es obligatorio').max(80),
  description: z.string().trim().max(500).optional(),
});
export type ModuleCreateInput = z.infer<typeof moduleCreateInputSchema>;

/** PUT /platform/modules/{id}: el `code` no se edita después de creado. */
export const moduleUpdateInputSchema = moduleCreateInputSchema.omit({ code: true });
export type ModuleUpdateInput = z.infer<typeof moduleUpdateInputSchema>;
