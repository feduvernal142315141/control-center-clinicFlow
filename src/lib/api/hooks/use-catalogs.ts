'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { platformApi } from '../endpoints/platform';
import { queryKeys } from '../query-keys';

export function usePlans() {
  return useQuery({
    queryKey: queryKeys.plans,
    queryFn: ({ signal }) => platformApi.listPlans(signal),
    staleTime: 5 * 60_000,
  });
}

export function useSpecialties() {
  return useQuery({
    queryKey: queryKeys.specialties,
    queryFn: ({ signal }) => platformApi.listSpecialties(signal),
    staleTime: 5 * 60_000,
  });
}

/** Nombre legible para un código; si el catálogo no cargó, se muestra el código. */
export function useCatalogNames() {
  const plans = usePlans();
  const specialties = useSpecialties();
  return useMemo(() => {
    const planNames = new Map(plans.data?.map((p) => [p.code, p.name]));
    const specialtyNames = new Map(specialties.data?.map((s) => [s.code, s.name]));
    return {
      planName: (code: string | null) => (code ? (planNames.get(code) ?? code) : 'Sin plan'),
      specialtyName: (code: string) => specialtyNames.get(code) ?? code,
    };
  }, [plans.data, specialties.data]);
}
