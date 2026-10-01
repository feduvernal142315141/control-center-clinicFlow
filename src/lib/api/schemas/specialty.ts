import { z } from 'zod';

export const specialtySchema = z.object({
  code: z.string(),
  name: z.string(),
  active: z.boolean(),
  /** Clínicas con esta especialidad (cualquier estado). */
  clinicCount: z.number().int().nonnegative(),
  /** Módulos activos usables: los que la listan + los compatibles con todas. */
  compatibleModuleCount: z.number().int().nonnegative(),
});
export type Specialty = z.infer<typeof specialtySchema>;
