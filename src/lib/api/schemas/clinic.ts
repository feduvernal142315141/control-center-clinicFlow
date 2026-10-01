import { z } from 'zod';
import { isoDateTime, pageSchema, reasonSchema, versionSchema } from './common';

/**
 * Estado operativo de la clínica. El trial NO es un estado operativo: vive solo en la
 * suscripción (`subscription.trial` / `status: 'TRIAL'`).
 */
export const operationalStatusSchema = z.enum(['ACTIVE', 'SUSPENDED', 'INACTIVE']);
export type OperationalStatus = z.infer<typeof operationalStatusSchema>;

export const subscriptionStatusSchema = z.enum(['ACTIVE', 'TRIAL', 'PAST_DUE', 'CANCELED']);
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;

export const clinicSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  specialtyCode: z.string(),
  operationalStatus: operationalStatusSchema,
  planCode: z.string().nullable(),
  /** Reflejo de `subscription.trial` (false si no hay suscripción). */
  trial: z.boolean(),
  createdAt: isoDateTime,
});
export type ClinicSummary = z.infer<typeof clinicSummarySchema>;

export const subscriptionSchema = z.object({
  id: z.string(),
  planId: z.string(),
  planCode: z.string(),
  status: subscriptionStatusSchema,
  startsAt: isoDateTime,
  endsAt: isoDateTime.nullable(),
  renewalDate: isoDateTime.nullable(),
  trial: z.boolean(),
});
export type Subscription = z.infer<typeof subscriptionSchema>;

export const clinicDetailSchema = clinicSummarySchema.extend({
  subscription: subscriptionSchema.nullable(),
  /** Una sola versión por clínica: datos, suscripción, especialidad, estado y overrides (D17). */
  version: versionSchema,
});
export type ClinicDetail = z.infer<typeof clinicDetailSchema>;

export const clinicPageSchema = pageSchema(clinicSummarySchema);

export const clinicListQuerySchema = z.object({
  q: z.string().optional(),
  status: operationalStatusSchema.optional(),
  planCode: z.string().optional(),
  specialtyCode: z.string().optional(),
  /** Filtra por suscripción en trial. */
  trial: z.boolean().optional(),
  page: z.number().int().nonnegative().optional(),
  size: z.number().int().positive().max(100).optional(),
});
export type ClinicListQuery = z.infer<typeof clinicListQuerySchema>;

export const slugSchema = z
  .string()
  .trim()
  .min(3, 'Mínimo 3 caracteres')
  .max(60, 'Máximo 60 caracteres')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Solo minúsculas, números y guiones');

const TRIAL_NEEDS_END = 'Un trial necesita fecha de fin';

export const clinicNameSchema = z.string().trim().min(2, 'El nombre es obligatorio').max(120);

export const createClinicInputSchema = z
  .object({
    name: clinicNameSchema,
    slug: slugSchema,
    specialtyCode: z.string().min(1, 'Selecciona una especialidad'),
    planCode: z.string().min(1, 'Selecciona un plan'),
    trial: z.boolean(),
    /** Obligatorio si `trial`; `null` si no. */
    trialEndsAt: isoDateTime.nullable(),
    admin: z.object({
      fullName: z.string().trim().min(2, 'El nombre es obligatorio'),
      email: z.email('Correo inválido'),
    }),
  })
  .refine((v) => !v.trial || v.trialEndsAt !== null, {
    path: ['trialEndsAt'],
    message: TRIAL_NEEDS_END,
  });
export type CreateClinicInput = z.infer<typeof createClinicInputSchema>;

export const updateClinicInputSchema = z.object({
  name: clinicNameSchema,
  reason: reasonSchema,
  version: versionSchema,
});
export type UpdateClinicInput = z.infer<typeof updateClinicInputSchema>;

export const reasonInputSchema = z.object({ reason: reasonSchema });
export type ReasonInput = z.infer<typeof reasonInputSchema>;

/** Suspender / reactivar (D17). */
export const clinicStatusInputSchema = z.object({ reason: reasonSchema, version: versionSchema });
export type ClinicStatusInput = z.infer<typeof clinicStatusInputSchema>;

export const changeSpecialtyInputSchema = z.object({
  specialtyCode: z.string().min(1, 'Selecciona una especialidad'),
  reason: reasonSchema,
  version: versionSchema,
});
export type ChangeSpecialtyInput = z.infer<typeof changeSpecialtyInputSchema>;

export const changeSubscriptionInputSchema = z
  .object({
    planCode: z.string().min(1, 'Selecciona un plan'),
    startsAt: isoDateTime,
    endsAt: isoDateTime.nullable(),
    trial: z.boolean(),
    reason: reasonSchema,
    version: versionSchema,
  })
  .refine((v) => !v.trial || v.endsAt !== null, { path: ['endsAt'], message: TRIAL_NEEDS_END });
export type ChangeSubscriptionInput = z.infer<typeof changeSubscriptionInputSchema>;

/** Vista previa de módulos efectivos (no guarda nada). */
export const effectivePreviewQuerySchema = z.object({
  specialtyCode: z.string().optional(),
  planCode: z.string().optional(),
});
export type EffectivePreviewQuery = z.infer<typeof effectivePreviewQuerySchema>;
