import { afterEach, describe, expect, it, vi } from 'vitest';
import { effectiveTheme, toggleTheme } from './theme';

function setSystem(dark: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) => ({ matches: dark, media: query }) as MediaQueryList,
  );
}

afterEach(() => {
  delete document.documentElement.dataset.theme;
  document.head.innerHTML = '';
  document.cookie = 'kw_theme=; path=/; max-age=0';
});

describe('toggleTheme', () => {
  it('sistema claro → fija oscuro (cookie + data-theme + meta)', () => {
    setSystem(false);
    document.head.innerHTML = '<meta name="color-scheme" content="light dark">';
    expect(effectiveTheme()).toBe('light');
    expect(toggleTheme()).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.cookie).toContain('kw_theme=dark');
    expect(document.querySelector('meta')!.getAttribute('content')).toBe('dark');
  });

  it('volver al tema del sistema deja de fijarlo', () => {
    setSystem(false);
    document.head.innerHTML = '<meta name="color-scheme" content="dark">';
    document.documentElement.dataset.theme = 'dark';
    expect(toggleTheme()).toBe('light');
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(document.cookie).not.toContain('kw_theme=');
    expect(document.querySelector('meta')!.getAttribute('content')).toBe('light dark');
  });

  it('siempre cambia lo que se ve, aunque el sistema cambie después', () => {
    setSystem(true);
    document.documentElement.dataset.theme = 'dark'; // fijado oscuro y sistema también oscuro
    expect(toggleTheme()).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});
