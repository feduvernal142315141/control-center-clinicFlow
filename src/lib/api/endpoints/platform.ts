import { platformRequest } from '../client';
import { dashboardSchema, platformMeSchema } from '../schemas';

/**
 * Endpoints de `/platform/**`. Cada fase agrega aquí sus llamadas;
 * los componentes nunca usan fetch directo.
 */
export const platformApi = {
  me: (signal?: AbortSignal) => platformRequest('/me', { schema: platformMeSchema, signal }),
  dashboard: (signal?: AbortSignal) =>
    platformRequest('/dashboard', { schema: dashboardSchema, signal }),
};
