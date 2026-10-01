import type { ClinicListQuery, EffectivePreviewQuery } from './schemas';

export const queryKeys = {
  me: ['platform', 'me'] as const,
  dashboard: ['platform', 'dashboard'] as const,
  clinics: {
    all: ['platform', 'clinics'] as const,
    list: (query: ClinicListQuery) => ['platform', 'clinics', 'list', query] as const,
    detail: (clinicId: string) => ['platform', 'clinics', 'detail', clinicId] as const,
    effectiveModules: (clinicId: string) =>
      ['platform', 'clinics', 'detail', clinicId, 'effective-modules'] as const,
    effectivePreview: (clinicId: string, preview: EffectivePreviewQuery) =>
      ['platform', 'clinics', 'detail', clinicId, 'effective-modules', 'preview', preview] as const,
  },
  plans: ['platform', 'plans'] as const,
  plan: (planId: string) => ['platform', 'plans', planId] as const,
  modules: ['platform', 'modules'] as const,
  moduleUsage: (moduleId: string) => ['platform', 'modules', moduleId, 'usage'] as const,
  specialties: ['platform', 'specialties'] as const,
  auditLogs: ['platform', 'audit-logs'] as const,
};
