import type { Metadata } from 'next';
import { ModuleEditorPage } from '@/components/modules/module-editor-page';

export const metadata: Metadata = { title: 'Nuevo módulo' };

export default function NewModulePage() {
  return <ModuleEditorPage />;
}
