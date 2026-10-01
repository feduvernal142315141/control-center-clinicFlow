'use client';

import { AlertTriangle, RotateCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { errorMessage, isApiError } from '@/lib/api/errors';

/** Error visible y accionable. Muestra el código para que operaciones pueda reportarlo. */
export function ErrorState({
  error,
  title = 'No se pudo cargar la información',
  onRetry,
}: {
  error: unknown;
  title?: string;
  onRetry?: () => void;
}) {
  return (
    <Alert variant="destructive">
      <AlertTriangle />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <p>{errorMessage(error)}</p>
        {isApiError(error) && (
          <p className="font-mono text-xs opacity-80">
            {error.code}
            {error.status ? ` · HTTP ${error.status}` : ''}
          </p>
        )}
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} className="mt-2">
            <RotateCw /> Reintentar
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
