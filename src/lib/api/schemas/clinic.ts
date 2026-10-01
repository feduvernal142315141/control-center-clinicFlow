import { z } from 'zod';
import { isoDateTime, pageSchema, reasonSchema } from './common';

export const operationalStatusSchema = z.enum(['ACTIVE', 'TRIAL', 'SUSPENDED', 'INACTIVE']);
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
});
export type ClinicDetail = z.infer<typeof clinicDetailSchema>;

export const clinicPageSchema = pageSchema(clinicSummarySchema);

export const clinicListQuerySchema = z.object({
  q: z.string().optional(),
  status: operationalStatusSchema.optional(),
  planCode: z.string().optional(),
  specialtyCode: z.string().optional(),
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

export const createClinicInputSchema = z.object({
  name: z.string().trim().min(2, 'El nombre es obligatorio').max(120),
  slug: slugSchema,
  specialtyCode: z.string().min(1, 'Selecciona una especialidad'),
  planCode: z.string().min(1, 'Selecciona un plan'),
  trial: z.boolean(),
  admin: z.object({
    fullName: z.string().trim().min(2, 'El nombre es obligatorio'),
    email: z.email('Correo inválido'),
  }),
});
export type CreateClinicInput = z.infer<typeof createClinicInputSchema>;

export const updateClinicInputSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
});

export const reasonInputSchema = z.object({ reason: reasonSchema });
export type ReasonInput = z.infer<typeof reasonInputSchema>;

export const changeSpecialtyInputSchema = z.object({
  specialtyCode: z.string().min(1, 'Selecciona una especialidad'),
  reason: reasonSchema,
});
export type ChangeSpecialtyInput = z.infer<typeof changeSpecialtyInputSchema>;

export const changeSubscriptionInputSchema = z.object({
  planCode: z.string().min(1, 'Selecciona un plan'),
  startsAt: isoDateTime,
  endsAt: isoDateTime.nullable(),
  trial: z.boolean(),
  reason: reasonSchema,
});
export type ChangeSubscriptionInput = z.infer<typeof changeSubscriptionInputSchema>;
