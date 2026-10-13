import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { LoadingState } from '@/components/states/loading-state';
import { SystemErrorLogView } from '@/components/system-errors/system-error-log-view';

export const metadata: Metadata = { title: 'Errores del sistema' };

export default function SystemErrorsPage() {
  return <><PageHeader title="Errores del sistema" description="Excepciones persistidas con stack trace y contexto para investigar incidentes." /><Suspense fallback={<LoadingState rows={8} />}><SystemErrorLogView /></Suspense></>;
}
