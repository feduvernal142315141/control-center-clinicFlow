'use client';

import { useQuery } from '@tanstack/react-query';
import { platformApi } from '../endpoints/platform';
import { queryKeys } from '../query-keys';

export function useMe() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: ({ signal }) => platformApi.me(signal),
    staleTime: 5 * 60_000,
  });
}
