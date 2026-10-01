import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { isMfaEnabled } from '@/config/features';
import { API_ERROR_CODES, apiErrorFromResponse } from '@/lib/api/errors';
import {
  backendLoginResponseSchema,
  backendTokensSchema,
  loginInputSchema,
  mfaInputSchema,
  type BackendTokens,
  type BffAuthResult,
} from '@/lib/api/schemas';
import { platformBackendFetch } from './platform-backend';
import { clearSessionCookies, readSession, setMfaCookie, setSessionCookies } from './session';

const NO_STORE = { 'Cache-Control': 'no-store' };

function errorResponse(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json(
    { code, message, ...(details !== undefined ? { details } : {}) },
    { status, headers: NO_STORE },
  );
}

function unauthenticated(message = 'Tu sesión expiró. Vuelve a iniciar sesión.') {
  const res = errorResponse(401, API_ERROR_CODES.UNAUTHENTICATED, message);
  clearSessionCookies(res);
  return res;
}

/** Reenvía el error del backend al navegador conservando `{ code, message, details }`. */
async function forwardBackendError(backendRes: Response) {
  const err = await apiErrorFromResponse(backendRes);
  return errorResponse(err.status, err.code, err.message, err.details);
}

function contractMismatch(what: string, details: unknown) {
  console.error(`[bff] respuesta de ${what} no cumple el contrato`, details);
  return errorResponse(
    502,
    API_ERROR_CODES.CONTRACT_MISMATCH,
    'El backend devolvió una respuesta con formato inesperado.',
  );
}

/**
 * Defensa CSRF adicional a SameSite=Strict: toda mutación debe venir de nuestro origen.
 */
export function rejectCrossOrigin(req: NextRequest): NextResponse | null {
  if (req.method === 'GET' || req.method === 'HEAD') return null;
  const origin = req.headers.get('origin');
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  let originHost: string | null = null;
  try {
    originHost = origin ? new URL(origin).host : null;
  } catch {
    originHost = null;
  }
  if (!originHost || !host || originHost !== host) {
    return errorResponse(403, API_ERROR_CODES.CSRF_REJECTED, 'Origen no permitido.');
  }
  return null;
}

async function readJson(req: NextRequest): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}

function validationError(issues: { path: PropertyKey[]; message: string }[]) {
  return errorResponse(400, API_ERROR_CODES.VALIDATION_ERROR, 'Datos inválidos.', {
    fields: issues.map((i) => ({ field: i.path.map(String).join('.'), message: i.message })),
  });
}

function authenticated(tokens: BackendTokens) {
  const res = NextResponse.json<BffAuthResult>({ status: 'AUTHENTICATED' }, { headers: NO_STORE });
  setSessionCookies(res, tokens);
  return res;
}

// ---------------------------------------------------------------------------
// /api/auth/*
// ---------------------------------------------------------------------------

export async function handleLogin(req: NextRequest) {
  const csrf = rejectCrossOrigin(req);
  if (csrf) return csrf;

  const input = loginInputSchema.safeParse(await readJson(req));
  if (!input.success) return validationError(input.error.issues);

  const backendRes = await platformBackendFetch('/platform/auth/login', {
    method: 'POST',
    headers: forwardedHeaders(req, true),
    body: JSON.stringify(input.data),
  });
  if (!backendRes.ok) return forwardBackendError(backendRes);

  const parsed = backendLoginResponseSchema.safeParse(await backendRes.json().catch(() => null));
  if (!parsed.success) return contractMismatch('login', parsed.error.issues);

  if ('mfaRequired' in parsed.data) {
    if (!isMfaEnabled()) {
      return errorResponse(
        409,
        API_ERROR_CODES.MFA_NOT_SUPPORTED,
        'Esta cuenta requiere 2FA, pero el paso 2FA no está habilitado en el Control Center.',
      );
    }
    const res = NextResponse.json<BffAuthResult>({ status: 'MFA_REQUIRED' }, { headers: NO_STORE });
    setMfaCookie(res, parsed.data.mfaToken);
    return res;
  }
  return authenticated(parsed.data);
}

export async function handleMfaVerify(req: NextRequest) {
  const csrf = rejectCrossOrigin(req);
  if (csrf) return csrf;
  if (!isMfaEnabled()) {
    return errorResponse(404, API_ERROR_CODES.NOT_FOUND, '2FA no habilitado.');
  }

  const { mfaToken } = readSession(req);
  if (!mfaToken) {
    return errorResponse(
      401,
      API_ERROR_CODES.MFA_SESSION_EXPIRED,
      'La verificación expiró. Vuelve a ingresar tu correo y contraseña.',
    );
  }

  const input = mfaInputSchema.safeParse(await readJson(req));
  if (!input.success) return validationError(input.error.issues);

  const backendRes = await platformBackendFetch('/platform/auth/mfa/verify', {
    method: 'POST',
    headers: forwardedHeaders(req, true),
    body: JSON.stringify({ mfaToken, code: input.data.code }),
  });
  if (!backendRes.ok) return forwardBackendError(backendRes);

  const tokens = backendTokensSchema.safeParse(await backendRes.json().catch(() => null));
  if (!tokens.success) return contractMismatch('mfa/verify', tokens.error.issues);
  return authenticated(tokens.data);
}

