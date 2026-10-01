import { z } from 'zod';
import { platformRequest } from '../client';
import {
  clinicDetailSchema,
  clinicPageSchema,
  dashboardSchema,
  effectiveModuleSchema,
  planSchema,
  platformMeSchema,
  specialtySchema,
  type ChangeSpecialtyInput,
  type ChangeSubscriptionInput,
  type ClinicListQuery,
  type CreateClinicInput,
  type ReasonInput,
} from '../schemas';

const clinicPath = (clinicId: string) => `/clinics/${encodeURIComponent(clinicId)}`;

/**
 * Endpoints de `/platform/**`. Cada fase agrega aquí sus llamadas;
 * los componentes nunca usan fetch directo.
 */
export const platformApi = {
  me: (signal?: AbortSignal) => platformRequest('/me', { schema: platformMeSchema, signal }),
  dashboard: (signal?: AbortSignal) =>
    platformRequest('/dashboard', { schema: dashboardSchema, signal }),

  // ---- Clínicas ----
  listClinics: (query: ClinicListQuery, signal?: AbortSignal) =>
    platformRequest('/clinics', { query, schema: clinicPageSchema, signal }),
  getClinic: (clinicId: string, signal?: AbortSignal) =>
    platformRequest(clinicPath(clinicId), { schema: clinicDetailSchema, signal }),
  createClinic: (input: CreateClinicInput) =>
    platformRequest('/clinics', { method: 'POST', body: input, schema: clinicDetailSchema }),
  suspendClinic: (clinicId: string, input: ReasonInput) =>
    platformRequest(`${clinicPath(clinicId)}/suspend`, {
      method: 'POST',
      body: input,
      schema: clinicDetailSchema,
    }),
  reactivateClinic: (clinicId: string, input: ReasonInput) =>
    platformRequest(`${clinicPath(clinicId)}/reactivate`, {
      method: 'POST',
      body: input,
      schema: clinicDetailSchema,
    }),
  changeSubscription: (clinicId: string, input: ChangeSubscriptionInput) =>
    platformRequest(`${clinicPath(clinicId)}/subscription`, {
      method: 'PUT',
      body: input,
      schema: clinicDetailSchema,
    }),
  changeSpecialty: (clinicId: string, input: ChangeSpecialtyInput) =>
    platformRequest(`${clinicPath(clinicId)}/specialty`, {
      method: 'PUT',
      body: input,
      schema: clinicDetailSchema,
    }),
  effectiveModules: (clinicId: string, signal?: AbortSignal) =>
    platformRequest(`${clinicPath(clinicId)}/effective-modules`, {
      schema: z.array(effectiveModuleSchema),
      signal,
    }),

  // ---- Catálogos ----
  listPlans: (signal?: AbortSignal) =>
    platformRequest('/plans', { schema: z.array(planSchema), signal }),
  listSpecialties: (signal?: AbortSignal) =>
    platformRequest('/specialties', { schema: z.array(specialtySchema), signal }),
};
