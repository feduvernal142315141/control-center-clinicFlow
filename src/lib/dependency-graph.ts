/**
 * Validación rápida en el cliente del grafo de dependencias de módulos.
 * La validación que manda es la del backend (MODULE_DEPENDENCY_SELF / _CYCLE).
 */

export interface DependencyNode {
  code: string;
  dependsOn: string[];
}

export type DependencyIssue =
  { kind: 'SELF'; path: [string, string] } | { kind: 'CYCLE'; path: string[] };

/**
 * ¿Qué pasa si `code` pasa a depender de `dependsOn`? Devuelve la auto-dependencia o el
 * primer ciclo encontrado por DFS como camino cerrado (A → B → C → A), o `null`.
 */
export function findDependencyIssue(
  catalog: DependencyNode[],
  code: string,
  dependsOn: string[],
): DependencyIssue | null {
  if (dependsOn.includes(code)) return { kind: 'SELF', path: [code, code] };

  const graph = new Map(catalog.map((m) => [m.code, m.dependsOn]));
  graph.set(code, dependsOn);

  const done = new Set<string>(); // nodos ya explorados sin hallar ciclo
  const dfs = (node: string, path: string[]): string[] | null => {
    for (const next of graph.get(node) ?? []) {
      if (next === code) return [...path, next];
      if (done.has(next) || path.includes(next)) continue;
      const found = dfs(next, [...path, next]);
      if (found) return found;
    }
    done.add(node);
    return null;
  };

  const path = dfs(code, [code]);
  return path ? { kind: 'CYCLE', path } : null;
}

export const formatDependencyPath = (path: string[]) => path.join(' → ');

export interface MissingPlanDependency {
  moduleCode: string;
  missing: string[];
}

/**
 * Módulos que quedarían ON en el plan sin sus dependencias. Es solo una advertencia:
 * no bloquea el guardado (lo decide el backend vía módulos efectivos).
 */
export function missingPlanDependencies(
  catalog: DependencyNode[],
  enabledCodes: ReadonlySet<string>,
): MissingPlanDependency[] {
  return catalog
    .filter((m) => enabledCodes.has(m.code))
    .map((m) => ({ moduleCode: m.code, missing: m.dependsOn.filter((d) => !enabledCodes.has(d)) }))
    .filter((r) => r.missing.length > 0);
}
