import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { platformApi } from './endpoints/platform';
import { ApiError } from './errors';

const ME_URL = 'http://localhost:3000/api/platform/me';
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('platformRequest', () => {
  it('llama al BFF (nunca al backend) y valida con zod', async () => {
    server.use(
      http.get(ME_URL, () =>
        HttpResponse.json({
          id: 'u1',
          email: 'a@kodewave.com',
          fullName: 'Ana',
          roles: ['SUPER_ADMIN'],
          mfaEnabled: false,
        }),
      ),
    );
    await expect(platformApi.me()).resolves.toMatchObject({ email: 'a@kodewave.com' });
  });

  it('lanza CONTRACT_MISMATCH si la respuesta no cumple el contrato', async () => {
    server.use(http.get(ME_URL, () => HttpResponse.json({ id: 1 })));
    await expect(platformApi.me()).rejects.toMatchObject({ code: 'CONTRACT_MISMATCH' });
  });

  it('propaga el error tipado del backend', async () => {
    server.use(
      http.get(ME_URL, () =>
        HttpResponse.json({ code: 'PLATFORM_FORBIDDEN', message: 'No' }, { status: 403 }),
      ),
    );
    const error = await platformApi.me().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 403, code: 'PLATFORM_FORBIDDEN', isAuthError: true });
  });

  it('convierte fallas de red en NETWORK_ERROR', async () => {
    server.use(http.get(ME_URL, () => HttpResponse.error()));
    await expect(platformApi.me()).rejects.toMatchObject({ code: 'NETWORK_ERROR', status: 0 });
  });
});
