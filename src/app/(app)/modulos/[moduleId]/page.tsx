import type { Metadata } from 'next';
import { ModuleEditorPage } from '@/components/modules/module-editor-page';

export const metadata: Metadata = { title: 'Módulo' };

export default async function ModulePage({ params }: { params: Promise<{ moduleId: string }> }) {
  const { moduleId } = await params;
  return <ModuleEditorPage moduleId={moduleId} />;
}
