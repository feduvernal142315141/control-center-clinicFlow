import Link from 'next/link';
import { SearchX } from 'lucide-react';
import { EmptyState } from '@/components/states/empty-state';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <EmptyState
        icon={SearchX}
        title="Página no encontrada"
        description="La ruta que buscas no existe."
        action={
          <Button asChild variant="outline">
            <Link href="/">Ir al dashboard</Link>
          </Button>
        }
      />
    </main>
  );
}
