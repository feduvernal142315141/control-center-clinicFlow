import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/page-header';
import { PlanForm } from '@/components/plans/plan-form';
import { Card, CardContent } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Nuevo plan' };

export default function NewPlanPage() {
  return (
    <>
      <PageHeader
        title="Nuevo plan"
        description="Se crea solo con los módulos core; después configuras la matriz."
      />
      <Card className="max-w-2xl">
        <CardContent>
          <PlanForm />
        </CardContent>
      </Card>
    </>
  );
}
