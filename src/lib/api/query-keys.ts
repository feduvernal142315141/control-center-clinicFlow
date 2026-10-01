import type { ClinicListQuery } from './schemas';

export const queryKeys = {
  me: ['platform', 'me'] as const,
  dashboard: ['platform', 'dashboard'] as const,
  clinics: {
    all: ['platform', 'clinics'] as const,
    list: (query: ClinicListQuery) => ['platform', 'clinics', 'list', query] as const,
    detail: (clinicId: string) => ['platform', 'clinics', 'detail', clinicId] as const,
    effectiveModules: (clinicId: string) =>
      ['platform', 'clinics', 'detail', clinicId, 'effective-modules'] as const,
  },
  plans: ['platform', 'plans'] as const,
  specialties: ['platform', 'specialties'] as const,
  auditLogs: ['platform', 'audit-logs'] as const,
};
