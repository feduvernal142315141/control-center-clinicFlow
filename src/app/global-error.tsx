'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error('[ui] error global', error);
  }, [error]);
  return (
    <html lang="es">
      <body style={{ fontFamily: 'system-ui', padding: 32 }}>
        <h1>Algo salió mal</h1>
        <p>{error.message}</p>
        <button type="button" onClick={reset}>
          Reintentar
        </button>
      </body>
    </html>
  );
}
