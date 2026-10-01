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

CI (`.github/workflows/ci.yml`): typecheck, lint, format, test, build y luego e2e.

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

Ajustar aquí y en `src/lib/api/schemas` si el backend decide otra cosa.

- `POST /platform/auth/login {email, password}` →
  `{accessToken, refreshToken, expiresIn, refreshExpiresIn?}` **o** `{mfaRequired: true, mfaToken}`.
- `POST /platform/auth/mfa/verify {mfaToken, code}` → tokens.
- `POST /platform/auth/refresh {refreshToken}` → tokens (con rotación).
- `POST /platform/auth/logout {refreshToken}` → 204.
- `GET /platform/me` → `{id, email, fullName, roles: ['SUPER_ADMIN'], mfaEnabled}`.
- Paginación: `{content, page, size, totalElements, totalPages}`.
- `GET /platform/dashboard` → `{totalClinics, active, trial, suspended, inactive, byPlan[], bySpecialty[]}`.
- `PUT /platform/clinics/{id}/module-overrides` recibe el arreglo completo de overrides.
- Errores de auth: `INVALID_CREDENTIALS` (401), `ACCOUNT_LOCKED` (423), `RATE_LIMITED` (429),
  `INVALID_MFA_CODE` / `MFA_SESSION_EXPIRED` (401).

## Estado

- [x] Setup: repo, CI, MSW, README
- [x] BO1: login por BFF + 2FA (flag), middleware, layout, logout, errores globales, e2e
- [ ] BO2: dashboard, clínicas, acciones, módulos efectivos
- [ ] BO3: planes + matriz, catálogo de módulos
- [ ] BO4: overrides, auditoría

Los handlers MSW de BO2–BO4 ya existen (`src/mocks/handlers.ts`).
