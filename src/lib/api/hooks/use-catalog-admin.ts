'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { platformApi } from '../endpoints/platform';
import { queryKeys } from '../query-keys';
import type { ModuleUpdateInput, PlanModulesInput, PlanUpdateInput, ReasonInput } from '../schemas';

export function useModules() {
  return useQuery({
    queryKey: queryKeys.modules,
    queryFn: ({ signal }) => platformApi.listModules(signal),
  });
}

export function usePlan(planId: string) {
  return useQuery({
    queryKey: queryKeys.plan(planId),
    queryFn: ({ signal }) => platformApi.getPlan(planId, signal),
  });
}

/**
 * Planes y módulos afectan a los módulos efectivos de todas las clínicas,
 * a los conteos de especialidades y a la auditoría.
 */
function useInvalidateCatalog() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: queryKeys.plans }),
      qc.invalidateQueries({ queryKey: queryKeys.modules }),
      qc.invalidateQueries({ queryKey: queryKeys.specialties }),
      qc.invalidateQueries({ queryKey: queryKeys.clinics.all }),
      qc.invalidateQueries({ queryKey: queryKeys.dashboard }),
      qc.invalidateQueries({ queryKey: queryKeys.auditLogs }),
    ]);
}

export function useCreatePlan() {
  const invalidate = useInvalidateCatalog();
  return useMutation({
    mutationFn: platformApi.createPlan,
    meta: { errorToast: false }, // errores por campo en el formulario
    onSuccess: invalidate,
  });
}

export function useUpdatePlan(planId: string) {
  const invalidate = useInvalidateCatalog();
  return useMutation({
    mutationFn: (input: PlanUpdateInput) => platformApi.updatePlan(planId, input),
    meta: { errorToast: false },
    onSuccess: invalidate,
  });
}

export function useUpdatePlanModules(planId: string) {
  const invalidate = useInvalidateCatalog();
  return useMutation({
    mutationFn: (input: PlanModulesInput) => platformApi.updatePlanModules(planId, input),
    meta: { errorToast: 'No se pudo guardar la matriz del plan' },
    onSuccess: invalidate,
  });
}

export function useCreateModule() {
  const invalidate = useInvalidateCatalog();
  return useMutation({
    mutationFn: platformApi.createModule,
    meta: { errorToast: false }, // el editor muestra errores de dependencias y por campo
    onSuccess: invalidate,
  });
}

export function useUpdateModule(moduleId: string) {
  const invalidate = useInvalidateCatalog();
  return useMutation({
    mutationFn: (input: ModuleUpdateInput) => platformApi.updateModule(moduleId, input),
    meta: { errorToast: false },
    onSuccess: invalidate,
  });
}

export function useDeleteModule(moduleId: string) {
  const invalidate = useInvalidateCatalog();
  return useMutation({
    mutationFn: (input: ReasonInput) => platformApi.deleteModule(moduleId, input),
    meta: { errorToast: false },
    onSuccess: invalidate,
  });
}
