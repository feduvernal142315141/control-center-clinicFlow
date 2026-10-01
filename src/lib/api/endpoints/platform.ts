import { z } from 'zod';
import { platformRequest } from '../client';
import {
  auditLogPageSchema,
  clinicDetailSchema,
  clinicOverridesSchema,
  clinicPageSchema,
  dashboardSchema,
  effectiveModuleSchema,
  planSchema,
  platformMeSchema,
  moduleUsageSchema,
  platformModuleSchema,
  platformUserSchema,
  specialtySchema,
  type ChangeSpecialtyInput,
  type ChangeSubscriptionInput,
  type AuditLogQuery,
  type ClinicListQuery,
  type ClinicOverridesUpdateInput,
  type ClinicStatusInput,
  type CreateClinicInput,
  type EffectivePreviewQuery,
  type ModuleCreateInput,
  type ModuleUpdateInput,
  type PlanCreateInput,
  type PlanModulesInput,
  type PlanUpdateInput,
  type UpdateClinicInput,
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
  updateClinic: (clinicId: string, input: UpdateClinicInput) =>
    platformRequest(clinicPath(clinicId), {
      method: 'PATCH',
      body: input,
      schema: clinicDetailSchema,
    }),
  suspendClinic: (clinicId: string, input: ClinicStatusInput) =>
    platformRequest(`${clinicPath(clinicId)}/suspend`, {
      method: 'POST',
      body: input,
      schema: clinicDetailSchema,
    }),
  reactivateClinic: (clinicId: string, input: ClinicStatusInput) =>
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
  /** Con `preview`, el backend devuelve cómo quedarían los módulos sin guardar nada. */
  effectiveModules: (clinicId: string, preview?: EffectivePreviewQuery, signal?: AbortSignal) =>
    platformRequest(`${clinicPath(clinicId)}/effective-modules`, {
      query: preview,
      schema: z.array(effectiveModuleSchema),
      signal,
    }),

  moduleOverrides: (clinicId: string, signal?: AbortSignal) =>
    platformRequest(`${clinicPath(clinicId)}/module-overrides`, {
      schema: clinicOverridesSchema,
      signal,
    }),
  updateModuleOverrides: (clinicId: string, input: ClinicOverridesUpdateInput) =>
    platformRequest(`${clinicPath(clinicId)}/module-overrides`, {
      method: 'PUT',
      body: input,
      schema: clinicOverridesSchema,
    }),

  // ---- Auditoría ----
  auditLogs: (query: AuditLogQuery, signal?: AbortSignal) =>
    platformRequest('/audit-logs', { query, schema: auditLogPageSchema, signal }),
  listUsers: (signal?: AbortSignal) =>
    platformRequest('/users', { schema: z.array(platformUserSchema), signal }),

  // ---- Planes ----
  listPlans: (signal?: AbortSignal) =>
    platformRequest('/plans', { schema: z.array(planSchema), signal }),
  getPlan: (planId: string, signal?: AbortSignal) =>
    platformRequest(`/plans/${encodeURIComponent(planId)}`, { schema: planSchema, signal }),
  createPlan: (input: PlanCreateInput) =>
    platformRequest('/plans', { method: 'POST', body: input, schema: planSchema }),
  updatePlan: (planId: string, input: PlanUpdateInput) =>
    platformRequest(`/plans/${encodeURIComponent(planId)}`, {
      method: 'PUT',
      body: input,
      schema: planSchema,
    }),
  updatePlanModules: (planId: string, input: PlanModulesInput) =>
    platformRequest(`/plans/${encodeURIComponent(planId)}/modules`, {
      method: 'PUT',
      body: input,
      schema: planSchema,
    }),

  // ---- Módulos ----
  listModules: (signal?: AbortSignal) =>
    platformRequest('/modules', { schema: z.array(platformModuleSchema), signal }),
  createModule: (input: ModuleCreateInput) =>
    platformRequest('/modules', { method: 'POST', body: input, schema: platformModuleSchema }),
  updateModule: (moduleId: string, input: ModuleUpdateInput) =>
    platformRequest(`/modules/${encodeURIComponent(moduleId)}`, {
      method: 'PUT',
      body: input,
      schema: platformModuleSchema,
    }),
  moduleUsage: (moduleId: string, signal?: AbortSignal) =>
    platformRequest(`/modules/${encodeURIComponent(moduleId)}/usage`, {
      schema: moduleUsageSchema,
      signal,
    }),

  // ---- Especialidades ----
  listSpecialties: (signal?: AbortSignal) =>
    platformRequest('/specialties', { schema: z.array(specialtySchema), signal }),
};
