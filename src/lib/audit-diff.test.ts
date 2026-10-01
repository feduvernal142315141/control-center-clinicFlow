import { describe, expect, it } from 'vitest';
import { diffAudit } from './audit-diff';

describe('diffAudit', () => {
  it('marca solo los campos que cambiaron', () => {
    const rows = diffAudit(
      { planCode: 'PRO', status: 'ACTIVE', trial: false },
      { planCode: 'PREMIUM', status: 'ACTIVE', trial: false },
    );
    expect(rows.filter((r) => r.kind === 'changed')).toEqual([
      { path: 'planCode', before: 'PRO', after: 'PREMIUM', kind: 'changed' },
    ]);
    expect(rows.filter((r) => r.kind === 'same').map((r) => r.path)).toEqual(['status', 'trial']);
  });

  it('creación (before null) y borrado (after null)', () => {
    expect(diffAudit(null, { name: 'X' })).toEqual([
      { path: 'name', before: undefined, after: 'X', kind: 'added' },
    ]);
    expect(diffAudit({ name: 'X' }, null)).toEqual([
      { path: 'name', before: 'X', after: undefined, kind: 'removed' },
    ]);
  });

  it('objetos anidados por ruta y arreglos de módulos por moduleCode', () => {
    const rows = diffAudit(
      {
        subscription: { planCode: 'PRO' },
        modules: [
          { moduleCode: 'A', enabled: true },
          { moduleCode: 'B', enabled: false },
        ],
      },
      {
        subscription: { planCode: 'BASIC' },
        modules: [
          { moduleCode: 'B', enabled: true },
          { moduleCode: 'A', enabled: true },
        ],
      },
    );
    const changed = rows.filter((r) => r.kind === 'changed').map((r) => r.path);
    expect(changed).toEqual(['subscription.planCode', 'modules[B].enabled']);
  });

  it('arreglos de primitivos se comparan completos', () => {
    const rows = diffAudit({ dependsOn: ['A'] }, { dependsOn: ['A', 'B'] });
    expect(rows).toEqual([
      { path: 'dependsOn', before: ['A'], after: ['A', 'B'], kind: 'changed' },
    ]);
  });
});
