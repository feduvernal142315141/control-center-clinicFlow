// @vitest-environment node
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { NextRequest } from 'next/server';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetRefreshCache,
  handleLogin,
  handleLogout,
  handleMfaVerify,
  proxyToPlatform,
} from './bff';

const BACKEND = 'http://backend.test';
const APP = 'http://localhost:3000';
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_API_MOCKS', 'false');
  vi.stubEnv('NEXT_PUBLIC_FEATURE_MFA', 'true');
  vi.stubEnv('PLATFORM_API_URL', BACKEND);
  __resetRefreshCache();
});

function req(
  path: string,
  {
    method = 'GET',
    cookies = {},
    body,
    origin = APP,
  }: {
    method?: string;
    cookies?: Record<string, string>;
    body?: unknown;
    origin?: string | null;
  } = {},
) {
  const headers = new Headers({ host: 'localhost:3000' });
  if (origin) headers.set('origin', origin);
  const cookie = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
  if (cookie) headers.set('cookie', cookie);
  if (body !== undefined) headers.set('content-type', 'application/json');
  return new NextRequest(`${APP}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

const tokens = (n: number) => ({
  accessToken: `at-${n}`,
  refreshToken: `rt-${n}`,
  expiresIn: 900,
  refreshExpiresIn: 28800,
});

function setCookie(res: Response, name: string) {
  return res.headers.getSetCookie().find((c) => c.startsWith(`${name}=`));
}

describe('handleLogin', () => {
  it('guarda tokens en cookies httpOnly + Secure + SameSite=Strict y no los devuelve en el body', async () => {
    server.use(http.post(`${BACKEND}/platform/auth/login`, () => HttpResponse.json(tokens(1))));
    const res = await handleLogin(
      req('/api/auth/login', { method: 'POST', body: { email: 'a@kodewave.com', password: 'x' } }),
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ status: 'AUTHENTICATED' });
    expect(text).not.toContain('at-1');
    for (const name of ['kw_at', 'kw_rt']) {
      const c = setCookie(res, name)!;
      expect(c).toMatch(/HttpOnly/i);
      expect(c).toMatch(/Secure/i);
      expect(c).toMatch(/SameSite=Strict/i);
    }
    expect(setCookie(res, 'kw_at')).toContain('kw_at=at-1');
  });

  it('reenvía el error del backend (rate limit) sin crear sesión', async () => {
    server.use(
      http.post(`${BACKEND}/platform/auth/login`, () =>
        HttpResponse.json({ code: 'RATE_LIMITED', message: 'Espera' }, { status: 429 }),
      ),
    );
    const res = await handleLogin(
      req('/api/auth/login', { method: 'POST', body: { email: 'a@kodewave.com', password: 'x' } }),
    );
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ code: 'RATE_LIMITED', message: 'Espera' });
    expect(setCookie(res, 'kw_at')).toBeUndefined();
  });

  it('valida la entrada antes de llamar al backend', async () => {
    const res = await handleLogin(
      req('/api/auth/login', { method: 'POST', body: { email: 'no' } }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('VALIDATION_ERROR');
  });

  it('rechaza mutaciones de otro origen (CSRF)', async () => {
    const res = await handleLogin(
      req('/api/auth/login', {
        method: 'POST',
        origin: 'https://evil.com',
        body: { email: 'a@kodewave.com', password: 'x' },
      }),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe('CSRF_REJECTED');
  });

  it('con 2FA: guarda el mfaToken en cookie httpOnly y pide código', async () => {
    server.use(
      http.post(`${BACKEND}/platform/auth/login`, () =>
        HttpResponse.json({ mfaRequired: true, mfaToken: 'mfa-1' }),
      ),
    );
    const res = await handleLogin(
      req('/api/auth/login', { method: 'POST', body: { email: 'a@kodewave.com', password: 'x' } }),
    );
    expect(await res.json()).toEqual({ status: 'MFA_REQUIRED' });
    expect(setCookie(res, 'kw_mfa')).toMatch(/HttpOnly/i);
    expect(setCookie(res, 'kw_at')).toBeUndefined();
  });

  it('con 2FA y el flag apagado: error explícito', async () => {
    vi.stubEnv('NEXT_PUBLIC_FEATURE_MFA', 'false');
    server.use(
      http.post(`${BACKEND}/platform/auth/login`, () =>
        HttpResponse.json({ mfaRequired: true, mfaToken: 'mfa-1' }),
      ),
    );
    const res = await handleLogin(
      req('/api/auth/login', { method: 'POST', body: { email: 'a@kodewave.com', password: 'x' } }),
    );
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('MFA_NOT_SUPPORTED');
  });
});

describe('handleMfaVerify', () => {
  it('envía mfaToken (de la cookie) + código y crea la sesión', async () => {
    let received: unknown;
    server.use(
      http.post(`${BACKEND}/platform/auth/mfa/verify`, async ({ request }) => {
        received = await request.json();
        return HttpResponse.json(tokens(2));
      }),
    );
    const res = await handleMfaVerify(
      req('/api/auth/mfa', {
        method: 'POST',
        cookies: { kw_mfa: 'mfa-1' },
        body: { code: '123456' },
      }),
    );
    expect(res.status).toBe(200);
    expect(received).toEqual({ mfaToken: 'mfa-1', code: '123456' });
    expect(setCookie(res, 'kw_at')).toContain('at-2');
  });

  it('sin cookie mfa responde MFA_SESSION_EXPIRED', async () => {
    const res = await handleMfaVerify(
      req('/api/auth/mfa', { method: 'POST', body: { code: '123456' } }),
    );
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe('MFA_SESSION_EXPIRED');
  });
});

describe('proxyToPlatform', () => {
  it('agrega el Bearer y reenvía query string y status', async () => {
    let auth: string | null = null;
    let search = '';
    server.use(
      http.get(`${BACKEND}/platform/clinics`, ({ request }) => {
        auth = request.headers.get('authorization');
        search = new URL(request.url).search;
        return HttpResponse.json({ ok: true });
      }),
    );
    const res = await proxyToPlatform(
      req('/api/platform/clinics?q=dental&page=1', { cookies: { kw_at: 'at-1', kw_rt: 'rt-1' } }),
      ['clinics'],
    );
    expect(res.status).toBe(200);
    expect(auth).toBe('Bearer at-1');
    expect(search).toBe('?q=dental&page=1');
  });

  it('ante 401 refresca una vez, reintenta y rota las cookies', async () => {
    const seen: (string | null)[] = [];
    server.use(
      http.get(`${BACKEND}/platform/me`, ({ request }) => {
        const auth = request.headers.get('authorization');
        seen.push(auth);
        return auth === 'Bearer at-2'
          ? HttpResponse.json({ ok: true })
          : HttpResponse.json({ code: 'UNAUTHENTICATED', message: 'exp' }, { status: 401 });
      }),
      http.post(`${BACKEND}/platform/auth/refresh`, async ({ request }) => {
        expect(await request.json()).toEqual({ refreshToken: 'rt-1' });
        return HttpResponse.json(tokens(2));
      }),
    );
    const res = await proxyToPlatform(
      req('/api/platform/me', { cookies: { kw_at: 'at-1', kw_rt: 'rt-1' } }),
      ['me'],
    );
    expect(res.status).toBe(200);
    expect(seen).toEqual(['Bearer at-1', 'Bearer at-2']);
    expect(setCookie(res, 'kw_at')).toContain('at-2');
    expect(setCookie(res, 'kw_rt')).toContain('rt-2');
  });

  it('sin access token pero con refresh: refresca antes de llamar', async () => {
    server.use(
      http.post(`${BACKEND}/platform/auth/refresh`, () => HttpResponse.json(tokens(3))),
      http.get(`${BACKEND}/platform/me`, ({ request }) =>
        HttpResponse.json({ auth: request.headers.get('authorization') }),
      ),
    );
    const res = await proxyToPlatform(req('/api/platform/me', { cookies: { kw_rt: 'rt-1' } }), [
      'me',
    ]);
    expect(await res.json()).toEqual({ auth: 'Bearer at-3' });
  });

  it('si el refresh falla: 401 y borra cookies', async () => {
    server.use(
      http.get(`${BACKEND}/platform/me`, () => new HttpResponse(null, { status: 401 })),
      http.post(`${BACKEND}/platform/auth/refresh`, () => new HttpResponse(null, { status: 401 })),
    );
    const res = await proxyToPlatform(
      req('/api/platform/me', { cookies: { kw_at: 'at-1', kw_rt: 'rt-1' } }),
      ['me'],
    );
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe('UNAUTHENTICATED');
    expect(setCookie(res, 'kw_at')).toMatch(/Max-Age=0/i);
    expect(setCookie(res, 'kw_rt')).toMatch(/Max-Age=0/i);
  });

  it('requests concurrentes comparten un solo refresh', async () => {
    let refreshes = 0;
    server.use(
      http.get(`${BACKEND}/platform/:any`, ({ request }) =>
        request.headers.get('authorization') === 'Bearer at-9'
          ? HttpResponse.json({ ok: true })
          : new HttpResponse(null, { status: 401 }),
      ),
      http.post(`${BACKEND}/platform/auth/refresh`, () => {
        refreshes += 1;
        return HttpResponse.json(tokens(9));
      }),
    );
    const cookies = { kw_at: 'at-1', kw_rt: 'rt-1' };
    const results = await Promise.all([
      proxyToPlatform(req('/api/platform/me', { cookies }), ['me']),
      proxyToPlatform(req('/api/platform/dashboard', { cookies }), ['dashboard']),
    ]);
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    expect(refreshes).toBe(1);
  });

  it('PLATFORM_FORBIDDEN: reenvía el error y borra la sesión', async () => {
    server.use(
      http.get(`${BACKEND}/platform/me`, () =>
        HttpResponse.json({ code: 'PLATFORM_FORBIDDEN', message: 'No' }, { status: 403 }),
      ),
    );
    const res = await proxyToPlatform(req('/api/platform/me', { cookies: { kw_at: 'at-1' } }), [
      'me',
    ]);
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe('PLATFORM_FORBIDDEN');
    expect(setCookie(res, 'kw_at')).toMatch(/Max-Age=0/i);
  });

  it('nunca expone /platform/auth/* por el proxy', async () => {
    const res = await proxyToPlatform(
      req('/api/platform/auth/refresh', { method: 'POST', cookies: { kw_at: 'at-1' }, body: {} }),
      ['auth', 'refresh'],
    );
    expect(res.status).toBe(404);
  });

  it('reenvía el body en mutaciones', async () => {
    let body: unknown;
    server.use(
      http.post(`${BACKEND}/platform/clinics/c-1/suspend`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ok: true });
      }),
    );
    const res = await proxyToPlatform(
      req('/api/platform/clinics/c-1/suspend', {
        method: 'POST',
        cookies: { kw_at: 'at-1' },
        body: { reason: 'Falta de pago confirmada' },
      }),
      ['clinics', 'c-1', 'suspend'],
    );
    expect(res.status).toBe(200);
    expect(body).toEqual({ reason: 'Falta de pago confirmada' });
  });

  it('backend caído → 502 BACKEND_UNAVAILABLE', async () => {
    server.use(http.get(`${BACKEND}/platform/me`, () => HttpResponse.error()));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await proxyToPlatform(req('/api/platform/me', { cookies: { kw_at: 'at-1' } }), [
      'me',
    ]);
    expect(res.status).toBe(502);
    expect((await res.json()).code).toBe('BACKEND_UNAVAILABLE');
  });
});

describe('handleLogout', () => {
  it('invalida el refresh en el backend y borra cookies', async () => {
    let body: unknown;
    server.use(
      http.post(`${BACKEND}/platform/auth/logout`, async ({ request }) => {
        body = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const res = await handleLogout(
      req('/api/auth/logout', { method: 'POST', cookies: { kw_at: 'at-1', kw_rt: 'rt-1' } }),
    );
    expect(res.status).toBe(204);
    expect(body).toEqual({ refreshToken: 'rt-1' });
    expect(setCookie(res, 'kw_rt')).toMatch(/Max-Age=0/i);
  });
});

describe('modo mock (MSW en el BFF)', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_API_MOCKS', 'true');
    vi.stubEnv('PLATFORM_API_URL', '');
  });

  it('login + /me funcionan de punta a punta sin backend', async () => {
    const login = await handleLogin(
      req('/api/auth/login', {
        method: 'POST',
        body: { email: 'admin@kodewave.com', password: 'KodeWave2026!' },
      }),
    );
    expect(login.status).toBe(200);
    const at = login.cookies.get('kw_at')!.value;
    const me = await proxyToPlatform(req('/api/platform/me', { cookies: { kw_at: at } }), ['me']);
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({ email: 'admin@kodewave.com', roles: ['SUPER_ADMIN'] });
  });

  it('se niega a correr con mocks en producción sin opt-in', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    await expect(
      handleLogin(
        req('/api/auth/login', {
          method: 'POST',
          body: { email: 'admin@kodewave.com', password: 'x' },
        }),
      ),
    ).rejects.toThrow(/ALLOW_MOCKS_IN_PRODUCTION/);
  });
});
