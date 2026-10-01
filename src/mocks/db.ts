import type {
  AuditLog,
  ClinicDetail,
  ModuleOverride,
  Plan,
  PlatformModule,
} from '@/lib/api/schemas';
import {
  seedAuditLogs,
  seedClinics,
  seedKillSwitches,
  seedModules,
  seedOverrides,
  seedPlans,
  seedSpecialties,
  seedUsers,
  type MockUser,
  type SpecialtyRow,
} from './data';

export interface MockDb {
  users: MockUser[];
  specialties: SpecialtyRow[];
  modules: PlatformModule[];
  plans: Plan[];
  clinics: ClinicDetail[];
  overrides: Record<string, ModuleOverride[]>;
  killSwitches: Set<string>;
  auditLogs: AuditLog[];
  accessTokens: Map<string, { userId: string; expiresAt: number }>;
  refreshTokens: Map<string, string>;
  mfaTokens: Map<string, { userId: string; expiresAt: number }>;
  failedLogins: Map<string, number>;
  seq: number;
}

export function createDb(): MockDb {
  return {
    users: structuredClone(seedUsers),
    specialties: structuredClone(seedSpecialties),
    modules: structuredClone(seedModules),
    plans: structuredClone(seedPlans),
    clinics: structuredClone(seedClinics),
    overrides: structuredClone(seedOverrides),
    killSwitches: new Set(seedKillSwitches),
    auditLogs: structuredClone(seedAuditLogs),
    accessTokens: new Map(),
    refreshTokens: new Map(),
    mfaTokens: new Map(),
    failedLogins: new Map(),
    seq: 1000,
  };
}

// Sobrevive al HMR de `next dev`: el estado vive en globalThis.
const g = globalThis as typeof globalThis & { __kwMockDb?: MockDb };

export function getDb(): MockDb {
  g.__kwMockDb ??= createDb();
  return g.__kwMockDb;
}

export function resetDb(): MockDb {
  g.__kwMockDb = createDb();
  return g.__kwMockDb;
}

export function nextId(db: MockDb, prefix: string): string {
  db.seq += 1;
  return `${prefix}-${db.seq}`;
}
