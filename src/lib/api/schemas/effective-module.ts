import { z } from 'zod';
import { isoDateTime, reasonSchema } from './common';
import { moduleCategorySchema, moduleCodeSchema } from './module';

export const moduleOverrideSchema = z.object({
  moduleCode: moduleCodeSchema,
  enabled: z.boolean(),
  reason: z.string(),
  createdBy: z.string(),
  createdAt: isoDateTime,
  expiresAt: isoDateTime.nullable(),
});
export type ModuleOverride = z.infer<typeof moduleOverrideSchema>;

export const moduleOverrideInputSchema = z.object({
  moduleCode: moduleCodeSchema,
  enabled: z.boolean(),
  reason: reasonSchema,
  expiresAt: isoDateTime.nullable(),
});
export type ModuleOverrideInput = z.infer<typeof moduleOverrideInputSchema>;

export const effectiveSourceSchema = z.enum(['REQUIRED_CORE', 'PLAN', 'OVERRIDE']);
export type EffectiveSource = z.infer<typeof effectiveSourceSchema>;

export const deniedReasonSchema = z.enum([
  'CLINIC_SUSPENDED',
  'MODULE_INACTIVE',
  'FLAG_KILL_SWITCH',
  'SPECIALTY_INCOMPATIBLE',
  'OVERRIDE_OFF',
  'NOT_IN_PLAN',
  'MISSING_DEPENDENCY',
]);
export type DeniedReason = z.infer<typeof deniedReasonSchema>;

export const effectiveModuleSchema = z
  .object({
    code: moduleCodeSchema,
    name: z.string(),
    category: moduleCategorySchema,
    requiredCore: z.boolean(),
    enabled: z.boolean(),
    source: effectiveSourceSchema.nullable(),
    deniedReason: deniedReasonSchema.nullable(),
    missingDependencies: z.array(moduleCodeSchema).optional(),
    override: moduleOverrideSchema.optional(),
  })
  .refine((m) => (m.enabled ? m.source !== null : m.deniedReason !== null), {
    message: 'Un módulo ON debe tener source y uno OFF debe tener deniedReason',
  });
export type EffectiveModule = z.infer<typeof effectiveModuleSchema>;
