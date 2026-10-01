import { describe, expect, it } from 'vitest';
import { ApiError, apiErrorFromResponse, fieldErrorsOf } from './errors';

describe('apiErrorFromResponse', () => {
  it('respeta el formato { code, message, details } del backend', async () => {
    const res = Response.json(
      { code: 'MODULE_DEPENDENCY_CYCLE', message: 'Ciclo', details: { cycle: ['A', 'B', 'A'] } },
      { status: 409 },
    );
    const error = await apiErrorFromResponse(res);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      code: 'MODULE_DEPENDENCY_CYCLE',
      message: 'Ciclo',
      details: { cycle: ['A', 'B', 'A'] },
    });
  });

  it('nunca pierde el error si el cuerpo no es JSON', async () => {
    const error = await apiErrorFromResponse(new Response('<html>502</html>', { status: 502 }));
    expect(error.code).toBe('UNEXPECTED_RESPONSE');
    expect(error.message).toMatch(/backend no está disponible/);
  });

  it('un 401 sin cuerpo es UNAUTHENTICATED y error de sesión', async () => {
    const error = await apiErrorFromResponse(new Response(null, { status: 401 }));
    expect(error.code).toBe('UNAUTHENTICATED');
    expect(error.isAuthError).toBe(true);
  });

  it('PLATFORM_FORBIDDEN es error de sesión (logout + login)', async () => {
    const error = await apiErrorFromResponse(
      Response.json({ code: 'PLATFORM_FORBIDDEN', message: 'x' }, { status: 403 }),
    );
    expect(error.isAuthError).toBe(true);
  });

  it('otros 403 no cierran sesión', () => {
    expect(new ApiError({ status: 403, code: 'FORBIDDEN', message: 'x' }).isAuthError).toBe(false);
  });

  it('un 401 de login (credenciales o código 2FA) no es sesión caída', () => {
    for (const code of ['INVALID_CREDENTIALS', 'INVALID_MFA_CODE', 'MFA_SESSION_EXPIRED']) {
      expect(new ApiError({ status: 401, code, message: 'x' }).isAuthError).toBe(false);
    }
  });
});

describe('fieldErrorsOf', () => {
  it('extrae errores por campo de VALIDATION_ERROR', () => {
    const error = new ApiError({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Datos inválidos',
      details: { fields: [{ field: 'slug', message: 'Ese slug ya está en uso' }] },
    });
    expect(fieldErrorsOf(error)).toEqual([{ field: 'slug', message: 'Ese slug ya está en uso' }]);
  });

  it('devuelve [] para otros errores', () => {
    expect(fieldErrorsOf(new Error('x'))).toEqual([]);
    expect(fieldErrorsOf(new ApiError({ status: 409, code: 'X', message: 'x' }))).toEqual([]);
  });
});