export async function handleLogout(req: NextRequest) {
  const csrf = rejectCrossOrigin(req);
  if (csrf) return csrf;

  const { refreshToken, accessToken } = readSession(req);
  if (refreshToken) {
    // Best effort: la sesión local se cierra aunque el backend falle, pero se registra.
    const backendRes = await platformBackendFetch('/platform/auth/logout', {
      method: 'POST',
      accessToken,
      headers: forwardedHeaders(req, true),
      body: JSON.stringify({ refreshToken }),
    });
    if (!backendRes.ok && backendRes.status !== 401 && backendRes.status !== 404) {
      console.error(`[bff] logout en backend respondió ${backendRes.status}`);
    }
  }
  const res = new NextResponse(null, { status: 204, headers: NO_STORE });
  clearSessionCookies(res);
  return res;
}

// ---------------------------------------------------------------------------
// Refresh (deduplicado por refresh token para requests concurrentes)
// ---------------------------------------------------------------------------

const REFRESH_DEDUPE_MS = 10_000;
const inflightRefresh = new Map<string, Promise<BackendTokens | null>>();

async function doRefresh(refreshToken: string): Promise<BackendTokens | null> {
  const res = await platformBackendFetch('/platform/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) return null;
  const parsed = backendTokensSchema.safeParse(await res.json().catch(() => null));
  if (!parsed.success) {
    console.error('[bff] respuesta de refresh no cumple el contrato', parsed.error.issues);
    return null;
  }
  return parsed.data;
}

export function refreshOnce(refreshToken: string): Promise<BackendTokens | null> {
  const existing = inflightRefresh.get(refreshToken);
  if (existing) return existing;
  const promise = doRefresh(refreshToken);
  inflightRefresh.set(refreshToken, promise);
  setTimeout(() => inflightRefresh.delete(refreshToken), REFRESH_DEDUPE_MS).unref?.();
  return promise;
}

/** Solo para tests. */
export function __resetRefreshCache() {
  inflightRefresh.clear();
}

// ---------------------------------------------------------------------------
// /api/platform/* → backend /platform/*
// ---------------------------------------------------------------------------

function forwardedHeaders(req: NextRequest, json: boolean): Headers {
  const headers = new Headers();
  if (json) headers.set('Content-Type', 'application/json');
  for (const name of ['content-type', 'accept-language', 'user-agent', 'x-request-id']) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }
  const forwardedFor = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip');
  if (forwardedFor) headers.set('X-Forwarded-For', forwardedFor);
  return headers;
}

async function isPlatformForbidden(res: Response): Promise<boolean> {
  if (res.status !== 403) return false;
  const body = (await res
    .clone()
    .json()
    .catch(() => null)) as { code?: unknown } | null;
  return body?.code === API_ERROR_CODES.PLATFORM_FORBIDDEN;
}

export async function proxyToPlatform(req: NextRequest, segments: string[]) {
  const csrf = rejectCrossOrigin(req);
  if (csrf) return csrf;

  // La sesión solo se maneja vía /api/auth/*: nunca exponer tokens por el proxy.
  if (segments.length === 0 || segments[0] === 'auth') {
    return errorResponse(404, API_ERROR_CODES.NOT_FOUND, 'Ruta no encontrada.');
  }

  const path = `/platform/${segments.map(encodeURIComponent).join('/')}${req.nextUrl.search}`;
  const { accessToken: cookieAccess, refreshToken } = readSession(req);

  let accessToken = cookieAccess;
  let renewed: BackendTokens | null = null;

  if (!accessToken && refreshToken) {
    renewed = await refreshOnce(refreshToken);
    if (!renewed) return unauthenticated();
    accessToken = renewed.accessToken;
  }
  if (!accessToken) return unauthenticated('No has iniciado sesión.');

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  const body = hasBody ? await req.arrayBuffer() : null;
  const call = (token: string) =>
    platformBackendFetch(path, {
      method: req.method,
      accessToken: token,
      headers: forwardedHeaders(req, false),
      body: body && body.byteLength > 0 ? body : null,
    });

  let backendRes = await call(accessToken);

  if (backendRes.status === 401 && refreshToken && !renewed) {
    renewed = await refreshOnce(refreshToken);
    if (!renewed) return unauthenticated();
    backendRes = await call(renewed.accessToken);
  }
  if (backendRes.status === 401) return unauthenticated();

  const forbidden = await isPlatformForbidden(backendRes);
  const noBody = backendRes.status === 204 || backendRes.status === 304;
  const headers = new Headers(NO_STORE);
  const contentType = backendRes.headers.get('content-type');
  if (contentType && !noBody) headers.set('Content-Type', contentType);

  const res = new NextResponse(noBody ? null : backendRes.body, {
    status: backendRes.status,
    headers,
  });
  if (forbidden) clearSessionCookies(res);
  else if (renewed) setSessionCookies(res, renewed);
  return res;
}
