'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';

/**
 * Actualiza el query string partiendo de la última URL escrita, no solo de la que ya
 * renderizó: `router.replace` es asíncrono y dos cambios seguidos se pisarían.
 */
export function useSearchParamsUpdater() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const pending = useRef<string | null>(null);
  const current = params.toString();

  useEffect(() => {
    if (pending.current === current) pending.current = null;
  }, [current]);

  return (mutate: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(pending.current ?? current);
    mutate(next);
    const qs = next.toString();
    pending.current = qs;
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
}
