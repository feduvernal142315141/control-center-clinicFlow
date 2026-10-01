import { http, HttpResponse, type RequestHandler } from 'msw';
import type { z } from 'zod';
import {
  changeSpecialtyInputSchema,
  changeSubscriptionInputSchema,
  createClinicInputSchema,
  moduleCreateInputSchema,
  moduleUpdateInputSchema,
  planCreateInputSchema,
  planUpdateInputSchema,
  planModulesInputSchema,
  clinicStatusInputSchema,
  clinicOverridesUpdateInputSchema,
  updateClinicInputSchema,
  type ClinicDetail,
  type Dashboard,
  type ModuleOverride,
  type Page,
  type PlanModule,
  type PlatformMe,
} from '@/lib/api/schemas';
import { MOCK_TOTP_CODE, type MockUser } from './data';
import { getDb, nextId, type MockDb, type StoredAuditLog } from './db';
import { findDependencyCycle, resolveEffectiveModules } from './effective';

const ACCESS_TTL_SECONDS = Number(process.env.MOCK_ACCESS_TTL_SECONDS ?? 15 * 60);
const REFRESH_TTL_SECONDS = 8 * 60 * 60;
const MAX_FAILED_LOGINS = 5;

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

const err = (status: number, code: string, message: string, details?: unknown) =>
  HttpResponse.json({ code, message, ...(details !== undefined ? { details } : {}) }, { status });

const notFound = (what: string) => err(404, 'NOT_FOUND', `${what} no encontrado.`);

const token = (prefix: string) => `${prefix}.${crypto.randomUUID()}`;

function issueTokens(db: MockDb, userId: string) {
  const accessToken = token('mock-at');
  const refreshToken = token('mock-rt');
  db.accessTokens.set(accessToken, { userId, expiresAt: Date.now() + ACCESS_TTL_SECONDS * 1000 });
  db.refreshTokens.set(refreshToken, userId);
  return {
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TTL_SECONDS,
    refreshExpiresIn: REFRESH_TTL_SECONDS,
  };
}

function currentUser(db: MockDb, request: Request): MockUser | null {
  const auth = request.headers.get('authorization');
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  const session = bearer ? db.accessTokens.get(bearer) : undefined;
  if (!session || session.expiresAt < Date.now()) return null;
  return db.users.find((u) => u.id === session.userId) ?? null;
}

async function parseBody<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<{ data: z.infer<S> } | { response: Response }> {
  const json = await request.json().catch(() => undefined);
  const parsed = schema.safeParse(json);
  if (parsed.success) return { data: parsed.data };
  return {
    response: err(400, 'VALIDATION_ERROR', 'Datos inválidos.', {
      fields: parsed.error.issues.map((i) => ({
        field: i.path.map(String).join('.'),
        message: i.message,
      })),
    }),
  };
}

function audit(
  db: MockDb,
  request: Request,
  user: MockUser,
  entry: Pick<
    StoredAuditLog,
    'action' | 'clinicId' | 'entityType' | 'entityId' | 'before' | 'after'
  > & {
    reason?: string | null;
  },
) {
  db.auditLogs.unshift({
    id: nextId(db, 'a'),
    actor: { id: user.id, email: user.email },
    reason: entry.reason ?? null,
    ip: request.headers.get('x-forwarded-for') ?? '127.0.0.1',
    createdAt: new Date().toISOString(),
    ...entry,
  });
}

function paginate<T>(items: T[], url: URL): Page<T> {
  const page = Math.max(0, Number(url.searchParams.get('page') ?? 0) || 0);
  const size = Math.min(100, Math.max(1, Number(url.searchParams.get('size') ?? 20) || 20));
  return {
    content: items.slice(page * size, page * size + size),
    page,
    size,
    totalElements: items.length,
    totalPages: Math.ceil(items.length / size),
  };
}

const summary = ({ subscription: _s, ...c }: ClinicDetail) => c;

type Ctx = { db: MockDb; user: MockUser; request: Request; params: Record<string, string> };

export interface PlatformHandlersOptions {
  /** Solo tests de componentes: acepta requests sin Bearer como el primer usuario. */
  skipAuth?: boolean;
}

let handlerOptions: PlatformHandlersOptions = {};

/**
 * D8: un trial vencido pasa a PAST_DUE y la clínica sigue ACTIVE. Nada se suspende solo.
 * En el backend real es un job; aquí se aplica al vuelo en cada request.
 */
