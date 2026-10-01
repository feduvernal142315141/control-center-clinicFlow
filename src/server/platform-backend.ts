import 'server-only';
import { API_ERROR_CODES } from '@/lib/api/errors';
import { getServerEnv } from './env';

export interface BackendRequestInit {
  method?: string;
  headers?: HeadersInit;
  body?: BodyInit | null;
  accessToken?: string | null;
}

export function jsonError(status: number, code: string, message: string, details?: unknown) {
  return Response.json(
    { code, message, ...(details !== undefined ? { details } : {}) },
    { status },
  );
}

/**
 * Llama a `${PLATFORM_API_URL}${path}`. En modo mock resuelve el request con los
 * handlers MSW en el mismo proceso (sin red), así el resto del BFF corre igual que en real.
 * `path` siempre empieza con `/platform/`.
 */
export async function platformBackendFetch(
  path: string,
  init: BackendRequestInit = {},
): Promise<Response> {
  const env = getServerEnv();
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.accessToken) headers.set('Authorization', `Bearer ${init.accessToken}`);

  const request = new Request(`${env.platformApiUrl}${path}`, {
    method: init.method ?? 'GET',
    headers,
    body: init.body ?? null,
    cache: 'no-store',
    redirect: 'manual',
  });

  try {
    if (env.mocks) {
      const { resolveMockRequest } = await import('@/mocks/resolve');
      return await resolveMockRequest(request);
    }
    return await fetch(request);
  } catch (error) {
    console.error(`[bff] ${request.method} ${path} falló`, error);
    return jsonError(502, API_ERROR_CODES.BACKEND_UNAVAILABLE, 'El backend no está disponible.');
  }
}
