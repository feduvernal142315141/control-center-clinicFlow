import { ChevronsUpDown } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';
import { fieldClasses } from './input';

/** Select nativo con estilo del sistema: accesible, sin portal y fácil de probar. */
function NativeSelect({ className, children, ...props }: React.ComponentProps<'select'>) {
  return (
    <div className="relative">
      <select
        data-slot="native-select"
        className={cn(fieldClasses, 'h-9 cursor-pointer appearance-none py-1 pr-8 pl-3', className)}
        {...props}
      >
        {children}
      </select>
      <ChevronsUpDown className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-subtle-foreground" />
    </div>
  );
}

export { NativeSelect };
