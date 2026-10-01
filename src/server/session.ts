import type { NextRequest, NextResponse } from 'next/server';
import type { BackendTokens } from '@/lib/api/schemas';

/**
 * Cookies de sesión del BFF. Todas httpOnly + Secure + SameSite=Strict:
 * el navegador nunca puede leer los tokens.
 */
export const SESSION_COOKIES = {
  access: 'kw_at',
  refresh: 'kw_rt',
  mfa: 'kw_mfa',
} as const;

const MFA_TTL_SECONDS = 5 * 60;

const baseCookie = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict' as const,
  path: '/',
};

export function readSession(req: NextRequest) {
  return {
    accessToken: req.cookies.get(SESSION_COOKIES.access)?.value ?? null,
    refreshToken: req.cookies.get(SESSION_COOKIES.refresh)?.value ?? null,
    mfaToken: req.cookies.get(SESSION_COOKIES.mfa)?.value ?? null,
  };
}

export function hasSessionCookie(req: NextRequest): boolean {
  return req.cookies.has(SESSION_COOKIES.access) || req.cookies.has(SESSION_COOKIES.refresh);
}

export function setSessionCookies(res: NextResponse, tokens: BackendTokens) {
  res.cookies.set(SESSION_COOKIES.access, tokens.accessToken, {
    ...baseCookie,
    maxAge: tokens.expiresIn,
  });
  res.cookies.set(SESSION_COOKIES.refresh, tokens.refreshToken, {
    ...baseCookie,
    ...(tokens.refreshExpiresIn ? { maxAge: tokens.refreshExpiresIn } : {}),
  });
  res.cookies.delete({ name: SESSION_COOKIES.mfa, path: '/' });
}

export function setMfaCookie(res: NextResponse, mfaToken: string) {
  res.cookies.set(SESSION_COOKIES.mfa, mfaToken, { ...baseCookie, maxAge: MFA_TTL_SECONDS });
}

export function clearSessionCookies(res: NextResponse) {
  for (const name of Object.values(SESSION_COOKIES)) {
    res.cookies.set(name, '', { ...baseCookie, maxAge: 0 });
  }
}
