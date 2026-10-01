import { z } from 'zod';
import { isoDateTime, pageSchema } from './common';

/**
 * Acciones conocidas. `action` es un string abierto: una acción nueva del backend se muestra
 * con su código, sin romper (D19, igual que D9).
 */
export const KNOWN_AUDIT_ACTIONS = [
  'CLINIC_CREATED',
  'CLINIC_RENAMED',
  'PLAN_CHANGED',
  'SPECIALTY_CHANGED',
  'CLINIC_SUSPENDED',
  'CLINIC_REACTIVATED',
  'MODULE_OVERRIDE_SET',
  'MODULE_OVERRIDE_REMOVED',
  'PLAN_CREATED',
  'PLAN_UPDATED',
  'PLAN_MODULES_UPDATED',
  'MODULE_CREATED',
  'MODULE_UPDATED',
  'MODULE_DEACTIVATED',
] as const;
export type KnownAuditAction = (typeof KNOWN_AUDIT_ACTIONS)[number];

export const auditLogSchema = z.object({
  id: z.string(),
  actor: z.object({ id: z.string(), email: z.string() }),
  action: z.string().min(1),
  clinicId: z.string().nullable(),
  /** Nombre de la clínica al momento de consultar (para mostrar sin otra llamada). */
  clinicName: z.string().nullable(),
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

/** Usuarios KodeWave (actores de auditoría). */
export const platformUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  fullName: z.string(),
});
export type PlatformUser = z.infer<typeof platformUserSchema>;
