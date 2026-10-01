import { z } from 'zod';

/** Roles internos de KodeWave. V1 solo usa SUPER_ADMIN; el modelo queda abierto. */
export const platformRoleSchema = z.enum(['SUPER_ADMIN']);
export type PlatformRole = z.infer<typeof platformRoleSchema>;

export const platformMeSchema = z.object({
  id: z.string(),
  email: z.email(),
  fullName: z.string(),
  roles: z.array(platformRoleSchema),
  mfaEnabled: z.boolean(),
});
export type PlatformMe = z.infer<typeof platformMeSchema>;

export const loginInputSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('Correo inválido')),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});
export type LoginInput = z.infer<typeof loginInputSchema>;

export const mfaInputSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'El código tiene 6 dígitos'),
});
export type MfaInput = z.infer<typeof mfaInputSchema>;

// ---- Backend (/platform/auth/*) ----

export const backendTokensSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  /** Segundos de vida del access token. */
  expiresIn: z.number().int().positive(),
  /** Segundos de vida del refresh token. Si falta, la cookie es de sesión. */
  refreshExpiresIn: z.number().int().positive().optional(),
});
export type BackendTokens = z.infer<typeof backendTokensSchema>;

export const backendMfaChallengeSchema = z.object({
  mfaRequired: z.literal(true),
  mfaToken: z.string().min(1),
});

export const backendLoginResponseSchema = z.union([backendMfaChallengeSchema, backendTokensSchema]);

// ---- BFF (/api/auth/*) ----

export const bffAuthResultSchema = z.object({
  status: z.enum(['AUTHENTICATED', 'MFA_REQUIRED']),
});
export type BffAuthResult = z.infer<typeof bffAuthResultSchema>;
