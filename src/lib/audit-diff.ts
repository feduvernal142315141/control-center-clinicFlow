/**
 * Diff de presentación entre `before` y `after` de un evento de auditoría: lista campo a
 * campo qué cambió. No interpreta reglas de negocio; solo compara JSON.
 */

export type DiffKind = 'changed' | 'added' | 'removed' | 'same';

export interface DiffRow {
  path: string;
  before: unknown;
  after: unknown;
  kind: DiffKind;
}

/** Arreglos de objetos con estas claves se comparan por clave, no por posición. */
const ID_KEYS = ['moduleCode', 'code', 'id'] as const;

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function flatten(value: unknown, prefix: string, out: Map<string, unknown>) {
  if (Array.isArray(value)) {
    if (value.length === 0 || value.every((x) => !isObject(x) && !Array.isArray(x))) {
      out.set(prefix || '(valor)', value);
      return;
    }
    const idKey = ID_KEYS.find((k) => value.every((x) => isObject(x) && typeof x[k] === 'string'));
    value.forEach((item, i) =>
      flatten(
        item,
        `${prefix}[${idKey ? String((item as Record<string, unknown>)[idKey]) : i}]`,
        out,
      ),
    );
    return;
  }
  if (isObject(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      out.set(prefix || '(valor)', {});
      return;
    }
    for (const [key, v] of entries) flatten(v, prefix ? `${prefix}.${key}` : key, out);
    return;
  }
  out.set(prefix || '(valor)', value);
}

export function diffAudit(before: unknown, after: unknown): DiffRow[] {
  const b = new Map<string, unknown>();
  const a = new Map<string, unknown>();
  if (before !== null && before !== undefined) flatten(before, '', b);
  if (after !== null && after !== undefined) flatten(after, '', a);

  const keys = [...a.keys(), ...[...b.keys()].filter((k) => !a.has(k))];
  return keys.map((path) => {
    const inBefore = b.has(path);
    const inAfter = a.has(path);
    const kind: DiffKind = !inBefore
      ? 'added'
      : !inAfter
        ? 'removed'
        : JSON.stringify(b.get(path)) === JSON.stringify(a.get(path))
          ? 'same'
          : 'changed';
    return { path, before: b.get(path), after: a.get(path), kind };
  });
}

export function formatDiffValue(value: unknown): string {
  if (value === undefined) return '—';
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}
