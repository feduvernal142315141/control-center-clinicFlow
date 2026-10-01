import type {
  DeniedReason,
  EffectiveModule,
  EffectiveSource,
  ModuleCategory,
  OperationalStatus,
  SubscriptionStatus,
} from './api/schemas';

/** Fechas en la zona horaria del navegador. El backend envía ISO 8601 con offset. */
const dateTimeFormat = new Intl.DateTimeFormat('es', { dateStyle: 'medium', timeStyle: 'short' });
const dateFormat = new Intl.DateTimeFormat('es', { dateStyle: 'medium' });

export const formatDateTime = (iso: string | null | undefined) =>
  iso ? dateTimeFormat.format(new Date(iso)) : '—';
export const formatDate = (iso: string | null | undefined) =>
  iso ? dateFormat.format(new Date(iso)) : '—';

export const OPERATIONAL_STATUS_LABEL: Record<OperationalStatus, string> = {
  ACTIVE: 'Activa',
  SUSPENDED: 'Suspendida',
  INACTIVE: 'Inactiva',
};

export const SUBSCRIPTION_STATUS_LABEL: Record<SubscriptionStatus, string> = {
  ACTIVE: 'Activa',
  TRIAL: 'Trial',
  PAST_DUE: 'Pago vencido',
  CANCELED: 'Cancelada',
};

export const MODULE_CATEGORY_LABEL: Record<ModuleCategory, string> = {
  CORE: 'Core',
  COMMS: 'Comunicaciones',
  AI: 'IA',
  MARKETING: 'Marketing',
  GROWTH: 'Crecimiento',
  SPECIALTY: 'Especialidad',
};

export const EFFECTIVE_SOURCE_LABEL: Record<EffectiveSource, string> = {
  REQUIRED_CORE: 'Siempre ON (core)',
  PLAN: 'Incluido en el plan',
  OVERRIDE: 'Override',
};

const DENIED_REASON_LABEL: Record<DeniedReason, string> = {
  CLINIC_SUSPENDED: 'la clínica está suspendida o inactiva',
  MODULE_INACTIVE: 'módulo desactivado en el catálogo',
  FLAG_KILL_SWITCH: 'apagado globalmente (kill switch)',
  SPECIALTY_INCOMPATIBLE: 'no es compatible con la especialidad de la clínica',
  OVERRIDE_OFF: 'apagado por override',
  NOT_IN_PLAN: 'no está incluido en el plan',
  MISSING_DEPENDENCY: 'falta dependencia',
};

const warnedUnknownReasons = new Set<string>();

const isKnownDeniedReason = (reason: string): reason is DeniedReason =>
  Object.hasOwn(DENIED_REASON_LABEL, reason);

/**
 * Por qué un módulo está OFF, en texto para operaciones. Solo traduce lo que manda
 * el backend: nunca recalcula nada. Un código desconocido no rompe la UI.
 */
export function deniedReasonText(m: Pick<EffectiveModule, 'deniedReason' | 'missingDependencies'>) {
  if (!m.deniedReason) return null;
  if (!isKnownDeniedReason(m.deniedReason)) {
    if (!warnedUnknownReasons.has(m.deniedReason)) {
      warnedUnknownReasons.add(m.deniedReason);
      console.warn(`[contrato] deniedReason no reconocido: ${m.deniedReason}`);
    }
    return `OFF: Motivo no reconocido: ${m.deniedReason}`;
  }
  const base = `OFF: ${DENIED_REASON_LABEL[m.deniedReason]}`;
  if (m.deniedReason === 'MISSING_DEPENDENCY' && m.missingDependencies?.length) {
    return `${base} ${m.missingDependencies.join(', ')}`;
  }
  return base;
}

export function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
