import { z } from 'zod';
import { isoDateTime } from './common';

export const systemErrorLogSchema = z.object({
  id: z.string(),
  occurredAt: isoDateTime,
  clinicId: z.string().nullable(),
  clinicName: z.string().nullable(),
  userId: z.string().nullable(),
  userEmail: z.string().nullable(),
  exceptionClass: z.string(),
  message: z.string().nullable(),
  stackTrace: z.string(),
  httpStatus: z.number().int(),
  requestMethod: z.string().nullable(),
  requestPath: z.string().nullable(),
  operationName: z.string().nullable(),
  source: z.string(),
});
export type SystemErrorLog = z.infer<typeof systemErrorLogSchema>;
export const systemErrorLogPageSchema = z.object({
  content: z.array(systemErrorLogSchema),
  nextCursor: z.string().nullable(),
  hasNext: z.boolean(),
});
export const systemErrorLogQuerySchema = z.object({
  filters: z.array(z.string()).optional(),
  orders: z.array(z.string()).optional(),
  page: z.number().int().nonnegative().optional(),
  pageSize: z.number().int().positive().max(100).optional(),
});
export type SystemErrorLogQuery = z.infer<typeof systemErrorLogQuerySchema>;
