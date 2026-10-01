'use client';

import { useMutation } from '@tanstack/react-query';
import { authApi } from '../endpoints/auth';

export function useLogout() {
  return useMutation({
    mutationFn: authApi.logout,
    meta: { errorToast: 'No se pudo cerrar la sesión' },
    // Recarga completa: descarta caché y estado en memoria sin que las queries activas
    // se re-disparen (y fallen con 401) antes de salir.
    onSuccess: () => window.location.assign('/login'),
  });
}
