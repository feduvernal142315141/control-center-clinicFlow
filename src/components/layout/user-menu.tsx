'use client';

import { ChevronDown, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

export function UserMenu() {
  const me = useMe();
  const logout = useLogout();

  if (me.isPending) return <Skeleton className="h-8 w-40" />;
  if (me.isError) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => logout.mutate()}
        disabled={logout.isPending}
      >
        <LogOut /> Cerrar sesión
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-2 px-2" data-testid="user-menu">
          <span className="grid size-7 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {initials(me.data.fullName)}
          </span>
          <span className="hidden text-left text-sm leading-tight sm:block">
            <span className="block font-medium">{me.data.fullName}</span>
            <span className="block text-xs text-muted-foreground">{me.data.email}</span>
          </span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="space-y-0.5">
          <p>{me.data.fullName}</p>
          <p className="text-xs font-normal text-muted-foreground">{me.data.roles.join(', ')}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => logout.mutate()} disabled={logout.isPending}>
          <LogOut /> Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
