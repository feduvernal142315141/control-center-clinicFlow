import { getResponse } from 'msw';
import { MOCK_PLATFORM_API_URL } from '@/server/env';
import { createPlatformHandlers } from './handlers';

const handlers = createPlatformHandlers(MOCK_PLATFORM_API_URL);

/**
 * Resuelve un request al backend con los handlers MSW, en el mismo proceso del BFF.
 * Así el flujo BFF (cookies, refresh, errores) es idéntico al real.
 */
export async function resolveMockRequest(request: Request): Promise<Response> {
  const response = await getResponse(handlers, request);
  if (response) return response;
  return Response.json(
    {
      code: 'NOT_FOUND',
      message: `Mock sin handler para ${request.method} ${new URL(request.url).pathname}`,
    },
    { status: 404 },
  );
}
