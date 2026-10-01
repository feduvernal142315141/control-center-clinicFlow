import { z } from 'zod';

/** Formato de error del backend (y del BFF): `{ code, message, details? }`. */
export const apiErrorBodySchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});
export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>;

export const API_ERROR_CODES = {
  // Backend (sección 7.4)
  PLATFORM_FORBIDDEN: 'PLATFORM_FORBIDDEN',
  MODULE_DEPENDENCY_CYCLE: 'MODULE_DEPENDENCY_CYCLE',
  MODULE_DEPENDENCY_SELF: 'MODULE_DEPENDENCY_SELF',
  REQUIRED_CORE_IMMUTABLE: 'REQUIRED_CORE_IMMUTABLE',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  /** D16: la entidad cambió desde que se cargó (version distinta). */
  VERSION_CONFLICT: 'VERSION_CONFLICT',
  // Auth
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  INVALID_MFA_CODE: 'INVALID_MFA_CODE',
  MFA_SESSION_EXPIRED: 'MFA_SESSION_EXPIRED',
  MFA_NOT_SUPPORTED: 'MFA_NOT_SUPPORTED',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  RATE_LIMITED: 'RATE_LIMITED',
  // BFF / cliente
  CSRF_REJECTED: 'CSRF_REJECTED',
  BACKEND_UNAVAILABLE: 'BACKEND_UNAVAILABLE',
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNEXPECTED_RESPONSE: 'UNEXPECTED_RESPONSE',
  CONTRACT_MISMATCH: 'CONTRACT_MISMATCH',
  NOT_FOUND: 'NOT_FOUND',
} as const;
export type KnownApiErrorCode = keyof typeof API_ERROR_CODES;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(params: { status: number; code: string; message: string; details?: unknown }) {
    super(params.message);
    this.name = 'ApiError';
    this.status = params.status;
    this.code = params.code;
    this.details = params.details;
  }

  /**
   * La sesión ya no es válida: hay que volver al login. Se decide por código, no por
   * status: un 401 de login (INVALID_CREDENTIALS, INVALID_MFA_CODE) no es sesión caída.
   */
  get isAuthError(): boolean {
    return (
      this.code === API_ERROR_CODES.UNAUTHENTICATED ||
      this.code === API_ERROR_CODES.PLATFORM_FORBIDDEN
    );
  }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;

const FALLBACK_MESSAGES: Record<number, string> = {
  400: 'Solicitud inválida.',
  401: 'Tu sesión expiró. Vuelve a iniciar sesión.',
  403: 'No tienes permiso para esta acción.',
  404: 'Recurso no encontrado.',
  409: 'Conflicto con el estado actual.',
  423: 'Cuenta bloqueada.',
  429: 'Demasiados intentos. Espera un momento.',
  502: 'El backend no está disponible.',
  503: 'El backend no está disponible.',
};

/** Convierte cualquier respuesta no-OK en un ApiError tipado. Nunca lanza otra cosa. */
export async function apiErrorFromResponse(res: Response): Promise<ApiError> {
  let raw: unknown = undefined;
  try {
    raw = await res.json();
  } catch {
    // cuerpo vacío o no-JSON: se usa el fallback de abajo
  }
  const parsed = apiErrorBodySchema.safeParse(raw);
  if (parsed.success) return new ApiError({ status: res.status, ...parsed.data });
  return new ApiError({
    status: res.status,
    code:
      res.status === 401 ? API_ERROR_CODES.UNAUTHENTICATED : API_ERROR_CODES.UNEXPECTED_RESPONSE,
    message: FALLBACK_MESSAGES[res.status] ?? `Error inesperado (HTTP ${res.status}).`,
    details: raw,
  });
}

// ---- VALIDATION_ERROR → errores por campo ----

export const validationDetailsSchema = z.object({
  fields: z.array(z.object({ field: z.string(), message: z.string() })),
});

/** Extrae errores por campo de un VALIDATION_ERROR. Devuelve [] si no aplica. */
export function fieldErrorsOf(error: unknown): { field: string; message: string }[] {
  if (!isApiError(error) || error.code !== API_ERROR_CODES.VALIDATION_ERROR) return [];
  const parsed = validationDetailsSchema.safeParse(error.details);
  return parsed.success ? parsed.data.fields : [];
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Ocurrió un error inesperado.';
}

export const isVersionConflict = (error: unknown): error is ApiError =>
  isApiError(error) && error.code === API_ERROR_CODES.VERSION_CONFLICT;
