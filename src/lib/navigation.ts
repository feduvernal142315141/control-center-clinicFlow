/**
 * Navegación completa del documento (no la del router de Next). Se usa al cambiar de
 * sesión: descarta caché del router y estado en memoria, y el middleware evalúa la ruta
 * con las cookies nuevas.
 */
export function hardNavigate(url: string) {
  window.location.assign(url);
}
