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

export const moduleInputSchema = platformModuleSchema.omit({ id: true });
export type ModuleInput = z.infer<typeof moduleInputSchema>;
