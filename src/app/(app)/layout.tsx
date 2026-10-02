import { cookies } from 'next/headers';
import { AppShell } from '@/components/layout/app-shell';
import { isApiMocksEnabled } from '@/config/features';
import { SIDEBAR_COOKIE } from '@/lib/theme';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const collapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === 'collapsed';
  return (
    <AppShell defaultCollapsed={collapsed} mocks={isApiMocksEnabled()}>
      {children}
    </AppShell>
  );
}
