'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Control de concurrencia optimista en el cliente (D16).
 *
 * - `baseVersion` es la versión sobre la que el usuario está editando: se manda en el PUT.
 * - Si el servidor cambia y el usuario NO tiene cambios, se adopta lo nuevo en silencio.
 * - Si el servidor cambia y el usuario SÍ tiene cambios, se conserva su edición y la
 *   `baseVersion` vieja: el próximo PUT dará VERSION_CONFLICT y no pisará nada a ciegas.
 * - Ante VERSION_CONFLICT: se recarga, se conservan las ediciones y se adopta la versión
 *   nueva, para que guardar de nuevo sea una decisión consciente.
 */
export function useOptimisticVersion<T extends { version: number }>(
  server: T,
  { isDirty, resetTo }: { isDirty: boolean; resetTo: (server: T) => void },
) {
  const [baseVersion, setBaseVersion] = useState(server.version);
  const [conflict, setConflict] = useState(false);
  const lastSeen = useRef(server.version);
  const resetRef = useRef(resetTo);
  resetRef.current = resetTo;

  useEffect(() => {
    if (server.version === lastSeen.current) return;
    lastSeen.current = server.version;
    if (!isDirty) {
      resetRef.current(server);
      setBaseVersion(server.version);
      setConflict(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo cuando cambia la versión
  }, [server.version]);

  return {
    baseVersion,
    conflict,
    /** Llamar con una función que recarga y devuelve la versión actual del servidor. */
    onConflict: async (reload: () => Promise<number | undefined>) => {
      setConflict(true);
      const latest = await reload();
      if (latest !== undefined) {
        lastSeen.current = latest;
        setBaseVersion(latest);
      }
    },
    /** El usuario descarta sus cambios y toma lo del servidor. */
    discard: () => {
      resetRef.current(server);
      lastSeen.current = server.version;
      setBaseVersion(server.version);
      setConflict(false);
    },
    /** Tras guardar bien: adopta la respuesta del servidor. */
    onSaved: (saved: T) => {
      resetRef.current(saved);
      lastSeen.current = saved.version;
      setBaseVersion(saved.version);
      setConflict(false);
    },
  };
}
