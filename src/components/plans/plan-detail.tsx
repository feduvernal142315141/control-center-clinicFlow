'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/states/empty-state';
import { ErrorState } from '@/components/states/error-state';
import { LoadingState } from '@/components/states/loading-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useModules, usePlan } from '@/lib/api/hooks/use-catalog-admin';
import { isApiError } from '@/lib/api/errors';
import { PlanForm } from './plan-form';
import { PlanMatrix } from './plan-matrix';

export function PlanDetail({ planId }: { planId: string }) {
  const plan = usePlan(planId);
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
  return (
    <>
      <Button asChild variant="link" className="mb-2 h-auto px-0 text-muted-foreground">
        <Link href="/planes">
          <ArrowLeft /> Planes
        </Link>
      </Button>
      <PageHeader title={p.name} description={p.code} />
      <div className="-mt-4 mb-6">
        {p.active ? (
          <Badge variant="success">Activo</Badge>
        ) : (
          <Badge variant="outline">Inactivo</Badge>
        )}
      </div>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Datos del plan</CardTitle>
          </CardHeader>
          <CardContent>
            <PlanForm key={plan.dataUpdatedAt} plan={p} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Módulos del plan</CardTitle>
            <CardDescription>
              Los módulos core obligatorios están siempre incluidos. Los límites son opcionales: un
              número o “ilimitado”.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PlanMatrix
              key={`${plan.dataUpdatedAt}-${modules.dataUpdatedAt}`}
              plan={p}
              catalog={modules.data}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
