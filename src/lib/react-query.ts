import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { authApi } from './api/endpoints/auth';
import { isApiError } from './api/errors';

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: {
      /** Título del toast de error. `false` = el componente maneja el error (p. ej. formularios). */
      errorToast?: string | false;
    };
  }
}

let redirecting = false;

/** Sesión inválida o token que no es de plataforma: cerrar sesión y volver al login. */
async function handleAuthFailure(code: string) {
  if (redirecting || typeof window === 'undefined') return;
  redirecting = true;
  try {
    await authApi.logout();
  } catch (error) {
    console.error('[auth] logout tras sesión inválida falló', error);
  }
  const params = new URLSearchParams({
    reason: code === 'PLATFORM_FORBIDDEN' ? 'forbidden' : 'expired',
  });
  const here = `${window.location.pathname}${window.location.search}`;
  if (here !== '/') params.set('next', here);
  window.location.assign(`/login?${params}`);
}

export function createQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => {
        if (isApiError(error) && error.isAuthError) void handleAuthFailure(error.code);
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _vars, _ctx, mutation) => {
        if (isApiError(error) && error.isAuthError) {
          void handleAuthFailure(error.code);
          return;
        }
        const title = mutation.meta?.errorToast;
        if (title === false) return;
        toast.error(title ?? 'La operación falló', {
          description: isApiError(error) ? `${error.message} (${error.code})` : String(error),
        });
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Solo vale la pena reintentar fallas transitorias: red caída o 5xx.
        retry: (failureCount, error) =>
          failureCount < 2 && (!isApiError(error) || error.status === 0 || error.status >= 500),
      },
      mutations: { retry: false },
    },
  });
}
