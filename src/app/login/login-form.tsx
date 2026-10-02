'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, Info, Loader2, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { authApi } from '@/lib/api/endpoints/auth';
import { API_ERROR_CODES, errorMessage, fieldErrorsOf, isApiError } from '@/lib/api/errors';
import {
  loginInputSchema,
  mfaInputSchema,
  type BffAuthResult,
  type LoginInput,
  type MfaInput,
} from '@/lib/api/schemas';
import { applyFieldErrors } from '@/lib/forms';
import { hardNavigate } from '@/lib/navigation';

function FormError({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <Alert variant="destructive">
      <AlertTriangle />
      <AlertDescription>{errorMessage(error)}</AlertDescription>
    </Alert>
  );
}

export function LoginForm({
  mfaEnabled,
  nextPath,
  notice,
}: {
  mfaEnabled: boolean;
  nextPath: string;
  notice?: string;
}) {
  const [step, setStep] = useState<'credentials' | 'mfa'>('credentials');

  // Navegación completa: el router de Next podría reutilizar una respuesta en caché de
  // cuando la ruta redirigía a /login (sin sesión).
  const onAuthenticated = () => hardNavigate(nextPath);

  const handleResult = (result: BffAuthResult) => {
    if (result.status === 'AUTHENTICATED') return onAuthenticated();
    if (mfaEnabled) setStep('mfa');
  };

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="space-y-2">
        <div className="grid size-10 place-items-center rounded-lg bg-gradient-to-br from-primary to-[oklch(0.6_0.2_300)] text-sm font-bold text-white shadow-sm lg:hidden">
          KW
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {step === 'credentials' ? 'Inicia sesión' : 'Verificación en dos pasos'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {step === 'credentials'
            ? 'Acceso exclusivo para el equipo KodeWave.'
            : 'Ingresa el código de tu app de autenticación.'}
        </p>
      </div>
      {notice && step === 'credentials' && (
        <Alert>
          <Info />
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}
      {step === 'credentials' ? (
        <CredentialsStep onResult={handleResult} />
      ) : (
        <MfaStep onAuthenticated={onAuthenticated} onRestart={() => setStep('credentials')} />
      )}
    </div>
  );
}

function CredentialsStep({ onResult }: { onResult: (r: BffAuthResult) => void }) {
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginInputSchema),
    defaultValues: { email: '', password: '' },
  });
  const login = useMutation({
    mutationFn: authApi.login,
    meta: { errorToast: false },
    onSuccess: onResult,
    onError: (error) => applyFieldErrors(error, form.setError),
  });
  const { errors } = form.formState;
  const showGlobalError = login.isError && fieldErrorsOf(login.error).length === 0;

  return (
    <form noValidate onSubmit={form.handleSubmit((v) => login.mutate(v))} className="space-y-4">
      {showGlobalError && <FormError error={login.error} />}
      <div className="space-y-2">
        <Label htmlFor="email">Correo</Label>
        <Input
          id="email"
          type="email"
          autoComplete="username"
          autoFocus
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
          {...form.register('email')}
        />
        {errors.email && (
          <p id="email-error" className="text-sm text-destructive">
            {errors.email.message}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Contraseña</Label>
        <PasswordInput
          id="password"
          autoComplete="current-password"
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? 'password-error' : undefined}
          {...form.register('password')}
        />
        {errors.password && (
          <p id="password-error" className="text-sm text-destructive">
            {errors.password.message}
          </p>
        )}
      </div>
      <Button type="submit" className="w-full" disabled={login.isPending}>
        {login.isPending && <Loader2 className="animate-spin" />}
        Iniciar sesión
      </Button>
    </form>
  );
}

function MfaStep({
  onAuthenticated,
  onRestart,
}: {
  onAuthenticated: () => void;
  onRestart: () => void;
}) {
  const form = useForm<MfaInput>({
    resolver: zodResolver(mfaInputSchema),
    defaultValues: { code: '' },
  });
  const verify = useMutation({
    mutationFn: authApi.verifyMfa,
    meta: { errorToast: false },
    onSuccess: onAuthenticated,
    onError: (error) => {
      if (isApiError(error) && error.code === API_ERROR_CODES.MFA_SESSION_EXPIRED) return;
      if (!applyFieldErrors(error, form.setError)) form.setFocus('code');
    },
  });
  const expired =
    isApiError(verify.error) && verify.error.code === API_ERROR_CODES.MFA_SESSION_EXPIRED;
  const { errors } = form.formState;

  return (
    <form noValidate onSubmit={form.handleSubmit((v) => verify.mutate(v))} className="space-y-4">
      {verify.isError && fieldErrorsOf(verify.error).length === 0 && (
        <FormError error={verify.error} />
      )}
      <div className="space-y-2">
        <Label htmlFor="code">
          <ShieldCheck className="size-4" /> Código de verificación
        </Label>
        <Input
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          autoFocus
          className="text-center font-mono text-lg tracking-[0.5em]"
          aria-invalid={!!errors.code}
          aria-describedby={errors.code ? 'code-error' : undefined}
          {...form.register('code')}
        />
        {errors.code && (
          <p id="code-error" className="text-sm text-destructive">
            {errors.code.message}
          </p>
        )}
      </div>
      {expired ? (
        <Button type="button" className="w-full" onClick={onRestart}>
          Volver a iniciar sesión
        </Button>
      ) : (
        <Button type="submit" className="w-full" disabled={verify.isPending}>
          {verify.isPending && <Loader2 className="animate-spin" />}
          Verificar
        </Button>
      )}
      <Button type="button" variant="link" className="w-full" onClick={onRestart}>
        Usar otra cuenta
      </Button>
    </form>
  );
}
