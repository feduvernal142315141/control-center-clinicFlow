'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/states/error-state';

export default function AppError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error('[ui] error no controlado', error);
  }, [error]);
  return <ErrorState error={error} title="Algo salió mal en esta página" onRetry={reset} />;
}
