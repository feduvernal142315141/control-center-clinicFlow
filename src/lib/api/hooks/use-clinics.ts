'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { platformApi } from '../endpoints/platform';
import { queryKeys } from '../query-keys';
import type {
  ChangeSpecialtyInput,
  ChangeSubscriptionInput,
  ClinicDetail,
  ClinicListQuery,
  ClinicOverridesUpdateInput,
  ClinicStatusInput,
  EffectivePreviewQuery,
  UpdateClinicInput,
} from '../schemas';

export function useDashboard() {
  return useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: ({ signal }) => platformApi.dashboard(signal),
  });
}

export function useClinics(query: ClinicListQuery) {
  return useQuery({
    queryKey: queryKeys.clinics.list(query),
    queryFn: ({ signal }) => platformApi.listClinics(query, signal),
    placeholderData: keepPreviousData,
  });
}

export function useClinic(clinicId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.clinics.detail(clinicId),
    queryFn: ({ signal }) => platformApi.getClinic(clinicId, signal),
    enabled: enabled && !!clinicId,
  });
}

export function useEffectiveModules(clinicId: string) {
  return useQuery({
    queryKey: queryKeys.clinics.effectiveModules(clinicId),
    queryFn: ({ signal }) => platformApi.effectiveModules(clinicId, undefined, signal),
  });
}

/** Vista previa del backend: módulos si la clínica tuviera otra especialidad/plan. */
export function useEffectivePreview(clinicId: string, preview: EffectivePreviewQuery) {
  const enabled = !!(preview.specialtyCode || preview.planCode);
  return useQuery({
    queryKey: queryKeys.clinics.effectivePreview(clinicId, preview),
    queryFn: ({ signal }) => platformApi.effectiveModules(clinicId, preview, signal),
    enabled,
  });
}

/** Tras cualquier cambio de una clínica: detalle, módulos efectivos, listas, KPIs y auditoría. */
function useInvalidateClinic() {
  const qc = useQueryClient();
  return (clinic: ClinicDetail) => {
    qc.setQueryData(queryKeys.clinics.detail(clinic.id), clinic);
    return Promise.all([
      qc.invalidateQueries({ queryKey: queryKeys.clinics.all }),
      qc.invalidateQueries({ queryKey: queryKeys.dashboard }),
      qc.invalidateQueries({ queryKey: queryKeys.auditLogs }),
    ]);
  };
}

export function useCreateClinic() {
  const invalidate = useInvalidateClinic();
  return useMutation({
    mutationFn: platformApi.createClinic,
    meta: { errorToast: false }, // el formulario muestra errores por campo
    onSuccess: invalidate,
  });
}

export function useUpdateClinic(clinicId: string) {
  const invalidate = useInvalidateClinic();
  return useMutation({
    mutationFn: (input: UpdateClinicInput) => platformApi.updateClinic(clinicId, input),
    meta: { errorToast: 'No se pudo actualizar la clínica' },
    onSuccess: invalidate,
  });
}

export function useSuspendClinic(clinicId: string) {
  const invalidate = useInvalidateClinic();
  return useMutation({
    mutationFn: (input: ClinicStatusInput) => platformApi.suspendClinic(clinicId, input),
    meta: { errorToast: 'No se pudo suspender la clínica' },
    onSuccess: invalidate,
  });
}

export function useReactivateClinic(clinicId: string) {
  const invalidate = useInvalidateClinic();
  return useMutation({
    mutationFn: (input: ClinicStatusInput) => platformApi.reactivateClinic(clinicId, input),
    meta: { errorToast: 'No se pudo reactivar la clínica' },
    onSuccess: invalidate,
  });
}

export function useChangeSubscription(clinicId: string) {
  const invalidate = useInvalidateClinic();
  return useMutation({
    mutationFn: (input: ChangeSubscriptionInput) => platformApi.changeSubscription(clinicId, input),
    meta: { errorToast: 'No se pudo cambiar el plan' },
    onSuccess: invalidate,
  });
}

export function useChangeSpecialty(clinicId: string) {
  const invalidate = useInvalidateClinic();
  return useMutation({
    mutationFn: (input: ChangeSpecialtyInput) => platformApi.changeSpecialty(clinicId, input),
    meta: { errorToast: 'No se pudo cambiar la especialidad' },
    onSuccess: invalidate,
  });
}

export function useModuleOverrides(clinicId: string) {
  return useQuery({
    queryKey: queryKeys.clinics.overrides(clinicId),
    queryFn: ({ signal }) => platformApi.moduleOverrides(clinicId, signal),
  });
}

/**
 * Guarda la lista completa de overrides (D18). Después refresca la clínica (versión),
 * sus módulos efectivos y la auditoría.
 */
export function useUpdateModuleOverrides(clinicId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ClinicOverridesUpdateInput) =>
      platformApi.updateModuleOverrides(clinicId, input),
    meta: { errorToast: false }, // el diálogo muestra el error
    onSuccess: (saved) => {
      qc.setQueryData(queryKeys.clinics.overrides(clinicId), saved);
      return Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.clinics.detail(clinicId) }),
        qc.invalidateQueries({ queryKey: queryKeys.clinics.all }),
        qc.invalidateQueries({ queryKey: queryKeys.dashboard }),
        qc.invalidateQueries({ queryKey: queryKeys.auditLogs }),
      ]);
    },
  });
}
