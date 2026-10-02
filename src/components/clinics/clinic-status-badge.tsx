import { CircleDashed } from 'lucide-react';
import { Badge, StatusDot } from '@/components/ui/badge';
import type { OperationalStatus } from '@/lib/api/schemas';
import { OPERATIONAL_STATUS_LABEL } from '@/lib/format';

const VARIANT = {
  ACTIVE: 'success',
  SUSPENDED: 'destructive',
  INACTIVE: 'outline',
} as const;

/** Estado operativo: siempre punto + texto, nunca solo color. */
export function ClinicStatusBadge({ status }: { status: OperationalStatus }) {
  return (
    <Badge variant={VARIANT[status]}>
      <StatusDot />
      {OPERATIONAL_STATUS_LABEL[status]}
    </Badge>
  );
}

/** El trial es de la suscripción, no del estado operativo: badge aparte. */
export function TrialBadge() {
  return (
    <Badge variant="info">
      <CircleDashed aria-hidden />
      Trial
    </Badge>
  );
}
