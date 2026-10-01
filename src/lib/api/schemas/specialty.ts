import { z } from 'zod';

export const specialtySchema = z.object({
  code: z.string(),
  name: z.string(),
  active: z.boolean(),
});
export type Specialty = z.infer<typeof specialtySchema>;
