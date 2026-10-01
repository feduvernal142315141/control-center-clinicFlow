import { z } from 'zod';

const count = z.number().int().nonnegative();

export const dashboardSchema = z.object({
  totalClinics: count,
  active: count,
  trial: count,
  suspended: count,
  inactive: count,
  byPlan: z.array(z.object({ planCode: z.string().nullable(), count })),
  bySpecialty: z.array(z.object({ specialtyCode: z.string(), count })),
});
export type Dashboard = z.infer<typeof dashboardSchema>;
