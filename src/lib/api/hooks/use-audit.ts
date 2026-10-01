'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { platformApi } from '../endpoints/platform';
import { queryKeys } from '../query-keys';
import type { AuditLogQuery } from '../schemas';

export function useAuditLogs(query: AuditLogQuery) {
  return useQuery({
    queryKey: queryKeys.auditLogList(query),
    queryFn: ({ signal }) => platformApi.auditLogs(query, signal),
    placeholderData: keepPreviousData,
  });
}

export function usePlatformUsers() {
  return useQuery({
    queryKey: queryKeys.users,
    queryFn: ({ signal }) => platformApi.listUsers(signal),
    staleTime: 10 * 60_000,
  });
}
