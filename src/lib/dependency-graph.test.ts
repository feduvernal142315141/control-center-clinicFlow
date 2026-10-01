import { describe, expect, it } from 'vitest';
import {
  findDependencyIssue,
  formatDependencyPath,
  missingPlanDependencies,
} from './dependency-graph';

const catalog = (edges: Record<string, string[]>) =>
  Object.entries(edges).map(([code, dependsOn]) => ({ code, dependsOn }));

describe('findDependencyIssue', () => {
  it('A → A: auto-dependencia', () => {
    expect(findDependencyIssue(catalog({ A: [] }), 'A', ['A'])).toEqual({
      kind: 'SELF',
      path: ['A', 'A'],
    });
  });

  it('A → B → A', () => {
    const issue = findDependencyIssue(catalog({ A: [], B: ['A'] }), 'A', ['B']);
    expect(issue).toEqual({ kind: 'CYCLE', path: ['A', 'B', 'A'] });
    expect(formatDependencyPath(issue!.path)).toBe('A → B → A');
  });

  it('A → B → C → A', () => {
    const issue = findDependencyIssue(catalog({ A: [], B: ['C'], C: ['A'] }), 'A', ['B']);
    expect(issue).toEqual({ kind: 'CYCLE', path: ['A', 'B', 'C', 'A'] });
  });

  it('quitar una arista del ciclo lo arregla', () => {
    const graph = catalog({ A: [], B: ['C'], C: ['A'] });
    expect(findDependencyIssue(graph, 'A', ['B'])).not.toBeNull();
    // Se quita C → A editando C:
    expect(findDependencyIssue(graph, 'C', [])).toBeNull();
    expect(findDependencyIssue(catalog({ A: ['B'], B: ['C'], C: [] }), 'A', ['B'])).toBeNull();
    // O se quita A → B editando A:
    expect(findDependencyIssue(graph, 'A', [])).toBeNull();
  });

  it('un diamante sin ciclo es válido', () => {
    const graph = catalog({ B: ['D'], C: ['D'], D: [] });
    expect(findDependencyIssue(graph, 'A', ['B', 'C'])).toBeNull();
  });

  it('detecta ciclos al crear un módulo nuevo que no está en el catálogo', () => {
    // NEW → B y B → NEW (porque alguien ya lo referenció)
    expect(findDependencyIssue(catalog({ B: ['NEW'] }), 'NEW', ['B'])).toEqual({
      kind: 'CYCLE',
      path: ['NEW', 'B', 'NEW'],
    });
  });

  it('ciclos que no pasan por el módulo editado no son su problema', () => {
    expect(findDependencyIssue(catalog({ B: ['C'], C: ['B'] }), 'A', ['B'])).toBeNull();
  });
});

describe('missingPlanDependencies', () => {
  it('advierte módulos ON sin sus dependencias en el plan', () => {
    const graph = catalog({ AI: ['WA'], WA: ['CORE'], CORE: [] });
    expect(missingPlanDependencies(graph, new Set(['AI', 'CORE']))).toEqual([
      { moduleCode: 'AI', missing: ['WA'] },
    ]);
    expect(missingPlanDependencies(graph, new Set(['AI', 'WA', 'CORE']))).toEqual([]);
  });
});
