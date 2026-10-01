import { z } from 'zod';
import { isoDateTime } from './common';

const count = z.number().int().nonnegative();

export const trialItemSchema = z.object({
  clinicId: z.string(),
  name: z.string(),
  slug: z.string(),
  planCode: z.string(),
  endsAt: isoDateTime,
});
export type TrialItem = z.infer<typeof trialItemSchema>;

export const dashboardSchema = z.object({
  totalClinics: count,
  active: count,
  suspended: count,
  inactive: count,
  /** Suscripciones con status TRIAL (trials en curso). */
  trial: count,
  byPlan: z.array(z.object({ planCode: z.string().nullable(), count })),
  bySpecialty: z.array(z.object({ specialtyCode: z.string(), count })),
  /** D8: el backend arma las listas; el front solo las muestra. */
  trials: z.object({
    /** Suscripción PAST_DUE con trial = true. La clínica sigue ACTIVE. */
    expired: z.array(trialItemSchema),
    /** Suscripción TRIAL cuyo `endsAt` cae en los próximos 7 días. */
    expiringSoon: z.array(trialItemSchema),
  }),
});
export type Dashboard = z.infer<typeof dashboardSchema>;
