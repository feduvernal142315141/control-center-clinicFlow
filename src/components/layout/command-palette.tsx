'use client';

import {
  Blocks,
  Building2,
  CornerDownLeft,
  type LucideIcon,
  Moon,
  Plus,
  Search,
  Sun,
} from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useState } from 'react';
import { Kbd } from '@/components/ui/kbd';
import { useClinics } from '@/lib/api/hooks/use-clinics';
import { cn } from '@/lib/utils';
import { NAV_ITEMS } from './nav-items';
import { useTheme } from './theme-toggle';

interface Command {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  keywords?: string;
  run: () => void;
}

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** ⌘K / Ctrl+K desde cualquier pantalla. */
export function useCommandPaletteShortcut(toggle: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);
}

/**
 * Paleta de comandos: ir a una sección, acciones frecuentes y buscar clínicas por nombre o
 * slug (contra el backend). Combobox accesible con flechas, Enter y Esc.
 */
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listId = useId();
  const q = query.trim();
  const clinics = useClinics({ q, size: 6 }, open && q.length >= 2);

  const close = () => onOpenChange(false);
  const go = (href: string) => () => {
    close();
    router.push(href);
  };

  const commands = useMemo<Command[]>(() => {
    const nq = normalize(q);
    const match = (c: Command) => !nq || normalize(`${c.label} ${c.keywords ?? ''}`).includes(nq);
    const base: Command[] = [
      ...NAV_ITEMS.map((n) => ({
        id: `nav-${n.href}`,
        group: 'Ir a',
        label: n.label,
        icon: n.icon,
        run: go(n.href),
      })),
      {
        id: 'new-clinic',
        group: 'Acciones',
        label: 'Nueva clínica',
        icon: Plus,
        keywords: 'crear alta',
        run: go('/clinicas/nueva'),
      },
      {
        id: 'new-plan',
        group: 'Acciones',
        label: 'Nuevo plan',
        icon: Plus,
        keywords: 'crear',
        run: go('/planes/nuevo'),
      },
      {
        id: 'new-module',
        group: 'Acciones',
        label: 'Nuevo módulo',
        icon: Blocks,
        keywords: 'crear catalogo',
        run: go('/modulos/nuevo'),
      },
      {
        id: 'theme',
        group: 'Acciones',
        label: theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro',
        icon: theme === 'dark' ? Sun : Moon,
        keywords: 'tema oscuro claro dark light',
        run: () => {
          toggle();
          close();
        },
      },
    ].filter(match);
    const found: Command[] =
      q.length >= 2
        ? (clinics.data?.content ?? []).map((c) => ({
            id: `clinic-${c.id}`,
            group: 'Clínicas',
            label: c.name,
            hint: c.slug,
            icon: Building2,
            run: go(`/clinicas/${c.id}`),
          }))
        : [];
    return [...found, ...base];
    // eslint-disable-next-line react-hooks/exhaustive-deps -- go/close son estables en efecto
  }, [q, clinics.data, theme]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const groups = commands.reduce<Record<string, Command[]>>((acc, c) => {
    (acc[c.group] ??= []).push(c);
    return acc;
  }, {});
  const activeId = commands[active] ? `${listId}-${commands[active].id}` : undefined;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, commands.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      commands[active]?.run();
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed top-[14vh] left-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98]"
        >
          <DialogPrimitive.Title className="sr-only">Buscar o ir a…</DialogPrimitive.Title>
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="size-4 shrink-0 text-subtle-foreground" />
            <input
              autoFocus
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-activedescendant={activeId}
              aria-label="Buscar secciones, acciones o clínicas"
              placeholder="Buscar secciones, acciones o clínicas…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-subtle-foreground focus-visible:outline-none"
            />
            <Kbd>Esc</Kbd>
          </div>
          <div
            id={listId}
            role="listbox"
            aria-label="Resultados"
            className="max-h-[50vh] overflow-y-auto p-2"
          >
            {commands.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                {clinics.isFetching ? 'Buscando…' : 'Sin resultados.'}
              </p>
            ) : (
              Object.entries(groups).map(([group, items]) => (
                <div key={group} role="group" aria-label={group} className="pb-1">
                  <p className="px-2 pt-2 pb-1 text-[11px] font-medium tracking-wide text-subtle-foreground uppercase">
                    {group}
                  </p>
                  {items.map((c) => {
                    const index = commands.indexOf(c);
                    const selected = index === active;
                    return (
                      <div
                        key={c.id}
                        id={`${listId}-${c.id}`}
                        role="option"
                        aria-selected={selected}
                        onMouseMove={() => setActive(index)}
                        onClick={c.run}
                        className={cn(
                          'flex h-9 cursor-pointer items-center gap-2.5 rounded-md px-2 text-sm',
                          selected && 'bg-accent text-foreground',
                        )}
                      >
                        <c.icon className="size-4 shrink-0 text-subtle-foreground" />
                        <span className="truncate">{c.label}</span>
                        {c.hint && (
                          <span className="truncate font-mono text-xs text-subtle-foreground">
                            {c.hint}
                          </span>
                        )}
                        {selected && (
                          <CornerDownLeft className="ml-auto size-3.5 text-subtle-foreground" />
                        )}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
          <div className="flex items-center gap-3 border-t bg-surface-sunken px-3 py-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> navegar
            </span>
            <span className="flex items-center gap-1">
              <Kbd>↵</Kbd> abrir
            </span>
            <span className="ml-auto flex items-center gap-1">
              <Kbd>⌘</Kbd>
              <Kbd>K</Kbd> en cualquier pantalla
            </span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
