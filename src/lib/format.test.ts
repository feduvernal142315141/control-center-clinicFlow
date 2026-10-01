import { describe, expect, it } from 'vitest';
import { deniedReasonSchema } from './api/schemas';
import { deniedReasonText, slugify } from './format';

describe('deniedReasonText', () => {
  it('todo motivo OFF del contrato tiene texto', () => {
    for (const reason of deniedReasonSchema.options) {
      expect(deniedReasonText({ deniedReason: reason })).toMatch(/^OFF: .+/);
    }
  });

  it('MISSING_DEPENDENCY nombra la dependencia que falta', () => {
    expect(
      deniedReasonText({
        deniedReason: 'MISSING_DEPENDENCY',
        missingDependencies: ['DENTAL_ODONTOGRAM'],
      }),
    ).toBe('OFF: falta dependencia DENTAL_ODONTOGRAM');
  });

  it('un módulo ON no tiene motivo', () => {
    expect(deniedReasonText({ deniedReason: null })).toBeNull();
  });
});

describe('slugify', () => {
  it('normaliza acentos, apóstrofes y espacios', () => {
    expect(slugify("Clínica Dental D'Armas")).toBe('clinica-dental-d-armas');
  });
});
