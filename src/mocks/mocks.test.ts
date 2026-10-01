// @vitest-environment node
import { getResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  auditLogSchema,
  clinicDetailSchema,
  effectiveModuleSchema,
  planSchema,
  platformModuleSchema,
  specialtySchema,
} from '@/lib/api/schemas';
import { MOCK_PASSWORD } from './data';
import { getDb, resetDb } from './db';
import { resolveEffectiveModules } from './effective';
import { createPlatformHandlers } from './handlers';

const BASE = 'http://platform.mock';
const handlers = createPlatformHandlers(BASE);

async function call(path: string, init: RequestInit & { token?: string } = {}) {
  const headers = new Headers(init.headers);
  if (init.token) headers.set('authorization', `Bearer ${init.token}`);
  if (init.body) headers.set('content-type', 'application/json');
  const res = await getResponse(
    handlers,
    new Request(`${BASE}/platform${path}`, { ...init, headers }),
  );
  if (!res) throw new Error(`Sin handler para ${path}`);
  return res;
}

async function login() {
  const res = await call('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@kodewave.com', password: MOCK_PASSWORD }),
  });
  return ((await res.json()) as { accessToken: string }).accessToken;
}

const effective = (clinicId: string) =>
  Object.fromEntries(resolveEffectiveModules(getDb(), clinicId)!.map((m) => [m.code, m]));

beforeEach(() => {
  resetDb();
});

describe('datos semilla cumplen los contratos zod', () => {
  it('clínicas, planes, módulos, especialidades y auditoría', () => {
    const db = getDb();
    db.clinics.forEach((c) => clinicDetailSchema.parse(c));
    db.plans.forEach((p) => planSchema.parse(p));
    db.modules.forEach((m) => platformModuleSchema.parse(m));
    db.specialties.forEach((s) => specialtySchema.parse(s));
    db.auditLogs.forEach((a) => auditLogSchema.parse(a));
  });

  it('módulos efectivos de todas las clínicas', () => {
    for (const c of getDb().clinics) {
      resolveEffectiveModules(getDb(), c.id)!.forEach((m) => effectiveModuleSchema.parse(m));
    }
  });

  it('LEGACY_DENTAL existe y tiene la matriz completa', () => {
    const legacy = getDb().plans.find((p) => p.code === 'LEGACY_DENTAL')!;
    expect(legacy.modules).toHaveLength(getDb().modules.length);
  });
});

describe('escenarios de módulos efectivos', () => {
  it("D'Armas (DENTAL, PREMIUM): dentales ON por plan, core ON por REQUIRED_CORE", () => {
    const m = effective('c-darmas');
    expect(m.DENTAL_ODONTOGRAM).toMatchObject({ enabled: true, source: 'PLAN' });
    expect(m.CORE_PATIENTS).toMatchObject({ enabled: true, source: 'REQUIRED_CORE' });
    expect(m.AI_CLINICAL_NOTES).toMatchObject({ enabled: false, deniedReason: 'MODULE_INACTIVE' });
    expect(m.GROWTH_REVIEWS).toMatchObject({ enabled: false, deniedReason: 'FLAG_KILL_SWITCH' });
  });

  it('Centro Podológico X: DENTAL_* OFF por SPECIALTY_INCOMPATIBLE', () => {
    const m = effective('c-podologico-x');
    for (const code of ['DENTAL_ODONTOGRAM', 'DENTAL_TREATMENT_PLANS', 'DENTAL_PERIODONTOGRAM']) {
      expect(m[code]).toMatchObject({ enabled: false, deniedReason: 'SPECIALTY_INCOMPATIBLE' });
    }
    expect(m.PODIATRY_FOOT_EXAM).toMatchObject({ enabled: true, source: 'PLAN' });
    expect(m.AI_RECEPTIONIST).toMatchObject({ enabled: false, deniedReason: 'NOT_IN_PLAN' });
  });

  it('clínica suspendida: todo OFF, incluido core', () => {
    const rows = resolveEffectiveModules(getDb(), 'c-sonrisas-norte')!;
    expect(rows.every((r) => !r.enabled && r.deniedReason === 'CLINIC_SUSPENDED')).toBe(true);
  });

  it('Lara: override OFF y dependencia faltante con el detalle', () => {
    const m = effective('c-lara');
    expect(m.COMMS_WHATSAPP).toMatchObject({ enabled: false, deniedReason: 'OVERRIDE_OFF' });
    expect(m.AI_RECEPTIONIST).toMatchObject({
      enabled: false,
      deniedReason: 'MISSING_DEPENDENCY',
      missingDependencies: ['COMMS_WHATSAPP'],
    });
    expect(m.AI_RECEPTIONIST.override?.enabled).toBe(true);
  });
});