export function expireTrials(db: MockDb, now = Date.now()) {
  for (const c of db.clinics) {
    const s = c.subscription;
    if (s?.trial && s.status === 'TRIAL' && s.endsAt && new Date(s.endsAt).getTime() < now) {
      s.status = 'PAST_DUE';
    }
  }
}

/** Envuelve un resolver que exige sesión de plataforma. */
function authed(resolver: (ctx: Ctx) => Response | Promise<Response>) {
  return ({ request, params }: { request: Request; params: Record<string, unknown> }) => {
    const db = getDb();
    expireTrials(db);
    const user = handlerOptions.skipAuth ? db.users[0] : currentUser(db, request);
    if (!user) return err(401, 'UNAUTHENTICATED', 'Token inválido o expirado.');
    return resolver({ db, user, request, params: params as Record<string, string> });
  };
}

const SEVEN_DAYS_MS = 7 * 86_400_000;

function trialLists(db: MockDb, now = Date.now()) {
  const item = (c: ClinicDetail) => ({
    clinicId: c.id,
    name: c.name,
    slug: c.slug,
    planCode: c.subscription!.planCode,
    endsAt: c.subscription!.endsAt!,
  });
  const trials = db.clinics.filter((c) => c.subscription?.trial && c.subscription.endsAt);
  const byEnd = (a: { endsAt: string }, b: { endsAt: string }) => a.endsAt.localeCompare(b.endsAt);
  return {
    expired: trials
      .filter((c) => c.subscription!.status === 'PAST_DUE')
      .map(item)
      .sort(byEnd),
    expiringSoon: trials
      .filter((c) => {
        const ends = new Date(c.subscription!.endsAt!).getTime();
        return c.subscription!.status === 'TRIAL' && ends >= now && ends <= now + SEVEN_DAYS_MS;
      })
      .map(item)
      .sort(byEnd),
  };
}

/** MODULE_DEPENDENCY_SELF / desconocida / MODULE_DEPENDENCY_CYCLE, o null si es válido. */
function validateDependencies(db: MockDb, code: string, dependsOn: string[]) {
  if (dependsOn.includes(code)) {
    return err(409, 'MODULE_DEPENDENCY_SELF', 'Un módulo no puede depender de sí mismo.', {
      cycle: [code, code],
    });
  }
  const unknown = dependsOn.filter((d) => !db.modules.some((m) => m.code === d));
  if (unknown.length) return notFound(`Dependencia ${unknown.join(', ')}`);
  const cycle = findDependencyCycle(db, code, dependsOn);
  if (cycle) {
    return err(409, 'MODULE_DEPENDENCY_CYCLE', `Ciclo de dependencias: ${cycle.join(' → ')}`, {
      cycle,
    });
  }
  return null;
}

/** D16: control de concurrencia optimista. */
function versionConflict(entity: string, currentVersion: number) {
  return err(
    409,
    'VERSION_CONFLICT',
    `${entity} fue modificado por otra persona. Recarga y vuelve a intentar.`,
    { currentVersion },
  );
}

/** D15: solo claves de `allowedLimits` del módulo. */
function validateLimits(db: MockDb, modules: PlanModule[]) {
  const fields: { field: string; message: string }[] = [];
  modules.forEach((pm, i) => {
    const allowed = db.modules.find((m) => m.code === pm.moduleCode)?.allowedLimits ?? [];
    for (const key of Object.keys(pm.limits ?? {})) {
      if (!allowed.some((l) => l.key === key)) {
        fields.push({
          field: `modules.${i}.limits.${key}`,
          message: `${pm.moduleCode} no admite el límite ${key}`,
        });
      }
    }
  });
  return fields.length ? err(400, 'VALIDATION_ERROR', 'Límites no permitidos.', { fields }) : null;
}

