import { describe, expect, it, vi } from 'vitest';
import { deniedReasonSchema } from './api/schemas';
import { auditActionLabel, deniedReasonText, slugify } from './format';

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

describe('auditActionLabel', () => {
  it('acciones conocidas con etiqueta; desconocidas con su código y un solo warn', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(auditActionLabel('CLINIC_SUSPENDED')).toBe('Clínica suspendida');
    expect(auditActionLabel('BILLING_SYNCED')).toBe('Acción no reconocida: BILLING_SYNCED');
    auditActionLabel('BILLING_SYNCED');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('BILLING_SYNCED'));
  });
});
