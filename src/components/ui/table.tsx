import * as React from 'react';
import { cn } from '@/lib/utils';

/** Tabla densa: encabezado pegajoso, filas de 44 px y hover sutil. */
function Table({ className, ...props }: React.ComponentProps<'table'>) {
  return (
    <div className="relative w-full overflow-x-auto rounded-xl border bg-card shadow-xs">
      <table className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return (
    <thead
      className={cn(
        'sticky top-0 z-10 bg-surface-sunken/80 backdrop-blur [&_tr]:border-b',
        className,
      )}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />;
}

function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return (
    <tr className={cn('border-b transition-colors hover:bg-accent/50', className)} {...props} />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      className={cn(
        'h-9 px-3 text-left align-middle text-[11px] font-medium tracking-wide whitespace-nowrap text-muted-foreground uppercase first:pl-4 last:pr-4',
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return (
    <td className={cn('h-11 px-3 py-2 align-middle first:pl-4 last:pr-4', className)} {...props} />
  );
}

export { Table, TableBody, TableCell, TableHead, TableHeader, TableRow };
