import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Badges suaves: fondo tintado + texto del tono. Los estados siempre llevan icono o punto,
 * nunca solo color.
 */
const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center gap-1 overflow-hidden rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3',
  {
    variants: {
      variant: {
        default: 'border-primary/20 bg-primary/10 text-primary',
        secondary: 'border-border bg-secondary text-secondary-foreground',
        destructive: 'border-destructive/25 bg-destructive/10 text-destructive',
        success: 'border-success/25 bg-success/10 text-success',
        warning: 'border-warning/30 bg-warning/12 text-warning',
        info: 'border-info/25 bg-info/10 text-info',
        outline: 'border-border-strong/70 text-muted-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

/** Punto de estado para acompañar el texto de un badge. */
function StatusDot({ className }: { className?: string }) {
  return <span aria-hidden className={cn('size-1.5 rounded-full bg-current', className)} />;
}

export { Badge, badgeVariants, StatusDot };
