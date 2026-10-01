import { CircleCheck, CircleDashed, CirclePause, CircleSlash } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { OperationalStatus } from '@/lib/api/schemas';
import { OPERATIONAL_STATUS_LABEL } from '@/lib/format';

const STYLE = {
  ACTIVE: { variant: 'success', icon: CircleCheck },
  TRIAL: { variant: 'secondary', icon: CircleDashed },
  SUSPENDED: { variant: 'destructive', icon: CirclePause },
  INACTIVE: { variant: 'outline', icon: CircleSlash },
} as const;

/** Estado operativo: siempre icono + texto, nunca solo color. */
export function ClinicStatusBadge({ status }: { status: OperationalStatus }) {
  const { variant, icon: Icon } = STYLE[status];
  return (
    <Badge variant={variant}>
      <Icon aria-hidden />
      {OPERATIONAL_STATUS_LABEL[status]}
    </Badge>
  );
}
