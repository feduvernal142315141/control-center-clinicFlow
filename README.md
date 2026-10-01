# KodeWave Control Center

Herramienta **interna y privada** de KodeWave para administrar ClinicFlow360: clínicas, planes,
especialidades, módulos, overrides y auditoría. No es para usuarios de clínicas.

Consume el monolito Spring Boot **solo** por `/platform/**`, siempre a través del BFF de Next.js.

## Stack

Next.js 15 (App Router, TS strict) · Tailwind v4 + shadcn/ui (Radix) · TanStack Query/Table ·
react-hook-form + zod · MSW · Vitest + Testing Library · Playwright.

## Requisitos

- Node 22+
- pnpm (`corepack enable` toma la versión de `packageManager`)

```bash
pnpm install
cp .env.example .env.local
```

## Correr

### Con mocks (sin backend)

```bash
pnpm dev:mocks          # NEXT_PUBLIC_API_MOCKS=true + 2FA habilitado
```

| Usuario               | Contraseña      | Caso                             |
| --------------------- | --------------- | -------------------------------- |
| `admin@kodewave.com`  | `KodeWave2026!` | SUPER_ADMIN                      |
| `mfa@kodewave.com`    | `KodeWave2026!` | Pide TOTP: código `123456`       |
| `locked@kodewave.com` | `KodeWave2026!` | `ACCOUNT_LOCKED`                 |
| cualquiera            | 5 fallos        | `RATE_LIMITED` en el 6.º intento |

El estado de los mocks vive en memoria del servidor Next (se reinicia al reiniciar `next dev`).
Escenarios semilla: ver `src/mocks/data.ts`.

Clínicas útiles para probar:

- `c-darmas`: DENTAL/PREMIUM.
- `c-podologico-x`: DENTAL_* OFF por especialidad.
- `c-lara`: override OFF y dependencia faltante.
- `c-sonrisas-norte`: suspendida.
- `c-piel-sana`: inactiva.
- `c-vida`: activa con trial.
- `c-trial-vencido`: trial vencido (D8).
- `c-trial-por-vencer`: vence en 3 días.

### Contra el backend real

```bash
# .env.local
PLATFORM_API_URL=http://localhost:8080
NEXT_PUBLIC_API_MOCKS=false
NEXT_PUBLIC_FEATURE_MFA=false   # true cuando el backend confirme 2FA

pnpm dev
```

> `NEXT_PUBLIC_*` se incrusta en build: al cambiarlas, reinicia `next dev` o reconstruye.
> Con `NODE_ENV=production` el BFF se niega a usar mocks salvo que `ALLOW_MOCKS_IN_PRODUCTION=true`
> (solo e2e/CI).

## Scripts

| Script              | Qué hace                                                          |
| ------------------- | ----------------------------------------------------------------- |
| `pnpm typecheck`    | `tsc --noEmit`                                                    |
| `pnpm lint`         | ESLint, 0 warnings                                                |
| `pnpm format:check` | Prettier                                                          |
| `pnpm test`         | Vitest (unit + componentes + BFF + mocks)                         |
| `pnpm build`        | `next build` (nunca con `ignoreBuildErrors`/`ignoreDuringBuilds`) |
| `pnpm e2e`          | Playwright: build + start con mocks en `:3100`                    |
| `pnpm check`        | typecheck + lint + format + test + build                          |

Primera vez con e2e: `pnpm exec playwright install chromium`.

CI (`.github/workflows/ci.yml`): typecheck, lint, format, test, build y luego e2e. Corre en push a
`main` y `feature/**`, y en pull requests.

## Arquitectura

```
Browser ──► Next.js /api/auth/*, /api/platform/*  ──►  Backend /platform/**
            cookies httpOnly + Secure + SameSite=Strict     Authorization: Bearer <platform JWT>
```

