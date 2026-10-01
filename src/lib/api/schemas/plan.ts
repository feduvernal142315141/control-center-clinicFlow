import { z } from 'zod';
import { reasonSchema } from './common';
import { moduleCodeSchema } from './module';

/** Límite por módulo: entero ≥ 0, o `null` = ilimitado. */
export const limitValueSchema = z.number().int().nonnegative().nullable();

export const limitKeySchema = z
  .string()
  .regex(/^[a-z][a-zA-Z0-9]*$/, 'Usa camelCase: letras y números, empezando en minúscula');

export const planModuleSchema = z.object({
  moduleCode: moduleCodeSchema,
  enabled: z.boolean(),
  limits: z.record(z.string(), limitValueSchema).optional(),
});
export type PlanModule = z.infer<typeof planModuleSchema>;

export const planCodeSchema = z
  .string()
  .trim()
  .min(2, 'Mínimo 2 caracteres')
  .max(40, 'Máximo 40 caracteres')
  .regex(/^[A-Z][A-Z0-9_]*$/, 'Solo mayúsculas, números y guion bajo');

export const planSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  description: z.string().optional(),
  active: z.boolean(),
  sortOrder: z.number().int(),
  modules: z.array(planModuleSchema),
});
export type Plan = z.infer<typeof planSchema>;

const planFields = {
  name: z.string().trim().min(2, 'El nombre es obligatorio').max(80),
  description: z.string().trim().max(500).optional(),
  active: z.boolean(),
  sortOrder: z.number({ error: 'Debe ser un número' }).int('Debe ser entero'),
};

/** POST /platform/plans */
export const planCreateInputSchema = z.object({ code: planCodeSchema, ...planFields });
export type PlanCreateInput = z.infer<typeof planCreateInputSchema>;

/** PUT /platform/plans/{id}: el `code` no se edita después de creado. */
export const planUpdateInputSchema = z.object(planFields);
export type PlanUpdateInput = z.infer<typeof planUpdateInputSchema>;

/** PUT /platform/plans/{id}/modules: matriz completa + motivo (cambio comercial). */
export const planModulesInputSchema = z.object({
  modules: z.array(planModuleSchema),
  reason: reasonSchema,
});
export type PlanModulesInput = z.infer<typeof planModulesInputSchema>;
