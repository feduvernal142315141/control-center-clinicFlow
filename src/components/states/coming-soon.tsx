import { Construction } from 'lucide-react';
import { EmptyState } from './empty-state';

export function ComingSoon({ phase }: { phase: string }) {
  return (
    <EmptyState
      icon={Construction}
      title="En construcción"
      description={`Esta sección llega en la fase ${phase}.`}
    />
  );
}
