import { Activity, Blocks, ShieldCheck } from 'lucide-react';
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

const HIGHLIGHTS = [
  { icon: Activity, text: 'Estado de todas las clínicas en un vistazo' },
  { icon: Blocks, text: 'Planes, módulos y overrides con vista previa de impacto' },
  { icon: ShieldCheck, text: 'Cada cambio con motivo y auditoría completa' },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string }>;
}) {
  const { next, reason } = await searchParams;
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section
        aria-hidden
        className="relative hidden overflow-hidden bg-[oklch(0.18_0.03_270)] p-10 text-white lg:flex lg:flex-col"
      >
        {/* Fondo: malla de color sutil + rejilla */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_20%_10%,oklch(0.55_0.2_270/0.45),transparent),radial-gradient(50%_40%_at_90%_80%,oklch(0.6_0.2_300/0.35),transparent)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,oklch(1_0_0/0.04)_1px,transparent_1px),linear-gradient(to_bottom,oklch(1_0_0/0.04)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)] bg-[size:48px_48px]" />
        <div className="relative flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-lg bg-white/10 text-xs font-bold ring-1 ring-white/20 backdrop-blur">
            KW
          </span>
          <span className="text-sm font-semibold tracking-tight">KodeWave Control Center</span>
        </div>
        <div className="relative mt-auto max-w-md space-y-6">
          <h2 className="text-3xl leading-tight font-semibold tracking-tight">
            La consola de operación de ClinicFlow360.
          </h2>
          <ul className="space-y-3 text-sm text-white/75">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <span className="grid size-7 place-items-center rounded-md bg-white/10 ring-1 ring-white/15">
                  <Icon className="size-3.5" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative mt-10 text-xs text-white/50">
          Uso interno de KodeWave. No es accesible para usuarios de clínicas.
        </p>
      </section>
      <section className="flex items-center justify-center p-6 sm:p-10">
        <LoginForm
          mfaEnabled={isMfaEnabled()}
          nextPath={safeNextPath(next)}
          notice={reason ? REASONS[reason] : undefined}
        />
      </section>
    </main>
  );
}
