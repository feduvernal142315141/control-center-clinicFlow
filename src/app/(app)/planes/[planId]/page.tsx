import type { Metadata } from 'next';
import { PlanDetail } from '@/components/plans/plan-detail';

export const metadata: Metadata = { title: 'Plan' };

export default async function PlanPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  return <PlanDetail planId={planId} />;
}
