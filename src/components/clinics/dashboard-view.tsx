'use client';

import {
  AlarmClock,
  Building2,
  CircleCheck,
  CircleDashed,
  CirclePause,
  CircleSlash,
  TriangleAlert,
} from 'lucide-react';
import Link from 'next/link';
import { ErrorState } from '@/components/states/error-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useCatalogNames } from '@/lib/api/hooks/use-catalogs';
import { useDashboard } from '@/lib/api/hooks/use-clinics';
import type { TrialItem } from '@/lib/api/schemas';
import { formatDate } from '@/lib/format';

type TileKey = 'totalClinics' | 'active' | 'trial' | 'suspended' | 'inactive';

const TILES: {
  key: TileKey;
  label: string;
  icon: typeof Building2;
  href: string;
  /** Tono del icono y de la barra; el valor siempre va en texto. */
  tone: string;
  bar: string;
}[] = [
  {
    key: 'totalClinics',
    label: 'Total de clínicas',
    icon: Building2,
    href: '/clinicas',
    tone: 'text-primary bg-primary/10',
    bar: 'bg-primary',
  },
  {
    key: 'active',
    label: 'Activas',
    icon: CircleCheck,
    href: '/clinicas?status=ACTIVE',
    tone: 'text-success bg-success/10',
    bar: 'bg-success',
  },
  // Trial = suscripción en trial (no es estado operativo).
  {
    key: 'trial',
    label: 'En trial',
    icon: CircleDashed,
    href: '/clinicas?trial=true',
    tone: 'text-info bg-info/10',
    bar: 'bg-info',
  },
  {
    key: 'suspended',
    label: 'Suspendidas',
    icon: CirclePause,
    href: '/clinicas?status=SUSPENDED',
    tone: 'text-destructive bg-destructive/10',
    bar: 'bg-destructive',
  },
  {
    key: 'inactive',
    label: 'Inactivas',
    icon: CircleSlash,
    href: '/clinicas?status=INACTIVE',
    tone: 'text-muted-foreground bg-muted',
    bar: 'bg-muted-foreground',
  },
];

export function DashboardView() {
  const dashboard = useDashboard();
  const { planName, specialtyName } = useCatalogNames();

  if (dashboard.isError) {
    return <ErrorState error={dashboard.error} onRetry={() => dashboard.refetch()} />;
  }

  const data = dashboard.data;
  const total = Math.max(1, data?.totalClinics ?? 1);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {TILES.map(({ key, label, icon: Icon, href, tone, bar }) => {
          const value = data?.[key];
          const share = key === 'totalClinics' || value === undefined ? null : value / total;
          return (
            <Link key={key} href={href} className="group rounded-xl">
              <Card className="h-full gap-3 py-4 transition-[border-color,box-shadow] group-hover:border-border-strong group-hover:shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between gap-2 px-4">
                  <CardTitle className="text-[13px] font-medium text-muted-foreground">
                    {label}
                  </CardTitle>
                  <span className={`grid size-7 place-items-center rounded-md ${tone}`}>
                    <Icon className="size-3.5" aria-hidden />
                  </span>
                </CardHeader>
                <CardContent className="space-y-2 px-4">
                  {data ? (
                    <p
                      className="text-[28px] leading-none font-semibold tracking-tight tabular-nums"
                      data-testid={`kpi-${key}`}
                    >
                      {value}
                    </p>
                  ) : (
                    <Skeleton className="h-7 w-14" />
                  )}
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {share === null
                      ? 'Todas las clínicas'
                      : `${Math.round(share * 100)}% del total`}
                  </p>
                  <div className="h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                    <div
                      className={`h-full rounded-full ${bar}`}
                      style={{ width: `${share === null ? 100 : share * 100}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
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

      <Card>
        <CardHeader>
          <CardTitle>Trials</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-2">
          <TrialList
            title="Vencidos"
            description="Suscripción en pago vencido. La clínica sigue activa: suspender es manual."
            icon={<TriangleAlert className="size-4 text-destructive" aria-hidden />}
            items={data?.trials.expired}
            dateLabel="Venció"
            planName={planName}
            empty="No hay trials vencidos."
          />
          <TrialList
            title="Vencen en los próximos 7 días"
            icon={<AlarmClock className="size-4 text-warning" aria-hidden />}
            items={data?.trials.expiringSoon}
            dateLabel="Vence"
            planName={planName}
            empty="Ningún trial vence esta semana."
          />
        </CardContent>
      </Card>
    </div>
  );
}

function TrialList({
  title,
  description,
  icon,
  items,
  dateLabel,
  planName,
  empty,
}: {
  title: string;
  description?: string;
  icon: React.ReactNode;
  items: TrialItem[] | undefined;
  dateLabel: string;
  planName: (code: string | null) => string;
  empty: string;
}) {
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {title}
        {items && <span className="text-muted-foreground">({items.length})</span>}
      </h3>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      {!items ? (
        <Skeleton className="h-16 w-full" />
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y rounded-md border" aria-label={title}>
          {items.map((t) => (
            <li key={t.clinicId}>
              <Link
                href={`/clinicas/${t.clinicId}`}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-muted/40"
              >
                <span>
                  <span className="font-medium">{t.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {planName(t.planCode)}
                  </span>
                </span>
                <span className="text-xs whitespace-nowrap text-muted-foreground">
                  {dateLabel} {formatDate(t.endsAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
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
                  <div className="mt-1.5 h-1.5 rounded-full bg-muted" aria-hidden>
                    <div
                      className="h-1.5 rounded-full bg-primary"
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
