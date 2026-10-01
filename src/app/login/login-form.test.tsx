import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '@/lib/react-query';
import { LoginForm } from './login-form';

const router = { replace: vi.fn(), refresh: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const LOGIN = 'http://localhost:3000/api/auth/login';
const MFA = 'http://localhost:3000/api/auth/mfa';
const LOGOUT = 'http://localhost:3000/api/auth/logout';
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
beforeEach(() => {
  router.replace.mockReset();
  router.refresh.mockReset();
});

function renderForm(props: Partial<React.ComponentProps<typeof LoginForm>> = {}) {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <LoginForm mfaEnabled={false} nextPath="/clinicas" {...props} />
    </QueryClientProvider>,
  );
}

async function fillCredentials(email = 'admin@kodewave.com', password = 'secreto') {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Correo'), email);
  await user.type(screen.getByLabelText('Contraseña'), password);
  await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
  return user;
}

describe('LoginForm', () => {
  it('valida en el cliente sin llamar al BFF', async () => {
    renderForm();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect(await screen.findByText('Correo inválido')).toBeInTheDocument();
    expect(screen.getByText('La contraseña es obligatoria')).toBeInTheDocument();
  });

  it('login correcto redirige a la ruta pedida', async () => {
    server.use(http.post(LOGIN, () => HttpResponse.json({ status: 'AUTHENTICATED' })));
    renderForm();
    await fillCredentials();
    await vi.waitFor(() => expect(router.replace).toHaveBeenCalledWith('/clinicas'));
  });

  it('muestra el error del backend (credenciales, bloqueo, rate limit)', async () => {
    server.use(
      http.post(LOGIN, () =>
        HttpResponse.json(
          { code: 'ACCOUNT_LOCKED', message: 'La cuenta está bloqueada.' },
          { status: 423 },
        ),
      ),
    );
    renderForm();
    await fillCredentials();
    expect(await screen.findByRole('alert')).toHaveTextContent('La cuenta está bloqueada.');
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('credenciales inválidas (401) muestran error sin disparar el logout global', async () => {
    const logout = vi.fn();
    server.use(
      http.post(LOGIN, () =>
        HttpResponse.json(
          { code: 'INVALID_CREDENTIALS', message: 'Correo o contraseña incorrectos.' },
          { status: 401 },
        ),
      ),
      http.post(LOGOUT, () => {
        logout();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderForm();
    await fillCredentials();
    expect(await screen.findByRole('alert')).toHaveTextContent('Correo o contraseña incorrectos.');
    expect(logout).not.toHaveBeenCalled();
  });

  it('con flag 2FA: pide el código y luego entra', async () => {
    server.use(
      http.post(LOGIN, () => HttpResponse.json({ status: 'MFA_REQUIRED' })),
      http.post(MFA, async ({ request }) => {
        const { code } = (await request.json()) as { code: string };
        return code === '123456'
          ? HttpResponse.json({ status: 'AUTHENTICATED' })
          : HttpResponse.json(
              { code: 'INVALID_MFA_CODE', message: 'Código incorrecto.' },
              { status: 401 },
            );
      }),
    );
    renderForm({ mfaEnabled: true });
    const user = await fillCredentials();

    const code = await screen.findByLabelText('Código de verificación');
    await user.type(code, '000000');
    await user.click(screen.getByRole('button', { name: 'Verificar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Código incorrecto.');

    await user.clear(code);
    await user.type(code, '123456');
    await user.click(screen.getByRole('button', { name: 'Verificar' }));
    await vi.waitFor(() => expect(router.replace).toHaveBeenCalledWith('/clinicas'));
  });

  it('muestra el aviso de sesión expirada', () => {
    renderForm({ notice: 'Tu sesión expiró. Vuelve a iniciar sesión.' });
    expect(screen.getByText('Tu sesión expiró. Vuelve a iniciar sesión.')).toBeInTheDocument();
  });
});
