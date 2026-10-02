'use client';

import { Moon, Sun } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { effectiveTheme, toggleTheme } from '@/lib/theme';

// Suscripción mínima: cambios del sistema y del propio toggle.
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
function subscribe(listener: () => void) {
  listeners.add(listener);
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', listener);
  return () => {
    listeners.delete(listener);
    media.removeEventListener('change', listener);
  };
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, effectiveTheme, () => 'light' as const);
  return {
    theme,
    toggle: () => {
      toggleTheme();
      notify();
    },
  };
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const label = theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro';
  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label={label} title={label}>
      {theme === 'dark' ? <Sun /> : <Moon />}
    </Button>
  );
}
