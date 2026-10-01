import type { Metadata } from 'next';
import { isMfaEnabled } from '@/config/features';
import { safeNextPath } from '@/lib/safe-redirect';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Iniciar sesión' };

const REASONS: Record<string, string> = {
  expired: 'Tu sesión expiró. Vuelve a iniciar sesión.',
  forbidden:
    'Tu sesión no es válida para el Control Center. Inicia sesión con una cuenta KodeWave.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string }>;
}) {
  const { next, reason } = await searchParams;
  return (
    <main className="grid min-h-dvh place-items-center bg-muted/40 p-4">
      <LoginForm
        mfaEnabled={isMfaEnabled()}
        nextPath={safeNextPath(next)}
        notice={reason ? REASONS[reason] : undefined}
      />
    </main>
  );
}