- **El navegador nunca ve el JWT.** `kw_at` (access), `kw_rt` (refresh) y `kw_mfa` (paso 2FA)
  son cookies httpOnly. Nada en `localStorage` (ESLint lo prohíbe).
- `POST /api/auth/login` → `/platform/auth/login`. Si el backend pide 2FA, el `mfaToken` va a
  cookie y el front muestra el paso de código (`POST /api/auth/mfa` → `/platform/auth/mfa/verify`),
  detrás de `NEXT_PUBLIC_FEATURE_MFA`.
- `/api/platform/[...path]` reenvía a `/platform/[...path]` con el Bearer. Ante 401 hace **un**
  refresh (deduplicado entre requests concurrentes del mismo proceso), reintenta y rota cookies.
  Si falla: borra cookies y responde `401 UNAUTHENTICATED`. `PLATFORM_FORBIDDEN` también borra
  la sesión. `/platform/auth/*` no se expone por el proxy.
- Mutaciones verifican `Origin` (defensa CSRF además de SameSite=Strict).
- `middleware.ts` solo comprueba que exista sesión; la autorización la decide el backend.
- **Modo mock:** el BFF resuelve las llamadas al backend con los handlers MSW en el mismo proceso
  (`msw.getResponse`), así cookies, refresh y errores corren exactamente igual que en real.

### Carpetas

```
src/
  app/                 rutas (login, (app)/* con layout, api/* = BFF)
  components/ui        primitivas shadcn
  components/layout    shell, sidebar, menú de usuario
  components/states    vacío / cargando / error / en construcción
  config/features.ts   flags públicos
  lib/api/schemas      contratos zod = fuente de los tipos (sección 7 del brief)
  lib/api/client.ts    única puerta del navegador al BFF; todo error sale como ApiError tipado
  lib/api/endpoints    llamadas por recurso
  lib/react-query.ts   QueryClient: sesión inválida → logout + login; toasts de mutaciones
  server/              BFF: env, cookies, proxy, refresh (solo servidor)
  mocks/               backend falso: datos semilla, handlers MSW, cálculo de módulos efectivos
```

La app (`src/app`, `src/components`, `src/lib`) no puede importar `@/mocks/*` ni `@/server/*`
(regla de ESLint); solo los route handlers usan `@/server/*`.

### Errores

Formato del backend: `{ code, message, details? }`. El cliente nunca se traga errores:

| Situación                               | Código                                                           |
| --------------------------------------- | ---------------------------------------------------------------- |
| Sin red                                 | `NETWORK_ERROR`                                                  |
| Backend caído                           | `BACKEND_UNAVAILABLE` (502 del BFF)                              |
| Respuesta que no cumple el contrato zod | `CONTRACT_MISMATCH`                                              |
| Cuerpo no-JSON                          | `UNEXPECTED_RESPONSE`                                            |
| Sesión caída / token no de plataforma   | `UNAUTHENTICATED` / `PLATFORM_FORBIDDEN` → logout + login        |
| `VALIDATION_ERROR`                      | `details.fields[] = { field, message }` → errores por campo      |
| Edición sobre versión vieja (D16)       | `VERSION_CONFLICT` → aviso, recarga y se conservan las ediciones |

## Contratos propuestos al backend (además de la sección 7 del brief)

Fuente de verdad en código: `src/lib/api/schemas`. Si el backend decide otra cosa, se ajusta allí y aquí.
Formatos comunes: fechas ISO 8601 con offset; errores `{code, message, details?}`; `VALIDATION_ERROR`
con `details.fields = [{field, message}]`; paginación `{content, page, size, totalElements, totalPages}`.

### Decisiones de dominio (confirmadas)

