import { RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

/** D16: aviso de VERSION_CONFLICT. Las ediciones del usuario se conservan. */
export function ConflictBanner({ onDiscard }: { onDiscard: () => void }) {
  return (
    <Alert variant="destructive" data-testid="version-conflict">
      <RefreshCw />
      <AlertTitle>Alguien modificó esto mientras editabas</AlertTitle>
      <AlertDescription>
        <p>
          Recargamos los datos del servidor y conservamos tus cambios. Revísalos y guarda de nuevo,
          o descártalos para quedarte con la versión actual.
        </p>
        <Button type="button" variant="outline" size="sm" className="mt-1" onClick={onDiscard}>
          Descartar mis cambios
        </Button>
      </AlertDescription>
    </Alert>
  );
}
