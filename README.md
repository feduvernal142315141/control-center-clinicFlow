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

| Situación                               | Código                                                      |
| --------------------------------------- | ----------------------------------------------------------- |
| Sin red                                 | `NETWORK_ERROR`                                             |
| Backend caído                           | `BACKEND_UNAVAILABLE` (502 del BFF)                         |
| Respuesta que no cumple el contrato zod | `CONTRACT_MISMATCH`                                         |
| Cuerpo no-JSON                          | `UNEXPECTED_RESPONSE`                                       |
| Sesión caída / token no de plataforma   | `UNAUTHENTICATED` / `PLATFORM_FORBIDDEN` → logout + login   |
| `VALIDATION_ERROR`                      | `details.fields[] = { field, message }` → errores por campo |

## Contratos propuestos al backend (además de la sección 7 del brief)

Fuente de verdad en código: `src/lib/api/schemas`. Si el backend decide otra cosa, se ajusta allí y aquí.
Formatos comunes: fechas ISO 8601 con offset; errores `{code, message, details?}`; `VALIDATION_ERROR`
con `details.fields = [{field, message}]`; paginación `{content, page, size, totalElements, totalPages}`.

### Decisiones de dominio (confirmadas)

| #   | Decisión                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | `operationalStatus` es solo `ACTIVE \| SUSPENDED \| INACTIVE`. **El trial no es estado operativo.**                                                          |
| D2  | El trial vive solo en la suscripción (`subscription.trial`, `subscription.status = 'TRIAL'`). Marcar o desmarcar trial **nunca** cambia `operationalStatus`. |
| D3  | Un trial exige fecha de fin (`endsAt` en la suscripción, `trialEndsAt` al crear). Si falta → `VALIDATION_ERROR`.                                             |
| D4  | La suscripción se asigna por `planCode`, no por `planId`.                                                                                                    |
| D5  | "Reactivar" aplica igual a `SUSPENDED` e `INACTIVE` → `ACTIVE`, con motivo obligatorio. Solo se suspende una clínica `ACTIVE`.                               |
| D6  | Toda acción sobre una clínica (editar nombre, plan, especialidad, suspender, reactivar) lleva `reason` y queda auditada.                                     |
| D7  | Los módulos efectivos los calcula el backend, incluida la vista previa. El front solo compara el estado actual con la vista previa para listar qué cambia.   |

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
  `{totalClinics, active, suspended, inactive, trial, byPlan: [{planCode|null, count}], bySpecialty: [{specialtyCode, count}]}`.
  `active + suspended + inactive = totalClinics`; `trial` cuenta clínicas con `subscription.trial = true` (D2).

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
- **Vista previa:** el mismo endpoint acepta `?specialtyCode=X` y/o `?planCode=Y` y devuelve cómo quedarían
  los módulos con ese cambio, **sin guardar nada**. Mismo formato de respuesta. Código inexistente → 404.
  Lo usan los modales de cambiar especialidad y cambiar plan para listar qué pasa de ON a OFF y de OFF a ON.

### Overrides

- `PUT /platform/clinics/{id}/module-overrides` recibe el arreglo completo de overrides.

## Estado

- [x] Setup: repo, CI, MSW, README
- [x] BO1: login por BFF + 2FA (flag), middleware, layout, logout, errores globales, e2e
- [x] BO2: dashboard, clínicas (lista, crear, detalle), acciones con motivo, módulos efectivos
- [ ] BO3: planes + matriz, catálogo de módulos
- [ ] BO4: overrides, auditoría

Los handlers MSW de BO3–BO4 ya existen (`src/mocks/handlers.ts`).