| #   | Decisión                                                                                                                                                                                                                                                                               |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | `operationalStatus` es solo `ACTIVE \| SUSPENDED \| INACTIVE`. **El trial no es estado operativo.**                                                                                                                                                                                    |
| D2  | El trial vive solo en la suscripción (`subscription.trial`, `subscription.status = 'TRIAL'`). Marcar o desmarcar trial **nunca** cambia `operationalStatus`.                                                                                                                           |
| D3  | Un trial exige fecha de fin (`endsAt` en la suscripción, `trialEndsAt` al crear). Si falta → `VALIDATION_ERROR`.                                                                                                                                                                       |
| D4  | La suscripción se asigna por `planCode`, no por `planId`.                                                                                                                                                                                                                              |
| D5  | "Reactivar" aplica igual a `SUSPENDED` e `INACTIVE` → `ACTIVE`, con motivo obligatorio. Solo se suspende una clínica `ACTIVE`.                                                                                                                                                         |
| D6  | Toda acción sobre una clínica (editar nombre, plan, especialidad, suspender, reactivar) lleva `reason` y queda auditada.                                                                                                                                                               |
| D7  | Los módulos efectivos los calcula el backend, incluida la vista previa. El front solo compara el estado actual con la vista previa para listar qué cambia.                                                                                                                             |
| D8  | Trial vencido: la suscripción pasa a `PAST_DUE` (sigue con `trial = true`) y la clínica **sigue `ACTIVE`**. Nada se suspende solo: suspender es siempre manual.                                                                                                                        |
| D9  | `deniedReason` es extensible: el backend puede agregar códigos nuevos (formato `MAYUSCULAS_CON_GUION`) sin romper el front, que muestra "Motivo no reconocido: CODIGO" y registra un `console.warn`. El resto del contrato se valida estricto.                                         |
| D10 | El `code` de planes y módulos es inmutable: `PUT` no lo recibe.                                                                                                                                                                                                                        |
| D11 | Un módulo `requiredCore` no se puede desactivar ni dejar de ser core (`REQUIRED_CORE_IMMUTABLE`), y siempre está ON en todos los planes.                                                                                                                                               |
| D12 | Dependencias faltantes dentro de un plan **no** se rechazan al guardar la matriz: el front solo advierte y en las clínicas quedan OFF por `MISSING_DEPENDENCY`.                                                                                                                        |
| D13 | Un módulo nuevo se agrega a **todos** los planes en OFF; si es `requiredCore`, en ON.                                                                                                                                                                                                  |
| D14 | En V1 un módulo **no se borra**: solo se desactiva (no existe `DELETE`). Desactivar un módulo comercial exige `reason`, y antes la UI muestra cuántas clínicas lo tienen ON hoy y las primeras 10 (`GET /modules/{id}/usage`).                                                         |
| D15 | Límites con catálogo: cada módulo declara `allowedLimits: [{key, label, unit}]`. La matriz solo acepta esas claves (sin texto libre); un módulo sin `allowedLimits` no admite límites. Los define el backend (no editables en V1).                                                     |
| D16 | Concurrencia optimista: planes y módulos traen `version`; todo `PUT` la envía. Si no coincide → 409 `VERSION_CONFLICT` con `details.currentVersion`. El plan tiene **una sola** versión para sus datos y su matriz. La UI avisa, recarga y conserva lo que el usuario estaba editando. |

### Auth

- `POST /platform/auth/login {email, password}` →
  `{accessToken, refreshToken, expiresIn, refreshExpiresIn?}` **o** `{mfaRequired: true, mfaToken}`.
- `POST /platform/auth/mfa/verify {mfaToken, code}` → tokens.
- `POST /platform/auth/refresh {refreshToken}` → tokens (con rotación).
- `POST /platform/auth/logout {refreshToken}` → 204.
- `GET /platform/me` → `{id, email, fullName, roles: ['SUPER_ADMIN'], mfaEnabled}`.
- Errores: `INVALID_CREDENTIALS` (401), `ACCOUNT_LOCKED` (423), `RATE_LIMITED` (429),
  `INVALID_MFA_CODE` / `MFA_SESSION_EXPIRED` (401), `UNAUTHENTICATED` (401), `PLATFORM_FORBIDDEN` (403).

### Dashboard

