'use client';

import { Menu, Search, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { SIDEBAR_COOKIE, writePreferenceCookie } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { AppSidebar } from './app-sidebar';
import { BreadcrumbProvider, Breadcrumbs } from './breadcrumbs';
import { CommandPalette, useCommandPaletteShortcut } from './command-palette';
import { ThemeToggle } from './theme-toggle';

export function AppShell({
  children,
  defaultCollapsed = false,
  mocks = false,
}: {
  children: React.ReactNode;
  defaultCollapsed?: boolean;
  mocks?: boolean;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const togglePalette = useCallback(() => setPaletteOpen((o) => !o), []);
  useCommandPaletteShortcut(togglePalette);

  useEffect(() => setMobileOpen(false), [pathname]);

  const toggleCollapsed = () =>
    setCollapsed((c) => {
      writePreferenceCookie(SIDEBAR_COOKIE, c ? null : 'collapsed');
      return !c;
    });

  return (
    <BreadcrumbProvider>
      <div className="flex min-h-dvh">
        <aside
          className={cn(
            'sticky top-0 hidden h-dvh shrink-0 border-r bg-sidebar transition-[width] duration-200 md:block',
            collapsed ? 'w-16' : 'w-60',
          )}
        >
          <AppSidebar
            collapsed={collapsed}
            mocks={mocks}
            onToggleCollapsed={toggleCollapsed}
            onOpenSearch={() => setPaletteOpen(true)}
          />
        </aside>

        {/* Sidebar móvil: se monta solo abierto (no duplica nav ni menú de usuario) */}
        {mobileOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] md:hidden"
              onClick={() => setMobileOpen(false)}
              aria-hidden
            />
            <aside className="fixed inset-y-0 left-0 z-50 w-64 animate-in border-r bg-sidebar shadow-lg slide-in-from-left md:hidden">
              <AppSidebar mocks={mocks} onOpenSearch={() => setPaletteOpen(true)} />
            </aside>
          </>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-13 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-md md:px-6">
            <Button
              variant="ghost"
              size="icon"
              className="-ml-2 md:hidden"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
            >
              {mobileOpen ? <X /> : <Menu />}
            </Button>
            <Breadcrumbs />
            <div className="ml-auto flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="hidden text-subtle-foreground sm:inline-flex"
                onClick={() => setPaletteOpen(true)}
                aria-label="Buscar (⌘K)"
              >
                <Search /> Buscar <Kbd className="ml-1">⌘K</Kbd>
              </Button>
              <ThemeToggle />
            </div>
          </header>
          <main className="mx-auto w-full max-w-[1400px] flex-1 animate-enter px-4 py-6 md:px-8 md:py-8">
            {children}
          </main>
        </div>
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </BreadcrumbProvider>
  );
}
