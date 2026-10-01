import { NextResponse, type NextRequest } from 'next/server';
import { hasSessionCookie } from '@/server/session';

/**
 * Solo verifica que exista sesión. La autorización real la hace el backend.
 */
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const authenticated = hasSessionCookie(req);

  if (pathname === '/login') {
    if (authenticated) return NextResponse.redirect(new URL('/', req.url));
    return NextResponse.next();
  }

  if (authenticated) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { code: 'UNAUTHENTICATED', message: 'No has iniciado sesión.' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const login = new URL('/login', req.url);
  if (pathname !== '/') login.searchParams.set('next', `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  // /api/auth/* es público; estáticos y favicon fuera.
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico|robots.txt).*)'],
};
