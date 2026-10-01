'use client';

import { Building2, CircleCheck, CircleDashed, CirclePause, CircleSlash } from 'lucide-react';
import Link from 'next/link';
import { ErrorState } from '@/components/states/error-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useCatalogNames } from '@/lib/api/hooks/use-catalogs';
import { useDashboard } from '@/lib/api/hooks/use-clinics';

const TILES: {
  key: 'totalClinics' | 'active' | 'trial' | 'suspended' | 'inactive';
  label: string;
  icon: typeof Building2;
  href: string;
}[] = [
  { key: 'totalClinics', label: 'Total de clínicas', icon: Building2, href: '/clinicas' },
  { key: 'active', label: 'Activas', icon: CircleCheck, href: '/clinicas?status=ACTIVE' },
  // Trial = suscripción en trial (no es estado operativo).
  { key: 'trial', label: 'En trial', icon: CircleDashed, href: '/clinicas?trial=true' },
  { key: 'suspended', label: 'Suspendidas', icon: CirclePause, href: '/clinicas?status=SUSPENDED' },
  { key: 'inactive', label: 'Inactivas', icon: CircleSlash, href: '/clinicas?status=INACTIVE' },
];

export function DashboardView() {
  const dashboard = useDashboard();
  const { planName, specialtyName } = useCatalogNames();

  if (dashboard.isError) {
    return <ErrorState error={dashboard.error} onRetry={() => dashboard.refetch()} />;
  }

  const data = dashboard.data;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {TILES.map(({ key, label, icon: Icon, href }) => (
          <Link
            key={key}
            href={href}
            className="rounded-xl focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <Card className="gap-2 py-4 transition-colors hover:bg-muted/40">
              <CardHeader className="flex flex-row items-center justify-between gap-2 px-4">
                <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                <Icon className="size-4 text-muted-foreground" aria-hidden />
              </CardHeader>
              <CardContent className="px-4">
                {data ? (
                  <p className="text-3xl font-semibold tabular-nums" data-testid={`kpi-${key}`}>
                    {data[key]}
                  </p>
                ) : (
                  <Skeleton className="h-9 w-16" />
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Breakdown
          title="Clínicas por plan"
          loading={!data}
          rows={(data?.byPlan ?? []).map((r) => ({
            key: r.planCode ?? 'none',
            label: planName(r.planCode),
            count: r.count,
            href: r.planCode ? `/clinicas?planCode=${r.planCode}` : undefined,
          }))}
        />
        <Breakdown
          title="Clínicas por especialidad"
          loading={!data}
          rows={(data?.bySpecialty ?? []).map((r) => ({
            key: r.specialtyCode,
            label: specialtyName(r.specialtyCode),
            count: r.count,
            href: `/clinicas?specialtyCode=${r.specialtyCode}`,
          }))}
        />
      </div>
    </div>
  );
}

/** Barras horizontales de un solo tono, ordenadas, con el valor siempre en texto. */
function Breakdown({
  title,
  rows,
  loading,
}: {
  title: string;
  loading: boolean;
  rows: { key: string; label: string; count: number; href?: string }[];
}) {
  const sorted = [...rows].sort((a, b) => b.count - a.count);
  const max = Math.max(1, ...sorted.map((r) => r.count));
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin datos.</p>
        ) : (
          <ul className="space-y-3" aria-label={title}>
            {sorted.map((r) => {
              const content = (
                <>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span>{r.label}</span>
                    <span className="font-medium tabular-nums">{r.count}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-muted" aria-hidden>
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${(r.count / max) * 100}%` }}
                    />
                  </div>
                </>
              );
              return (
                <li key={r.key} title={`${r.label}: ${r.count}`}>
                  {r.href ? (
                    <Link href={r.href} className="block rounded-sm hover:opacity-80">
                      {content}
                    </Link>
                  ) : (
                    content
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
