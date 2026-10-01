import type { EffectiveModule, ModuleOverride } from '@/lib/api/schemas';
import type { MockDb } from './db';

/**
 * Cálculo de módulos efectivos DEL BACKEND FALSO. La app nunca calcula esto:
 * solo lo muestra. Precedencia (primera regla que aplica gana):
 * suspendida → inactivo → kill switch → especialidad → core → override → plan → dependencias.
 */
export function resolveEffectiveModules(db: MockDb, clinicId: string, now = new Date()) {
  const clinic = db.clinics.find((c) => c.id === clinicId);
  if (!clinic) return null;

  const plan = db.plans.find((p) => p.code === clinic.planCode);
  const overrides = (db.overrides[clinicId] ?? []).filter(
    (o) => o.expiresAt === null || new Date(o.expiresAt) > now,
  );
  const overrideOf = (code: string): ModuleOverride | undefined =>
    overrides.find((o) => o.moduleCode === code);
  const blocked =
    clinic.operationalStatus === 'SUSPENDED' || clinic.operationalStatus === 'INACTIVE';

  const rows: EffectiveModule[] = db.modules.map((m) => {
    const override = overrideOf(m.code);
    const base = {
      code: m.code,
      name: m.name,
      category: m.category,
      requiredCore: m.requiredCore,
      ...(override ? { override } : {}),
    };
    const off = (deniedReason: EffectiveModule['deniedReason']): EffectiveModule => ({
      ...base,
      enabled: false,
      source: null,
      deniedReason,
    });
    const on = (source: EffectiveModule['source']): EffectiveModule => ({
      ...base,
      enabled: true,
      source,
      deniedReason: null,
    });

    if (blocked) return off('CLINIC_SUSPENDED');
    if (!m.active) return off('MODULE_INACTIVE');
    if (db.killSwitches.has(m.code)) return off('FLAG_KILL_SWITCH');
    if (
      m.compatibleSpecialties.length > 0 &&
      !m.compatibleSpecialties.includes(clinic.specialtyCode)
    )
      return off('SPECIALTY_INCOMPATIBLE');
    if (m.requiredCore) return on('REQUIRED_CORE');
    if (override) return override.enabled ? on('OVERRIDE') : off('OVERRIDE_OFF');
    if (plan?.modules.some((pm) => pm.moduleCode === m.code && pm.enabled)) return on('PLAN');
    return off('NOT_IN_PLAN');
  });

  // Dependencias: apagar hasta punto fijo los que dependen de algo que quedó OFF.
  const byCode = new Map(rows.map((r) => [r.code, r]));
  const deps = new Map(db.modules.map((m) => [m.code, m.dependsOn]));
  let changed = true;
  while (changed) {
    changed = false;
    for (const row of rows) {
      if (!row.enabled) continue;
      const missing = (deps.get(row.code) ?? []).filter((d) => !byCode.get(d)?.enabled);
      if (missing.length > 0) {
        Object.assign(row, {
          enabled: false,
          source: null,
          deniedReason: 'MISSING_DEPENDENCY',
          missingDependencies: missing,
        });
        changed = true;
      }
    }
  }
  return rows;
}

/** Devuelve el ciclo (lista de códigos) si `code → dependsOn` crea uno. */
export function findDependencyCycle(
  db: MockDb,
  code: string,
  dependsOn: string[],
): string[] | null {
  const graph = new Map(db.modules.map((m) => [m.code, m.dependsOn]));
  graph.set(code, dependsOn);
  const visit = (current: string, path: string[]): string[] | null => {
    for (const next of graph.get(current) ?? []) {
      if (next === code) return [...path, next];
      if (path.includes(next)) continue;
      const found = visit(next, [...path, next]);
      if (found) return found;
    }
    return null;
  };
  return visit(code, [code]);
}
