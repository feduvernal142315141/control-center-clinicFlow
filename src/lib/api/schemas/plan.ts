import { z } from 'zod';
import { moduleCodeSchema } from './module';

export const planModuleSchema = z.object({
  moduleCode: moduleCodeSchema,
  enabled: z.boolean(),
  limits: z.record(z.string(), z.number().nullable()).optional(),
});
export type PlanModule = z.infer<typeof planModuleSchema>;

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

export const planInputSchema = planSchema.omit({ id: true, modules: true });
export type PlanInput = z.infer<typeof planInputSchema>;

export const planModulesInputSchema = z.object({ modules: z.array(planModuleSchema) });