describe('handlers', () => {
  it('rechaza requests sin token de plataforma', async () => {
    const res = await call('/clinics');
    expect(res.status).toBe(401);
  });

  it('lista clínicas filtradas y paginadas', async () => {
    const token = await login();
    const res = await call('/clinics?specialtyCode=PODIATRY&size=2', { token });
    const page = await res.json();
    expect(page.size).toBe(2);
    expect(
      page.content.every((c: { specialtyCode: string }) => c.specialtyCode === 'PODIATRY'),
    ).toBe(true);
    expect(page.totalElements).toBeGreaterThan(2);
  });

  it('suspender exige motivo y deja auditoría', async () => {
    const token = await login();
    const bad = await call('/clinics/c-darmas/suspend', {
      method: 'POST',
      token,
      body: JSON.stringify({ reason: '' }),
    });
    expect(bad.status).toBe(400);
    const ok = await call('/clinics/c-darmas/suspend', {
      method: 'POST',
      token,
      body: JSON.stringify({ reason: 'Falta de pago de tres meses' }),
    });
    expect((await ok.json()).operationalStatus).toBe('SUSPENDED');
    expect(getDb().auditLogs[0]).toMatchObject({
      action: 'CLINIC_SUSPENDED',
      clinicId: 'c-darmas',
      reason: 'Falta de pago de tres meses',
    });
  });

  it('REQUIRED_CORE_IMMUTABLE al apagar un core en la matriz del plan', async () => {
    const token = await login();
    const res = await call('/plans/p-basic/modules', {
      method: 'PUT',
      token,
      body: JSON.stringify({ modules: [{ moduleCode: 'CORE_PATIENTS', enabled: false }] }),
    });
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('REQUIRED_CORE_IMMUTABLE');
  });

  it('REQUIRED_CORE_IMMUTABLE al poner override OFF a un core', async () => {
    const token = await login();
    const res = await call('/clinics/c-darmas/module-overrides', {
      method: 'PUT',
      token,
      body: JSON.stringify([
        {
          moduleCode: 'CORE_PATIENTS',
          enabled: false,
          reason: 'Intento de apagar core',
          expiresAt: null,
        },
      ]),
    });
    expect((await res.json()).code).toBe('REQUIRED_CORE_IMMUTABLE');
  });

  it('MODULE_DEPENDENCY_SELF y MODULE_DEPENDENCY_CYCLE', async () => {
    const token = await login();
    const odontogram = getDb().modules.find((m) => m.code === 'DENTAL_ODONTOGRAM')!;
    const { id: _id, ...input } = odontogram;
    const self = await call(`/modules/${odontogram.id}`, {
      method: 'PUT',
      token,
      body: JSON.stringify({ ...input, dependsOn: ['DENTAL_ODONTOGRAM'] }),
    });
    expect((await self.json()).code).toBe('MODULE_DEPENDENCY_SELF');
    const cycle = await call(`/modules/${odontogram.id}`, {
      method: 'PUT',
      token,
      body: JSON.stringify({ ...input, dependsOn: ['DENTAL_TREATMENT_PLANS'] }),
    });
    const body = await cycle.json();
    expect(body.code).toBe('MODULE_DEPENDENCY_CYCLE');
    expect(body.details.cycle).toEqual([
      'DENTAL_ODONTOGRAM',
      'DENTAL_TREATMENT_PLANS',
      'DENTAL_ODONTOGRAM',
    ]);
  });

  it('crear clínica con slug repetido → VALIDATION_ERROR por campo', async () => {
    const token = await login();
    const res = await call('/clinics', {
      method: 'POST',
      token,
      body: JSON.stringify({
        name: 'Otra',
        slug: 'clinica-dental-darmas',
        specialtyCode: 'DENTAL',
        planCode: 'PRO',
        trial: false,
        admin: { fullName: 'Admin', email: 'admin@otra.com' },
      }),
    });
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.details.fields[0].field).toBe('slug');
  });

  it('login bloquea tras 5 intentos fallidos (RATE_LIMITED)', async () => {
    const attempt = () =>
      call('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'admin@kodewave.com', password: 'mal' }),
      });
    for (let i = 0; i < 5; i++) expect((await attempt()).status).toBe(401);
    expect((await attempt()).status).toBe(429);
  });
});
