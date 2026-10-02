'use client';

import Link from 'next/link';
import { useBreadcrumbLabel } from '@/components/layout/breadcrumbs';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/states/empty-state';
import { ErrorState } from '@/components/states/error-state';
import { LoadingState } from '@/components/states/loading-state';
import { Badge, StatusDot } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useModules, usePlan } from '@/lib/api/hooks/use-catalog-admin';
import { isApiError } from '@/lib/api/errors';
import { PlanForm } from './plan-form';
import { PlanMatrix } from './plan-matrix';

export function PlanDetail({ planId }: { planId: string }) {
  const plan = usePlan(planId);
  useBreadcrumbLabel(planId, plan.data?.name);
  const modules = useModules();

  const error = plan.error ?? modules.error;
  if (error) {
    if (isApiError(error) && error.status === 404) {
      return (
        <EmptyState
          title="Plan no encontrado"
          action={
            <Button asChild variant="outline">
              <Link href="/planes">Volver a planes</Link>
            </Button>
          }
        />
      );
    }
    return (
      <ErrorState
        error={error}
        onRetry={() => {
          void plan.refetch();
          void modules.refetch();
        }}
      />
    );
  }
  if (!plan.data || !modules.data) return <LoadingState rows={8} label="Cargando plan…" />;

  const p = plan.data;
  // Recarga tras VERSION_CONFLICT y devuelve la versión vigente (D16).
  const reload = async () => {
    const [fresh] = await Promise.all([plan.refetch(), modules.refetch()]);
    return fresh.data?.version;
  };
  return (
    <>
      <PageHeader
        title={p.name}
        meta={
          <>
            {p.active ? (
              <Badge variant="success">
                <StatusDot /> Activo
              </Badge>
            ) : (
              <Badge variant="outline">
                <StatusDot /> Inactivo
              </Badge>
            )}
            <code className="font-mono text-xs text-muted-foreground">{p.code}</code>
          </>
        }
      />
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Datos del plan</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Sin `key` por versión: remontar borraría lo que el usuario está editando. */}
            <PlanForm plan={p} reload={reload} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Módulos del plan</CardTitle>
            <CardDescription>
              Los módulos core obligatorios están siempre incluidos. Cada módulo solo admite los
              límites que define el catálogo: un número o “ilimitado”.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PlanMatrix plan={p} catalog={modules.data} reload={reload} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