function findClinic(db: MockDb, id: string) {
  return db.clinics.find((c) => c.id === id);
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export function createPlatformHandlers(
  baseUrl: string,
  options: PlatformHandlersOptions = {},
): RequestHandler[] {
  handlerOptions = options;
  const u = (path: string) => `${baseUrl}/platform${path}`;

  return [
    // ---- Auth ----
    http.post(u('/auth/login'), async ({ request }) => {
      const db = getDb();
      const body = (await request.json().catch(() => ({}))) as {
        email?: string;
        password?: string;
      };
      const email = String(body.email ?? '').toLowerCase();
      const failed = db.failedLogins.get(email) ?? 0;
      if (failed >= MAX_FAILED_LOGINS) {
        return err(429, 'RATE_LIMITED', 'Demasiados intentos. Intenta de nuevo en 15 minutos.');
      }
      const user = db.users.find((x) => x.email === email);
      if (!user || user.password !== body.password) {
        db.failedLogins.set(email, failed + 1);
        return err(401, 'INVALID_CREDENTIALS', 'Correo o contraseña incorrectos.');
      }
      if (user.locked) {
        return err(423, 'ACCOUNT_LOCKED', 'La cuenta está bloqueada. Contacta a un administrador.');
      }
      db.failedLogins.delete(email);
      if (user.mfa) {
        const mfaToken = token('mock-mfa');
        db.mfaTokens.set(mfaToken, { userId: user.id, expiresAt: Date.now() + 5 * 60 * 1000 });
        return HttpResponse.json({ mfaRequired: true, mfaToken });
      }
      return HttpResponse.json(issueTokens(db, user.id));
    }),

    http.post(u('/auth/mfa/verify'), async ({ request }) => {
      const db = getDb();
      const body = (await request.json().catch(() => ({}))) as { mfaToken?: string; code?: string };
      const challenge = body.mfaToken ? db.mfaTokens.get(body.mfaToken) : undefined;
      if (!challenge || challenge.expiresAt < Date.now()) {
        return err(401, 'MFA_SESSION_EXPIRED', 'La verificación expiró. Inicia sesión de nuevo.');
      }
      if (body.code !== MOCK_TOTP_CODE) {
        return err(401, 'INVALID_MFA_CODE', 'Código incorrecto.');
      }
      db.mfaTokens.delete(body.mfaToken!);
      return HttpResponse.json(issueTokens(db, challenge.userId));
    }),

    http.post(u('/auth/refresh'), async ({ request }) => {
      const db = getDb();
      const body = (await request.json().catch(() => ({}))) as { refreshToken?: string };
      const userId = body.refreshToken ? db.refreshTokens.get(body.refreshToken) : undefined;
      if (!userId) return err(401, 'UNAUTHENTICATED', 'Refresh token inválido.');
      db.refreshTokens.delete(body.refreshToken!); // rotación
      return HttpResponse.json(issueTokens(db, userId));
    }),

    http.post(u('/auth/logout'), async ({ request }) => {
      const db = getDb();
      const body = (await request.json().catch(() => ({}))) as { refreshToken?: string };
      if (body.refreshToken) db.refreshTokens.delete(body.refreshToken);
      const auth = request.headers.get('authorization');
      if (auth?.startsWith('Bearer ')) db.accessTokens.delete(auth.slice(7));
      return new HttpResponse(null, { status: 204 });
    }),

    // ---- Me / dashboard ----
    http.get(
      u('/me'),
      authed(({ user }) =>
        HttpResponse.json<PlatformMe>({
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          roles: ['SUPER_ADMIN'],
          mfaEnabled: user.mfa,
        }),
      ),
    ),

    http.get(
      u('/dashboard'),
      authed(({ db }) => {
        const by = <K extends string>(key: (c: ClinicDetail) => K) => {
          const counts = new Map<K, number>();
          for (const c of db.clinics) counts.set(key(c), (counts.get(key(c)) ?? 0) + 1);
          return [...counts];
        };
        const status = (s: ClinicDetail['operationalStatus']) =>
          db.clinics.filter((c) => c.operationalStatus === s).length;
        return HttpResponse.json<Dashboard>({
          totalClinics: db.clinics.length,
          active: status('ACTIVE'),
          // El trial se cuenta desde la suscripción, no desde el estado operativo.
          trial: db.clinics.filter((c) => c.subscription?.status === 'TRIAL').length,
          suspended: status('SUSPENDED'),
          inactive: status('INACTIVE'),
          byPlan: by((c) => c.planCode ?? '__NONE__').map(([planCode, count]) => ({
            planCode: planCode === '__NONE__' ? null : planCode,
            count,
          })),
          bySpecialty: by((c) => c.specialtyCode).map(([specialtyCode, count]) => ({
            specialtyCode,
            count,
          })),
          trials: trialLists(db),
        });
      }),
    ),

    // ---- Clínicas ----
    http.get(
      u('/clinics'),
      authed(({ db, request }) => {
        const url = new URL(request.url);
        const q = url.searchParams.get('q')?.toLowerCase().trim();
        const status = url.searchParams.get('status');
        const planCode = url.searchParams.get('planCode');
        const specialtyCode = url.searchParams.get('specialtyCode');
        const trial = url.searchParams.get('trial');
        const items = db.clinics
          .filter(
            (c) =>
              (!q || c.name.toLowerCase().includes(q) || c.slug.includes(q)) &&
              (!status || c.operationalStatus === status) &&
              (!planCode || c.planCode === planCode) &&
              (!specialtyCode || c.specialtyCode === specialtyCode) &&
              (trial === null || c.trial === (trial === 'true')),
          )
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map(summary);
        return HttpResponse.json(paginate(items, url));
      }),
    ),

    http.post(
      u('/clinics'),
      authed(async ({ db, user, request }) => {
        const body = await parseBody(request, createClinicInputSchema);
        if ('response' in body) return body.response;
        const input = body.data;
        if (db.clinics.some((c) => c.slug === input.slug)) {
          return err(400, 'VALIDATION_ERROR', 'Datos inválidos.', {
            fields: [{ field: 'slug', message: 'Ese slug ya está en uso' }],
          });
        }
        const plan = db.plans.find((p) => p.code === input.planCode);
        if (!plan) return notFound('Plan');
        if (!db.specialties.some((s) => s.code === input.specialtyCode))
          return notFound('Especialidad');
        const now = new Date().toISOString();
        const id = nextId(db, 'c');
        const clinic: ClinicDetail = {
          id,
          name: input.name,
          slug: input.slug,
          specialtyCode: input.specialtyCode,
          operationalStatus: 'ACTIVE',
          planCode: plan.code,
          trial: input.trial,
          createdAt: now,
          version: 1,
          subscription: {
            id: nextId(db, 's'),
            planId: plan.id,
            planCode: plan.code,
            status: input.trial ? 'TRIAL' : 'ACTIVE',
            startsAt: now,
            endsAt: input.trial ? input.trialEndsAt : null,
            renewalDate: input.trial ? null : new Date(Date.now() + 30 * 86_400_000).toISOString(),
            trial: input.trial,
          },
        };
        db.clinics.push(clinic);
        audit(db, request, user, {
          action: 'CLINIC_CREATED',
          clinicId: id,
          entityType: 'Clinic',
          entityId: id,
          before: null,
          after: { ...clinic, admin: input.admin },
        });
        return HttpResponse.json(clinic, { status: 201 });
      }),
    ),

    http.get(
      u('/clinics/:clinicId'),
      authed(({ db, params }) => {
        const clinic = findClinic(db, params.clinicId);
        return clinic ? HttpResponse.json(clinic) : notFound('Clínica');
      }),
    ),

    http.patch(
      u('/clinics/:clinicId'),
      authed(async ({ db, user, request, params }) => {
        const clinic = findClinic(db, params.clinicId);
        if (!clinic) return notFound('Clínica');
        const body = await parseBody(request, updateClinicInputSchema);
        if ('response' in body) return body.response;
        if (body.data.version !== clinic.version)
          return versionConflict('La clínica', clinic.version);
        const before = { name: clinic.name };
        clinic.name = body.data.name;
        clinic.version += 1;
        audit(db, request, user, {
          action: 'CLINIC_RENAMED',
          clinicId: clinic.id,
          entityType: 'Clinic',
          entityId: clinic.id,
          before,
          after: { name: clinic.name },
          reason: body.data.reason,
        });
        return HttpResponse.json(clinic);
      }),
    ),

    ...(['suspend', 'reactivate'] as const).map((action) =>
      http.post(
        u(`/clinics/:clinicId/${action}`),
        authed(async ({ db, user, request, params }) => {
          const clinic = findClinic(db, params.clinicId);
          if (!clinic) return notFound('Clínica');
          const body = await parseBody(request, clinicStatusInputSchema);
          if ('response' in body) return body.response;
          if (body.data.version !== clinic.version) {
            return versionConflict('La clínica', clinic.version);
          }
          const target = action === 'suspend' ? 'SUSPENDED' : 'ACTIVE';
          if (action === 'suspend' && clinic.operationalStatus !== 'ACTIVE') {
            return err(409, 'CLINIC_NOT_ACTIVE', 'Solo se puede suspender una clínica activa.');
          }
          // Reactivar aplica igual a SUSPENDED e INACTIVE.
          if (action === 'reactivate' && clinic.operationalStatus === 'ACTIVE') {
            return err(409, 'CLINIC_ALREADY_ACTIVE', 'La clínica ya está activa.');
          }
          const before = { operationalStatus: clinic.operationalStatus };
          clinic.operationalStatus = target;
          clinic.version += 1;
          audit(db, request, user, {
            action: action === 'suspend' ? 'CLINIC_SUSPENDED' : 'CLINIC_REACTIVATED',
            clinicId: clinic.id,
            entityType: 'Clinic',
            entityId: clinic.id,
            before,
            after: { operationalStatus: target },
            reason: body.data.reason,
          });
          return HttpResponse.json(clinic);
        }),
      ),
    ),

    http.put(
      u('/clinics/:clinicId/subscription'),
      authed(async ({ db, user, request, params }) => {
        const clinic = findClinic(db, params.clinicId);
        if (!clinic) return notFound('Clínica');
        const body = await parseBody(request, changeSubscriptionInputSchema);
        if ('response' in body) return body.response;
        if (body.data.version !== clinic.version)
          return versionConflict('La clínica', clinic.version);
        const plan = db.plans.find((p) => p.code === body.data.planCode);
        if (!plan) return notFound('Plan');
        const before = clinic.subscription;
        // Cambiar el trial nunca toca el estado operativo.
        clinic.planCode = plan.code;
        clinic.trial = body.data.trial;
        clinic.subscription = {
          id: clinic.subscription?.id ?? nextId(db, 's'),
          planId: plan.id,
          planCode: plan.code,
          status: body.data.trial ? 'TRIAL' : 'ACTIVE',
          startsAt: body.data.startsAt,
          endsAt: body.data.endsAt,
          renewalDate: body.data.trial ? null : body.data.endsAt,
          trial: body.data.trial,
        };
        clinic.version += 1;
        audit(db, request, user, {
          action: 'PLAN_CHANGED',
          clinicId: clinic.id,
          entityType: 'Subscription',
          entityId: clinic.subscription.id,
          before,
          after: clinic.subscription,
          reason: body.data.reason,
        });
        return HttpResponse.json(clinic);
      }),
    ),

    http.put(
      u('/clinics/:clinicId/specialty'),
      authed(async ({ db, user, request, params }) => {
        const clinic = findClinic(db, params.clinicId);
        if (!clinic) return notFound('Clínica');
        const body = await parseBody(request, changeSpecialtyInputSchema);
        if ('response' in body) return body.response;
        if (body.data.version !== clinic.version)
          return versionConflict('La clínica', clinic.version);
        if (!db.specialties.some((s) => s.code === body.data.specialtyCode && s.active)) {
          return notFound('Especialidad');
        }
        const before = { specialtyCode: clinic.specialtyCode };
        clinic.specialtyCode = body.data.specialtyCode;
        clinic.version += 1;
        audit(db, request, user, {
          action: 'SPECIALTY_CHANGED',
          clinicId: clinic.id,
          entityType: 'Clinic',
          entityId: clinic.id,
          before,
          after: { specialtyCode: clinic.specialtyCode },
          reason: body.data.reason,
        });
        return HttpResponse.json(clinic);
      }),
    ),

    http.get(
      u('/clinics/:clinicId/effective-modules'),
      authed(({ db, params, request }) => {
        // ?specialtyCode / ?planCode = vista previa: cómo quedarían sin guardar nada.
        const url = new URL(request.url);
        const specialtyCode = url.searchParams.get('specialtyCode') ?? undefined;
        const planCode = url.searchParams.get('planCode') ?? undefined;
        if (specialtyCode && !db.specialties.some((s) => s.code === specialtyCode)) {
          return notFound('Especialidad');
        }
        if (planCode && !db.plans.some((p) => p.code === planCode)) return notFound('Plan');
        const rows = resolveEffectiveModules(db, params.clinicId, { specialtyCode, planCode });
        return rows ? HttpResponse.json(rows) : notFound('Clínica');
      }),
    ),

    http.get(
      u('/clinics/:clinicId/module-overrides'),
      authed(({ db, params }) => {
        const clinic = findClinic(db, params.clinicId);
        if (!clinic) return notFound('Clínica');
        return HttpResponse.json({
          overrides: db.overrides[clinic.id] ?? [],
          version: clinic.version,
        });
      }),
    ),

    // D18: lista completa + reason + version (no hay DELETE: quitar = no enviarlo).
    http.put(
      u('/clinics/:clinicId/module-overrides'),
      authed(async ({ db, user, request, params }) => {
        const clinic = findClinic(db, params.clinicId);
        if (!clinic) return notFound('Clínica');
        const body = await parseBody(request, clinicOverridesUpdateInputSchema);
        if ('response' in body) return body.response;
        if (body.data.version !== clinic.version)
          return versionConflict('La clínica', clinic.version);
        const codes = body.data.overrides.map((o) => o.moduleCode);
        if (new Set(codes).size !== codes.length) {
          return err(400, 'VALIDATION_ERROR', 'Datos inválidos.', {
            fields: [{ field: 'overrides', message: 'Un módulo solo puede tener un override' }],
          });
        }
        for (const o of body.data.overrides) {
          const m = db.modules.find((x) => x.code === o.moduleCode);
          if (!m) return notFound(`Módulo ${o.moduleCode}`);
          if (m.requiredCore && !o.enabled) {
            return err(
              409,
              'REQUIRED_CORE_IMMUTABLE',
              `${m.code} es core obligatorio: no se puede apagar.`,
            );
          }
        }
        const before = db.overrides[clinic.id] ?? [];
        const now = new Date().toISOString();
        const same = (
          a: ModuleOverride,
          o: { enabled: boolean; reason: string; expiresAt: string | null },
        ) => a.enabled === o.enabled && a.reason === o.reason && a.expiresAt === o.expiresAt;
        const next: ModuleOverride[] = body.data.overrides.map((o) => {
          const prev = before.find((p) => p.moduleCode === o.moduleCode);
          if (prev && same(prev, o)) return prev;
          // Un vencimiento nuevo debe ser futuro.
          return { ...o, createdBy: user.email, createdAt: now };
        });
        const pastExpiry = next.find(
          (o) =>
            o.createdAt === now &&
            o.expiresAt !== null &&
            new Date(o.expiresAt).getTime() <= Date.now(),
        );
        if (pastExpiry) {
          return err(400, 'VALIDATION_ERROR', 'Datos inválidos.', {
            fields: [
              {
                field: `overrides.${next.indexOf(pastExpiry)}.expiresAt`,
                message: 'El vencimiento debe ser una fecha futura',
              },
            ],
          });
        }
        db.overrides[clinic.id] = next;
        clinic.version += 1;
        // Un evento por módulo cambiado: SET (nuevo o modificado) o REMOVED.
        for (const o of next) {
          const prev = before.find((p) => p.moduleCode === o.moduleCode);
          if (prev === o) continue;
          audit(db, request, user, {
            action: 'MODULE_OVERRIDE_SET',
            clinicId: clinic.id,
            entityType: 'ModuleOverride',
            entityId: `${clinic.id}:${o.moduleCode}`,
            before: prev ?? null,
            after: o,
            reason: body.data.reason,
          });
        }
        for (const prev of before) {
          if (next.some((o) => o.moduleCode === prev.moduleCode)) continue;
          audit(db, request, user, {
            action: 'MODULE_OVERRIDE_REMOVED',
            clinicId: clinic.id,
            entityType: 'ModuleOverride',
            entityId: `${clinic.id}:${prev.moduleCode}`,
            before: prev,
            after: null,
            reason: body.data.reason,
          });
        }
        return HttpResponse.json({ overrides: next, version: clinic.version });
      }),
    ),

    // ---- Planes ----
    http.get(
      u('/plans'),
      authed(({ db }) =>
        HttpResponse.json([...db.plans].sort((a, b) => a.sortOrder - b.sortOrder)),
      ),
    ),

    http.post(
      u('/plans'),
      authed(async ({ db, user, request }) => {
        const body = await parseBody(request, planCreateInputSchema);
        if ('response' in body) return body.response;
        if (db.plans.some((p) => p.code === body.data.code)) {
          return err(400, 'VALIDATION_ERROR', 'Datos inválidos.', {
            fields: [{ field: 'code', message: 'Ese código ya existe' }],
          });
        }
        const plan = {
          ...body.data,
          id: nextId(db, 'p'),
          version: 1,
          // Un plan nuevo arranca solo con los core.
          modules: db.modules.map((m) => ({ moduleCode: m.code, enabled: m.requiredCore })),
        };
        db.plans.push(plan);
        audit(db, request, user, {
          action: 'PLAN_CREATED',
          clinicId: null,
          entityType: 'Plan',
          entityId: plan.id,
          before: null,
          after: plan,
        });
        return HttpResponse.json(plan, { status: 201 });
      }),
    ),

    http.get(
      u('/plans/:planId'),
      authed(({ db, params }) => {
        const plan = db.plans.find((p) => p.id === params.planId);
        return plan ? HttpResponse.json(plan) : notFound('Plan');
      }),
    ),

    http.put(
      u('/plans/:planId'),
      authed(async ({ db, user, request, params }) => {
        const plan = db.plans.find((p) => p.id === params.planId);
        if (!plan) return notFound('Plan');
        // El code no viene en el body: no se puede editar.
        const body = await parseBody(request, planUpdateInputSchema);
        if ('response' in body) return body.response;
        const { version, ...fields } = body.data;
        if (version !== plan.version) return versionConflict('El plan', plan.version);
        const before = structuredClone(plan);
        Object.assign(plan, fields);
        if (!fields.description) delete plan.description;
        plan.version += 1;
        audit(db, request, user, {
          action: 'PLAN_UPDATED',
          clinicId: null,
          entityType: 'Plan',
          entityId: plan.id,
          before,
          after: plan,
        });
        return HttpResponse.json(plan);
      }),
    ),

    http.delete(
      u('/plans/:planId'),
      authed(({ db, user, request, params }) => {
        const plan = db.plans.find((p) => p.id === params.planId);
        if (!plan) return notFound('Plan');
        if (db.clinics.some((c) => c.planCode === plan.code)) {
          return err(
            409,
            'PLAN_IN_USE',
            'El plan tiene clínicas asignadas; desactívalo en su lugar.',
          );
        }
        db.plans = db.plans.filter((p) => p.id !== plan.id);
        audit(db, request, user, {
          action: 'PLAN_DELETED',
          clinicId: null,
          entityType: 'Plan',
          entityId: plan.id,
          before: plan,
          after: null,
        });
        return new HttpResponse(null, { status: 204 });
      }),
    ),

    http.put(
      u('/plans/:planId/modules'),
      authed(async ({ db, user, request, params }) => {
        const plan = db.plans.find((p) => p.id === params.planId);
        if (!plan) return notFound('Plan');
        const body = await parseBody(request, planModulesInputSchema);
        if ('response' in body) return body.response;
        if (body.data.version !== plan.version) return versionConflict('El plan', plan.version);
        const badLimits = validateLimits(db, body.data.modules);
        if (badLimits) return badLimits;
        for (const pm of body.data.modules) {
          if (!db.modules.some((x) => x.code === pm.moduleCode)) {
            return notFound(`Módulo ${pm.moduleCode}`);
          }
        }
        // Matriz completa: lo que no venga queda OFF; un core nunca puede quedar OFF.
        const next = db.modules.map(
          (m) =>
            body.data.modules.find((pm) => pm.moduleCode === m.code) ?? {
              moduleCode: m.code,
              enabled: false,
            },
        );
        const coreOff = next.find(
          (pm) => !pm.enabled && db.modules.find((m) => m.code === pm.moduleCode)!.requiredCore,
        );
        if (coreOff) {
          return err(
            409,
            'REQUIRED_CORE_IMMUTABLE',
            `${coreOff.moduleCode} es core obligatorio: no se puede apagar.`,
          );
        }
        // Las dependencias faltantes NO se rechazan: se resuelven en módulos efectivos.
        const before = plan.modules;
        plan.modules = next;
        plan.version += 1;
        audit(db, request, user, {
          action: 'PLAN_MODULES_UPDATED',
          clinicId: null,
          entityType: 'Plan',
          entityId: plan.id,
          before,
          after: plan.modules,
          reason: body.data.reason,
        });
        return HttpResponse.json(plan);
      }),
    ),

    // ---- Módulos ----
    http.get(
      u('/modules'),
      authed(({ db }) => HttpResponse.json(db.modules)),
    ),

    http.get(
      u('/modules/:moduleId'),
      authed(({ db, params }) => {
        const m = db.modules.find((x) => x.id === params.moduleId);
        return m ? HttpResponse.json(m) : notFound('Módulo');
      }),
    ),

    http.post(
      u('/modules'),
      authed(async ({ db, user, request }) => {
        const body = await parseBody(request, moduleCreateInputSchema);
        if ('response' in body) return body.response;
        const input = body.data;
        if (db.modules.some((m) => m.code === input.code)) {
          return err(400, 'VALIDATION_ERROR', 'Datos inválidos.', {
            fields: [{ field: 'code', message: 'Ese código ya existe' }],
          });
        }
        const invalid = validateDependencies(db, input.code, input.dependsOn);
        if (invalid) return invalid;
        const saved = { ...input, id: nextId(db, 'm'), allowedLimits: [], version: 1 };
        db.modules.push(saved);
        // D13: se agrega a todos los planes en OFF (en ON si es core).
        for (const plan of db.plans) {
          plan.modules.push({ moduleCode: saved.code, enabled: saved.requiredCore });
          plan.version += 1;
        }
        audit(db, request, user, {
          action: 'MODULE_CREATED',
          clinicId: null,
          entityType: 'Module',
          entityId: saved.id,
          before: null,
          after: saved,
        });
        return HttpResponse.json(saved, { status: 201 });
      }),
    ),

    http.put(
      u('/modules/:moduleId'),
      authed(async ({ db, user, request, params }) => {
        const existing = db.modules.find((x) => x.id === params.moduleId);
        if (!existing) return notFound('Módulo');
        // El code no viene en el body: no se puede editar.
        const body = await parseBody(request, moduleUpdateInputSchema);
        if ('response' in body) return body.response;
        const { version, reason, ...input } = body.data;
        if (version !== existing.version) return versionConflict('El módulo', existing.version);
        if (existing.requiredCore && (!input.active || !input.requiredCore)) {
          return err(
            409,
            'REQUIRED_CORE_IMMUTABLE',
            'Un módulo core obligatorio no se puede desactivar ni dejar de ser core.',
          );
        }
        // D14: desactivar un módulo comercial exige motivo.
        if (existing.active && !input.active && !reason) {
          return err(400, 'VALIDATION_ERROR', 'Datos inválidos.', {
            fields: [{ field: 'reason', message: 'El motivo es obligatorio para desactivar' }],
          });
        }
        const invalid = validateDependencies(db, existing.code, input.dependsOn);
        if (invalid) return invalid;
        const before = structuredClone(existing);
        Object.assign(existing, input);
        if (!input.description) delete existing.description;
        existing.version += 1;
        // Un módulo que pasa a core queda ON en todos los planes.
        if (existing.requiredCore && !before.requiredCore) {
          for (const plan of db.plans) {
            const pm = plan.modules.find((x) => x.moduleCode === existing.code);
            if (pm && !pm.enabled) {
              pm.enabled = true;
              plan.version += 1;
            }
          }
        }
        audit(db, request, user, {
          action: before.active && !existing.active ? 'MODULE_DEACTIVATED' : 'MODULE_UPDATED',
          clinicId: null,
          entityType: 'Module',
          entityId: existing.id,
          before,
          after: existing,
          reason: reason ?? null,
        });
        return HttpResponse.json(existing);
      }),
    ),

    // D14: en V1 un módulo no se borra, solo se desactiva. Uso actual para el modal.
    http.get(
      u('/modules/:moduleId/usage'),
      authed(({ db, params }) => {
        const m = db.modules.find((x) => x.id === params.moduleId);
        if (!m) return notFound('Módulo');
        const using = db.clinics
          .filter((c) =>
            resolveEffectiveModules(db, c.id)?.some((e) => e.code === m.code && e.enabled),
          )
          .sort((x, y) => x.name.localeCompare(y.name, 'es'));
        return HttpResponse.json({
          clinicCount: using.length,
          clinics: using.slice(0, 10).map((c) => ({ clinicId: c.id, name: c.name, slug: c.slug })),
        });
      }),
    ),

    // ---- Especialidades ----
    http.get(
      u('/specialties'),
      authed(({ db }) =>
        HttpResponse.json(
          db.specialties.map((s) => ({
            ...s,
            clinicCount: db.clinics.filter((c) => c.specialtyCode === s.code).length,
            compatibleModuleCount: db.modules.filter(
              (m) =>
                m.active &&
                (m.compatibleSpecialties.length === 0 || m.compatibleSpecialties.includes(s.code)),
            ).length,
          })),
        ),
      ),
    ),

    // ---- Auditoría ----
    http.get(
      u('/audit-logs'),
      authed(({ db, request }) => {
        const url = new URL(request.url);
        const p = (k: string) => url.searchParams.get(k);
        const from = p('from') ? new Date(p('from')!) : null;
        const to = p('to') ? new Date(p('to')!) : null;
        const items = db.auditLogs.filter(
          (a) =>
            (!p('clinicId') || a.clinicId === p('clinicId')) &&
            (!p('actorId') || a.actor.id === p('actorId')) &&
            (!p('action') || a.action === p('action')) &&
            (!from || new Date(a.createdAt) >= from) &&
            (!to || new Date(a.createdAt) <= to),
        );
        // Más recientes primero.
        items.sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime());
        const page = paginate(items, url);
        return HttpResponse.json({
          ...page,
          content: page.content.map((a) => ({
            ...a,
            clinicName: a.clinicId ? (findClinic(db, a.clinicId)?.name ?? null) : null,
          })),
        });
      }),
    ),

    // Usuarios KodeWave, para el filtro de actor de la auditoría.
    http.get(
      u('/users'),
      authed(({ db }) =>
        HttpResponse.json(
          db.users.map((x) => ({ id: x.id, email: x.email, fullName: x.fullName })),
        ),
      ),
    ),
  ];
}
