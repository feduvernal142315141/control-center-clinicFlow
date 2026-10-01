// @vitest-environment node
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { config, middleware } from './middleware';

const request = (path: string, cookie?: string) =>
  new NextRequest(`http://localhost:3000${path}`, { headers: cookie ? { cookie } : {} });

describe('middleware', () => {
  it('sin sesión redirige a /login conservando la ruta', () => {
    const res = middleware(request('/clinicas?page=2'));
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get('location')!);
    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('next')).toBe('/clinicas?page=2');
  });

  it('sin sesión, /api/platform responde 401 JSON', async () => {
    const res = middleware(request('/api/platform/me'));
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe('UNAUTHENTICATED');
  });

  it('con cookie de sesión deja pasar', () => {
    expect(middleware(request('/clinicas', 'kw_at=x')).headers.get('x-middleware-next')).toBe('1');
    expect(middleware(request('/', 'kw_rt=x')).headers.get('x-middleware-next')).toBe('1');
  });

  it('con sesión, /login redirige al dashboard', () => {
    const res = middleware(request('/login', 'kw_at=x'));
    expect(new URL(res.headers.get('location')!).pathname).toBe('/');
  });

  it('no intercepta /api/auth ni estáticos', () => {
    const matcher = new RegExp(`^${config.matcher[0]}$`);
    expect(matcher.test('/api/auth/login')).toBe(false);
    expect(matcher.test('/_next/static/x.js')).toBe(false);
    expect(matcher.test('/clinicas')).toBe(true);
    expect(matcher.test('/api/platform/me')).toBe(true);
  });
});
