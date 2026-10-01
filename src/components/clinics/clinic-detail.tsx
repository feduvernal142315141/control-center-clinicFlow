'use client';

import { ArrowLeft, Pause, Play, Stethoscope, Tags } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { ComingSoon } from '@/components/states/coming-soon';
import { EmptyState } from '@/components/states/empty-state';
import { ErrorState } from '@/components/states/error-state';
import { LoadingState } from '@/components/states/loading-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCatalogNames } from '@/lib/api/hooks/use-catalogs';
import { useClinic } from '@/lib/api/hooks/use-clinics';
import { isApiError } from '@/lib/api/errors';
import type { ClinicDetail as Clinic } from '@/lib/api/schemas';
import { formatDate, formatDateTime, SUBSCRIPTION_STATUS_LABEL } from '@/lib/format';
import {
  ChangePlanDialog,
  ChangeSpecialtyDialog,
  ReactivateClinicDialog,
  SuspendClinicDialog,
  type ClinicAction,
} from './clinic-action-dialogs';
import { ClinicStatusBadge } from './clinic-status-badge';
import { EffectiveModulesTable } from './effective-modules-table';

const TABS = ['resumen', 'modulos', 'overrides', 'auditoria'] as const;
type Tab = (typeof TABS)[number];

export function ClinicDetail({ clinicId }: { clinicId: string }) {
  const clinic = useClinic(clinicId);
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [action, setAction] = useState<ClinicAction | null>(null);

  const tabParam = params.get('tab');
  const tab: Tab = TABS.includes(tabParam as Tab) ? (tabParam as Tab) : 'resumen';
  const setTab = (next: string) =>
    router.replace(next === 'resumen' ? pathname : `${pathname}?tab=${next}`, { scroll: false });

  if (clinic.isError) {
    if (isApiError(clinic.error) && clinic.error.status === 404) {
      return (
        <EmptyState
          title="Clínica no encontrada"
          description="Puede que el enlace sea incorrecto."
          action={
            <Button asChild variant="outline">
              <Link href="/clinicas">Volver a clínicas</Link>
            </Button>
          }
        />
      );
    }
    return <ErrorState error={clinic.error} onRetry={() => clinic.refetch()} />;
  }
  if (!clinic.data) return <LoadingState rows={6} label="Cargando clínica…" />;

  const c = clinic.data;
  const dialogProps = (a: ClinicAction) => ({
    clinic: c,
    open: action === a,
    onOpenChange: (open: boolean) => setAction(open ? a : null),
  });

  return (
    <>
      <Button asChild variant="link" className="mb-2 h-auto px-0 text-muted-foreground">
        <Link href="/clinicas">
          <ArrowLeft /> Clínicas
        </Link>
      </Button>
      <PageHeader
        title={c.name}
        description={c.slug}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setAction('plan')}>
              <Tags /> Cambiar plan
            </Button>
            <Button variant="outline" onClick={() => setAction('specialty')}>
              <Stethoscope /> Cambiar especialidad
            </Button>
            {c.operationalStatus === 'SUSPENDED' ? (
              <Button onClick={() => setAction('reactivate')}>
                <Play /> Reactivar
              </Button>
            ) : c.operationalStatus !== 'INACTIVE' ? (
              <Button variant="destructive" onClick={() => setAction('suspend')}>
                <Pause /> Suspender
              </Button>
            ) : null}
          </div>
        }
      />
      <div className="-mt-4 mb-6">
        <ClinicStatusBadge status={c.operationalStatus} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="modulos">Módulos efectivos</TabsTrigger>
          <TabsTrigger value="overrides">Overrides</TabsTrigger>
          <TabsTrigger value="auditoria">Auditoría</TabsTrigger>
        </TabsList>
        <TabsContent value="resumen">
          <ClinicSummary clinic={c} />
        </TabsContent>
        <TabsContent value="modulos">
          <EffectiveModulesTable clinicId={c.id} />
        </TabsContent>
        <TabsContent value="overrides">
          <ComingSoon phase="BO4" />
        </TabsContent>
        <TabsContent value="auditoria">
          <ComingSoon phase="BO4" />
        </TabsContent>
      </Tabs>

      <ChangePlanDialog {...dialogProps('plan')} />
      <ChangeSpecialtyDialog {...dialogProps('specialty')} />
      <SuspendClinicDialog {...dialogProps('suspend')} />
      <ReactivateClinicDialog {...dialogProps('reactivate')} />
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

function ClinicSummary({ clinic }: { clinic: Clinic }) {
  const { planName, specialtyName } = useCatalogNames();
  const s = clinic.subscription;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Datos</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre">{clinic.name}</Field>
            <Field label="Slug">
              <code className="font-mono">{clinic.slug}</code>
            </Field>
            <Field label="Especialidad">{specialtyName(clinic.specialtyCode)}</Field>
            <Field label="Estado">
              <ClinicStatusBadge status={clinic.operationalStatus} />
            </Field>
            <Field label="Creada">{formatDateTime(clinic.createdAt)}</Field>
            <Field label="ID">
              <code className="font-mono text-xs">{clinic.id}</code>
            </Field>
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Suscripción</CardTitle>
        </CardHeader>
        <CardContent>
          {s ? (
            <dl className="grid gap-4 sm:grid-cols-2">
              <Field label="Plan">{planName(s.planCode)}</Field>
              <Field label="Estado">
                <span className="flex items-center gap-2">
                  {SUBSCRIPTION_STATUS_LABEL[s.status]}
                  {s.trial && <Badge variant="secondary">Trial</Badge>}
                </span>
              </Field>
              <Field label="Inicio">{formatDate(s.startsAt)}</Field>
              <Field label="Fin">{s.endsAt ? formatDate(s.endsAt) : 'Sin fecha de fin'}</Field>
              <Field label="Renovación">{formatDate(s.renewalDate)}</Field>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">
              La clínica no tiene suscripción activa. Usa “Cambiar plan” para asignar una.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
