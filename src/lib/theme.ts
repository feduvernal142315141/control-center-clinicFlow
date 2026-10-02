/**
 * Tema claro/oscuro. Por defecto sigue al sistema (`color-scheme: light dark`).
 * La cookie `kw_theme` (no sensible, legible por JS) fija uno; el servidor la lee y pone
 * `data-theme` + `<meta name="color-scheme">` antes de pintar: sin parpadeo.
 */
export const THEME_COOKIE = 'kw_theme';
export const SIDEBAR_COOKIE = 'kw_sidebar';
export type PinnedTheme = 'light' | 'dark';

export const parseTheme = (value: string | undefined): PinnedTheme | undefined =>
  value === 'light' || value === 'dark' ? value : undefined;

const ONE_YEAR = 60 * 60 * 24 * 365;

export function writePreferenceCookie(name: string, value: string | null) {
  document.cookie =
    value === null
      ? `${name}=; path=/; max-age=0; samesite=lax`
      : `${name}=${value}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
}

const systemTheme = (): PinnedTheme =>
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

export function effectiveTheme(): PinnedTheme {
  return parseTheme(document.documentElement.dataset.theme) ?? systemTheme();
}

/**
 * Cambia al tema contrario del que se ve. Si el resultado coincide con el sistema, se
 * deja de fijar (vuelve a seguir al sistema); si no, se fija.
 */
export function toggleTheme(): PinnedTheme {
  const next: PinnedTheme = effectiveTheme() === 'dark' ? 'light' : 'dark';
  const root = document.documentElement;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
  if (next === systemTheme()) {
    delete root.dataset.theme;
    writePreferenceCookie(THEME_COOKIE, null);
    if (meta) meta.content = 'light dark';
  } else {
    root.dataset.theme = next;
    writePreferenceCookie(THEME_COOKIE, next);
    if (meta) meta.content = next;
  }
  return next;
}
