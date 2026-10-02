'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useState } from 'react';
import { SEGMENT_LABELS } from './nav-items';

type Labels = Record<string, string>;
const BreadcrumbContext = createContext<{
  labels: Labels;
  setLabel: (segment: string, label: string | null) => void;
} | null>(null);

export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const [labels, setLabels] = useState<Labels>({});
  const setLabel = (segment: string, label: string | null) =>
    setLabels((prev) => {
      if (label === null) {
        const { [segment]: _removed, ...rest } = prev;
        return rest;
      }
      return prev[segment] === label ? prev : { ...prev, [segment]: label };
    });
  return (
    <BreadcrumbContext.Provider value={{ labels, setLabel }}>{children}</BreadcrumbContext.Provider>
  );
}

/** Las páginas de detalle nombran su segmento dinámico (p. ej. el id → nombre de la clínica). */
export function useBreadcrumbLabel(segment: string, label: string | undefined) {
  const ctx = useContext(BreadcrumbContext);
  useEffect(() => {
    if (!ctx || !label) return;
    ctx.setLabel(segment, label);
    return () => ctx.setLabel(segment, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ctx.setLabel es estable en efecto
  }, [segment, label]);
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const labels = useContext(BreadcrumbContext)?.labels ?? {};
  const segments = pathname.split('/').filter(Boolean);
  const crumbs = [
    { href: '/', label: 'Dashboard' },
    ...segments.map((segment, i) => ({
      href: `/${segments.slice(0, i + 1).join('/')}`,
      label: labels[segment] ?? SEGMENT_LABELS[segment] ?? '…',
    })),
  ];

  return (
    <nav aria-label="Ruta" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1 text-sm">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={c.href} className="flex min-w-0 items-center gap-1">
              {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-subtle-foreground" />}
              {last ? (
                <span aria-current="page" className="truncate font-medium text-foreground">
                  {c.label}
                </span>
              ) : (
                <Link
                  href={c.href}
                  className="truncate rounded-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {c.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
