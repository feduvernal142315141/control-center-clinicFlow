'use client';

import { PanelLeftClose, PanelLeftOpen, Search } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Kbd } from '@/components/ui/kbd';
import { cn } from '@/lib/utils';
import { isActive, NAV_GROUPS } from './nav-items';
import { UserMenu } from './user-menu';

export function Brand({ collapsed, mocks }: { collapsed?: boolean; mocks?: boolean }) {
  return (
    <div className={cn('flex h-14 items-center gap-2.5 px-3', collapsed && 'justify-center px-0')}>
      <span className="relative grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-[oklch(0.6_0.2_300)] text-[11px] font-bold tracking-tight text-white shadow-sm">
        KW
      </span>
      {!collapsed && (
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-semibold tracking-tight text-foreground">
            Control Center
          </p>
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            ClinicFlow360
            {mocks && (
              <span
                className="rounded border border-warning/40 bg-warning/12 px-1 text-[10px] font-semibold tracking-wide text-warning uppercase"
                title="Datos de prueba: el BFF responde con mocks"
              >
                Mocks
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

export function AppSidebar({
  collapsed = false,
  mocks = false,
  onNavigate,
  onToggleCollapsed,
  onOpenSearch,
}: {
  collapsed?: boolean;
  mocks?: boolean;
  onNavigate?: () => void;
  onToggleCollapsed?: () => void;
  onOpenSearch: () => void;
}) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col">
      <Brand collapsed={collapsed} mocks={mocks} />

      <div className={cn('px-3 pb-2', collapsed && 'px-2')}>
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label="Buscar o ir a… (⌘K)"
          className={cn(
            'flex h-8 w-full cursor-pointer items-center gap-2 rounded-md border bg-surface px-2.5 text-sm text-subtle-foreground shadow-xs transition-colors hover:border-border-strong hover:text-muted-foreground',
            collapsed && 'justify-center px-0',
          )}
        >
          <Search className="size-3.5 shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Buscar…</span>
              <Kbd>⌘K</Kbd>
            </>
          )}
        </button>
      </div>

      <nav aria-label="Navegación principal" className="flex-1 space-y-4 overflow-y-auto px-3 py-2">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="space-y-0.5">
            {!collapsed && (
              <p className="px-2 pb-1 text-[11px] font-medium tracking-wide text-subtle-foreground uppercase">
                {group.label}
              </p>
            )}
            {group.items.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  aria-label={collapsed ? label : undefined}
                  title={collapsed ? label : undefined}
                  className={cn(
                    'group flex h-8 items-center gap-2.5 rounded-md px-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground',
                    collapsed && 'justify-center px-0',
                    active && 'bg-surface text-foreground shadow-xs ring-1 ring-border',
                  )}
                >
                  <Icon
                    className={cn(
                      'size-4 shrink-0 transition-colors',
                      active
                        ? 'text-primary'
                        : 'text-subtle-foreground group-hover:text-foreground',
                    )}
                    aria-hidden
                  />
                  {!collapsed && label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="space-y-1 border-t p-3">
        {onToggleCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            className={cn(
              'flex h-8 w-full cursor-pointer items-center gap-2.5 rounded-md px-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground',
              collapsed && 'justify-center px-0',
            )}
            aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <>
                <PanelLeftClose className="size-4" /> Contraer
              </>
            )}
          </button>
        )}
        <UserMenu collapsed={collapsed} />
      </div>
    </div>
  );
}
