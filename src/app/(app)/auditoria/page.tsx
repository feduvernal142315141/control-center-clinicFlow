import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuditLogView } from '@/components/audit/audit-log-view';
import { PageHeader } from '@/components/layout/page-header';
import { LoadingState } from '@/components/states/loading-state';

export const metadata: Metadata = { title: 'Auditoría' };

export default function AuditPage() {
  return (
    <>
      <PageHeader
        title="Auditoría"
        description="Todo cambio hecho desde el Control Center, con motivo y antes/después."
      />
      <Suspense fallback={<LoadingState rows={8} />}>
        <AuditLogView />
      </Suspense>
    </>
  );
}