- `GET /platform/dashboard` →
  `{totalClinics, active, suspended, inactive, trial, byPlan: [{planCode|null, count}], bySpecialty: [{specialtyCode, count}], trials: {expired: TrialItem[], expiringSoon: TrialItem[]}}`.
  - `active + suspended + inactive = totalClinics`.
  - `trial` = suscripciones con `status = 'TRIAL'` (trials en curso).
  - `TrialItem` = `{clinicId, name, slug, planCode, endsAt}`.
  - `trials.expired`: suscripción `PAST_DUE` con `trial = true` (D8), ordenados por `endsAt`.
  - `trials.expiringSoon`: suscripción `TRIAL` con `endsAt` entre ahora y ahora + 7 días, ordenados por `endsAt`.
  - El backend necesita un job que pase a `PAST_DUE` los trials con `endsAt` vencido (en los mocks se aplica al vuelo).

### Clínicas

- `ClinicSummary` = `{id, name, slug, specialtyCode, operationalStatus, planCode|null, trial, createdAt}`.
  `trial` refleja `subscription.trial` (`false` sin suscripción).
- `ClinicDetail` = `ClinicSummary` + `subscription: {id, planId, planCode, status, startsAt, endsAt|null, renewalDate|null, trial} | null`.
- `GET /platform/clinics?q&status&planCode&specialtyCode&trial&page&size` → página de `ClinicSummary`.
  `status` ∈ D1; `trial=true|false` filtra por suscripción.
- `POST /platform/clinics`
  `{name, slug, specialtyCode, planCode, trial, trialEndsAt|null, admin: {fullName, email}}` → 201 `ClinicDetail`
  (siempre `operationalStatus: ACTIVE`). Slug repetido → `VALIDATION_ERROR` en `slug`.
- `PATCH /platform/clinics/{id}` `{name, reason}` → `ClinicDetail`.
- `POST /platform/clinics/{id}/suspend` `{reason}` → `ClinicDetail`. Si no está `ACTIVE` → 409 `CLINIC_NOT_ACTIVE`.
- `POST /platform/clinics/{id}/reactivate` `{reason}` → `ClinicDetail` (desde `SUSPENDED` o `INACTIVE`, D5).
  Si ya está `ACTIVE` → 409 `CLINIC_ALREADY_ACTIVE`.
- `PUT /platform/clinics/{id}/subscription` `{planCode, startsAt, endsAt|null, trial, reason}` → `ClinicDetail` (D2–D4).
- `PUT /platform/clinics/{id}/specialty` `{specialtyCode, reason}` → `ClinicDetail`.

### Módulos efectivos y vista previa

- `GET /platform/clinics/{id}/effective-modules` → `EffectiveModule[]` (sección 7.3 del brief).
  `deniedReason` admite códigos nuevos sin romper el front (D9).
- **Vista previa:** el mismo endpoint acepta `?specialtyCode=X` y/o `?planCode=Y` y devuelve cómo quedarían
  los módulos con ese cambio, **sin guardar nada**. Mismo formato de respuesta. Código inexistente → 404.
  Lo usan los modales de cambiar especialidad y cambiar plan para listar qué pasa de ON a OFF y de OFF a ON.

### Planes (BO3)

- `Plan` = `{id, code, name, description?, active, sortOrder, modules: PlanModule[], version}`.
- `PlanModule` = `{moduleCode, enabled, limits?: Record<string, number | null>}`. Las claves de `limits` deben
  estar en `allowedLimits` del módulo (D15); el valor es un entero ≥ 0 y `null` = ilimitado.
- `GET /platform/plans` → `Plan[]` ordenados por `sortOrder`. `GET /platform/plans/{id}` → `Plan`.
- `POST /platform/plans` `{code, name, description?, active, sortOrder}` → 201 `Plan` (`version: 1`).
  - Arranca con solo los core en ON.
  - `code`: `^[A-Z][A-Z0-9_]*$`; si está repetido → `VALIDATION_ERROR` en `code`.
