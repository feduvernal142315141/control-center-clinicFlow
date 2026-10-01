import { z } from 'zod';
import { isoDateTime, pageSchema } from './common';

export const auditLogSchema = z.object({
  id: z.string(),
  actor: z.object({ id: z.string(), email: z.string() }),
  action: z.string(),
  clinicId: z.string().nullable(),
  entityType: z.string(),
  entityId: z.string(),
  before: z.unknown(),
  after: z.unknown(),
  reason: z.string().nullable(),
  ip: z.string().nullable(),
  createdAt: isoDateTime,
});
export type AuditLog = z.infer<typeof auditLogSchema>;

export const auditLogPageSchema = pageSchema(auditLogSchema);

export const auditLogQuerySchema = z.object({
  clinicId: z.string().optional(),
  actorId: z.string().optional(),
  action: z.string().optional(),
  from: isoDateTime.optional(),
  to: isoDateTime.optional(),
  page: z.number().int().nonnegative().optional(),
  size: z.number().int().positive().max(100).optional(),
});
export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;
