import * as React from 'react';
import { cn } from '@/lib/utils';

export const fieldClasses =
  'w-full min-w-0 rounded-md border border-input bg-surface text-sm shadow-xs transition-[border-color,box-shadow] outline-none placeholder:text-subtle-foreground hover:border-border-strong disabled:cursor-not-allowed disabled:opacity-50 read-only:bg-surface-sunken read-only:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 focus-visible:outline-none aria-invalid:border-destructive aria-invalid:ring-destructive/15';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(fieldClasses, 'h-9 px-3 py-1', className)}
      {...props}
    />
  );
}

export { Input };
