import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';
import { Toaster } from '@/components/ui/sonner';
import { createQueryClient } from '@/lib/react-query';
import { resetDb } from '@/mocks/db';
import { createPlatformHandlers } from '@/mocks/handlers';

/**
 * Backend falso para tests de componentes: los handlers reales de `src/mocks`
 * montados sobre `/api` (la URL del BFF), sin exigir token.
 */
export function setupMockApi() {
  const server = setupServer(
    ...createPlatformHandlers('http://localhost:3000/api', { skipAuth: true }),
  );
  beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
  beforeEach(() => resetDb());
  afterEach(() => {
    server.resetHandlers();
    server.events.removeAllListeners();
  });
  afterAll(() => server.close());
  return server;
}

export function renderWithClient(ui: React.ReactElement) {
  const queryClient = createQueryClient();
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        {ui}
        <Toaster />
      </QueryClientProvider>,
    ),
  };
}
