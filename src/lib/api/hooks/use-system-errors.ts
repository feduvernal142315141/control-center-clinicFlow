'use client';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { platformApi } from '../endpoints/platform';
import { queryKeys } from '../query-keys';
import type { SystemErrorLogQuery } from '../schemas';

export function useSystemErrorLogs(query: SystemErrorLogQuery) {
  return useQuery({ queryKey: queryKeys.systemErrorLogs(query), queryFn: ({ signal }) => platformApi.systemErrorLogs(query, signal), placeholderData: keepPreviousData });
}
