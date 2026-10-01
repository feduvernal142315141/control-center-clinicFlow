import 'server-only';
import { isApiMocksEnabled } from '@/config/features';

/** Base usada por los handlers MSW cuando el BFF corre en modo mock. */
export const MOCK_PLATFORM_API_URL = 'http://platform.mock';

export interface ServerEnv {
  platformApiUrl: string;
  mocks: boolean;
}

/** Se evalúa en cada request (no en import) para que `next build` no exija variables. */
export function getServerEnv(): ServerEnv {
  const mocks = isApiMocksEnabled();
  if (mocks) {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_MOCKS_IN_PRODUCTION !== 'true') {
      throw new Error(
        'NEXT_PUBLIC_API_MOCKS=true en producción. Define ALLOW_MOCKS_IN_PRODUCTION=true solo para e2e/CI.',
      );
    }
    return { platformApiUrl: MOCK_PLATFORM_API_URL, mocks };
  }
  const url = process.env.PLATFORM_API_URL;
  if (!url) throw new Error('Falta PLATFORM_API_URL (o activa NEXT_PUBLIC_API_MOCKS=true).');
  return { platformApiUrl: url.replace(/\/+$/, ''), mocks };
}
