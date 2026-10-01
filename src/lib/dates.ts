/** ISO 8601 → valor de `<input type="date">` en la zona del navegador. */
export function toDateInput(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Fecha local (inicio del día en la zona del navegador) → ISO 8601. */
export function fromDateInput(value: string) {
  return new Date(`${value}T00:00:00`).toISOString();
}
