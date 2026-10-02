'use client';

import { ChevronsUpDown, LogOut, Moon, Sun } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useLogout } from '@/lib/api/hooks/use-logout';
import { useMe } from '@/lib/api/hooks/use-me';
import { cn } from '@/lib/utils';
import { useTheme } from './theme-toggle';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

/** Pie del sidebar: identidad del usuario KodeWave, tema y cerrar sesión. */
export function UserMenu({ collapsed = false }: { collapsed?: boolean }) {
  const me = useMe();
  const logout = useLogout();
  const { theme, toggle } = useTheme();

  if (me.isPending) return <Skeleton className={cn('h-10', collapsed ? 'w-10' : 'w-full')} />;

  const name = me.data?.fullName ?? 'Sesión';
  const email = me.data?.email ?? '';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-testid="user-menu"
        className={cn(
          'flex w-full cursor-pointer items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-sidebar-accent focus-visible:outline-2',
          collapsed && 'justify-center',
        )}
        aria-label={collapsed ? `Cuenta de ${email}` : undefined}
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-gradient-to-br from-primary to-[oklch(0.6_0.2_300)] text-xs font-semibold text-white">
          {initials(name)}
        </span>
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-sm font-medium text-foreground">{name}</span>
              <span className="block truncate text-xs text-muted-foreground">{email}</span>
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-subtle-foreground" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent side={collapsed ? 'right' : 'top'} align="start" className="w-60">
        <DropdownMenuLabel className="space-y-0.5">
          <p className="truncate">{name}</p>
          <p className="truncate text-xs font-normal text-muted-foreground">{email}</p>
          {me.data && (
            <p className="text-xs font-normal text-muted-foreground">{me.data.roles.join(', ')}</p>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={toggle}>
          {theme === 'dark' ? <Sun /> : <Moon />}
          {theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => logout.mutate()} disabled={logout.isPending}>
          <LogOut /> Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