- `PUT /platform/plans/{id}` `{name, description?, active, sortOrder, version}` → `Plan` (sin `code`, D10).
  Si la versión es vieja → 409 `VERSION_CONFLICT` (D16).
- `PUT /platform/plans/{id}/modules` `{modules: PlanModule[], reason, version}` → `Plan`.
  - Es la matriz completa: un módulo que no venga queda OFF.
  - Un core en OFF → 409 `REQUIRED_CORE_IMMUTABLE` (D11).
  - Las dependencias faltantes no se rechazan (D12).
  - Un límite fuera de `allowedLimits` → `VALIDATION_ERROR` (`field: modules.{i}.limits.{key}`).
  - Versión vieja → 409 `VERSION_CONFLICT`. Queda auditado con `reason`.
- Todo cambio en la matriz o en los datos incrementa `Plan.version`. Agregar un módulo al catálogo (D13) o
  convertir uno en core también la incrementa.

### Módulos (BO3)

- `PlatformModule` = la sección 7.2 del brief + `allowedLimits: [{key, label, unit}]` (D15) + `version` (D16).
- `GET /platform/modules` → `PlatformModule[]`.
- `POST /platform/modules`
  `{code, name, description?, category, requiredCore, active, compatibleSpecialties, dependsOn}` → 201
  (`version: 1`, `allowedLimits: []`).
  - Se agrega a todos los planes en OFF, o en ON si es core (D13).
  - `code` repetido → `VALIDATION_ERROR` en `code`.
- `PUT /platform/modules/{id}`
  `{name, description?, category, requiredCore, active, compatibleSpecialties, dependsOn, version, reason?}`
  (sin `code`, D10):
  - `reason` es obligatorio si el cambio desactiva el módulo (`active: true → false`); si falta →
    `VALIDATION_ERROR` en `reason` (D14).
  - Un core que se intente desactivar o dejar de ser core → 409 `REQUIRED_CORE_IMMUTABLE`.
  - Un módulo que pasa a core queda ON en todos los planes.
  - Versión vieja → 409 `VERSION_CONFLICT`.
- `GET /platform/modules/{id}/usage` → `{clinicCount, clinics: [{clinicId, name, slug}]}` (D14).
  - `clinicCount`: clínicas con el módulo **efectivamente ON** hoy.
  - `clinics`: las primeras 10, ordenadas por nombre.
- **No hay `DELETE /platform/modules/{id}`** en V1 (D14).
- Dependencias (en `POST`/`PUT`):
  - Auto-dependencia → 409 `MODULE_DEPENDENCY_SELF` con `details.cycle: [A, A]`.
  - Ciclo → 409 `MODULE_DEPENDENCY_CYCLE` con `details.cycle: [A, B, …, A]`.
  - Código inexistente → 404.

  El front detecta ciclos con DFS para dar feedback rápido, pero manda la validación del backend.

### Especialidades (BO3)

- `GET /platform/specialties` → `{code, name, active, clinicCount, compatibleModuleCount}[]`.
  - `clinicCount`: clínicas con esa especialidad, en cualquier estado.
  - `compatibleModuleCount`: módulos activos que la incluyen en `compatibleSpecialties` o que no tienen
    restricción (lista vacía).

### Overrides

- `PUT /platform/clinics/{id}/module-overrides` recibe el arreglo completo de overrides.

## Estado

- [x] Setup: repo, CI, MSW, README
- [x] BO1: login por BFF + 2FA (flag), middleware, layout, logout, errores globales, e2e
- [x] BO2: dashboard, clínicas (lista, crear, detalle), acciones con motivo, módulos efectivos
- [x] BO3: planes + matriz, catálogo de módulos con editor de dependencias, especialidades
- [ ] BO4: overrides, auditoría

Los handlers MSW de BO4 ya existen (`src/mocks/handlers.ts`).
