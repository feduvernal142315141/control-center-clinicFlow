/**
 * Flags públicos. Next.js incrusta `NEXT_PUBLIC_*` en build: cambiarlos requiere
 * reiniciar `next dev` o reconstruir.
 */
export const isApiMocksEnabled = () => process.env.NEXT_PUBLIC_API_MOCKS === 'true';
export const isMfaEnabled = () => process.env.NEXT_PUBLIC_FEATURE_MFA === 'true';
