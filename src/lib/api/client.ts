import type { z } from 'zod';
import { API_ERROR_CODES, ApiError, apiErrorFromResponse } from './errors';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type Query = Record<string, string | number | boolean | null | undefined>;

interface RequestOptions<S extends z.ZodType | undefined> {
  method?: Method;
  query?: Query;
  body?: unknown;
  /** Esquema de la respuesta. `undefined` para respuestas sin cuerpo (204). */
  schema: S;
  signal?: AbortSignal;
}

type Result<S> = S extends z.ZodType ? z.infer<S> : void;

function buildUrl(base: string, path: string, query?: Query): URL {
  const url = new URL(`${base}${path}`, globalThis.location?.origin ?? 'http://localhost');
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '')
      url.searchParams.set(key, String(value));
  }
  return url;
}

/**
 * Única puerta del navegador hacia el BFF. Toda falla sale como `ApiError` tipado:
 * red, HTTP no-OK, JSON inválido o respuesta que no cumple el contrato zod.
 */
async function request<S extends z.ZodType | undefined>(
  base: string,
  path: string,
  { method = 'GET', query, body, schema, signal }: RequestOptions<S>,
): Promise<Result<S>> {
  let res: Response;
  try {
    res = await fetch(buildUrl(base, path, query), {
      method,
      signal,
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    throw new ApiError({
      status: 0,
      code: API_ERROR_CODES.NETWORK_ERROR,
      message: 'No se pudo contactar al servidor. Revisa tu conexión.',
      details: String(cause),
    });
  }

  if (!res.ok) throw await apiErrorFromResponse(res);
  if (schema === undefined) return undefined as Result<S>;

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new ApiError({
      status: res.status,
      code: API_ERROR_CODES.UNEXPECTED_RESPONSE,
      message: 'El servidor devolvió una respuesta ilegible.',
    });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    console.error(`[api] ${method} ${path} no cumple el contrato`, parsed.error.issues);
    throw new ApiError({
      status: res.status,
      code: API_ERROR_CODES.CONTRACT_MISMATCH,
      message: 'La respuesta del servidor no tiene el formato esperado.',
      details: parsed.error.issues,
    });
  }
  return parsed.data as Result<S>;
}

/** Llamadas a `/platform/**` del backend, siempre vía BFF (`/api/platform/**`). */
export const platformRequest = <S extends z.ZodType | undefined>(
  path: string,
  opts: RequestOptions<S>,
) => request('/api/platform', path, opts);

/** Llamadas a los endpoints de sesión del BFF (`/api/auth/**`). */
export const authRequest = <S extends z.ZodType | undefined>(
  path: string,
  opts: RequestOptions<S>,
) => request('/api/auth', path, opts);
