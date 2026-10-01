import type {
  AuditLog,
  ClinicDetail,
  ModuleOverride,
  Plan,
  PlatformModule,
  Specialty,
} from '@/lib/api/schemas';

/**
 * Datos semilla del backend falso. Escenarios cubiertos:
 * - Clínica Dental D'Armas: DENTAL, PREMIUM, ACTIVE.
 * - Centro Podológico X: PODIATRY, PRO, módulos DENTAL_* OFF por SPECIALTY_INCOMPATIBLE.
 * - Sonrisas del Norte: SUSPENDED (todo OFF por CLINIC_SUSPENDED).
 * - Odontología Integral Lara: overrides → OVERRIDE_OFF y MISSING_DEPENDENCY.
 * - Plan LEGACY_DENTAL con todos los módulos actuales de la app dental.
 * - AI_CLINICAL_NOTES inactivo (MODULE_INACTIVE) y GROWTH_REVIEWS con kill switch.
 */

export const MOCK_PASSWORD = 'KodeWave2026!';
export const MOCK_TOTP_CODE = '123456';

export interface MockUser {
  id: string;
  email: string;
  fullName: string;
  password: string;
  mfa: boolean;
  locked: boolean;
}

export const seedUsers: MockUser[] = [
  {
    id: 'u-admin',
    email: 'admin@kodewave.com',
    fullName: 'Ana Admin',
    password: MOCK_PASSWORD,
    mfa: false,
    locked: false,
  },
  {
    id: 'u-mfa',
    email: 'mfa@kodewave.com',
    fullName: 'Mario Factor',
    password: MOCK_PASSWORD,
    mfa: true,
    locked: false,
  },
  {
    id: 'u-locked',
    email: 'locked@kodewave.com',
    fullName: 'Lucía Bloqueada',
    password: MOCK_PASSWORD,
    mfa: false,
    locked: true,
  },
];

export const seedSpecialties: Specialty[] = [
  { code: 'DENTAL', name: 'Odontología', active: true },
  { code: 'PODIATRY', name: 'Podología', active: true },
  { code: 'GENERAL', name: 'Medicina general', active: true },
  { code: 'DERMATOLOGY', name: 'Dermatología', active: false },
];

const mod = (
  code: string,
  name: string,
  category: PlatformModule['category'],
  extra: Partial<PlatformModule> = {},
): PlatformModule => ({
  id: `m-${code.toLowerCase().replaceAll('_', '-')}`,
  code,
  name,
  category,
  requiredCore: false,
  active: true,
  compatibleSpecialties: [],
  dependsOn: [],
  ...extra,
});

export const seedModules: PlatformModule[] = [
  mod('CORE_PATIENTS', 'Pacientes', 'CORE', { requiredCore: true }),
  mod('CORE_APPOINTMENTS', 'Agenda y citas', 'CORE', {
    requiredCore: true,
    dependsOn: ['CORE_PATIENTS'],
  }),
  mod('CORE_CLINICAL_RECORDS', 'Historia clínica', 'CORE', {
    requiredCore: true,
    dependsOn: ['CORE_PATIENTS'],
  }),
  mod('COMMS_EMAIL_REMINDERS', 'Recordatorios por correo', 'COMMS', {
    dependsOn: ['CORE_APPOINTMENTS'],
  }),
  mod('COMMS_WHATSAPP', 'WhatsApp', 'COMMS', { dependsOn: ['CORE_APPOINTMENTS'] }),
  mod('AI_RECEPTIONIST', 'Recepcionista IA', 'AI', {
    description: 'Agenda citas por WhatsApp con IA.',
    dependsOn: ['COMMS_WHATSAPP'],
  }),
  mod('AI_CLINICAL_NOTES', 'Notas clínicas con IA', 'AI', {
    active: false,
    dependsOn: ['CORE_CLINICAL_RECORDS'],
  }),
  mod('MARKETING_CAMPAIGNS', 'Campañas', 'MARKETING', { dependsOn: ['COMMS_EMAIL_REMINDERS'] }),
  mod('GROWTH_REVIEWS', 'Reseñas en Google', 'GROWTH'),
  mod('DENTAL_ODONTOGRAM', 'Odontograma', 'SPECIALTY', { compatibleSpecialties: ['DENTAL'] }),
  mod('DENTAL_TREATMENT_PLANS', 'Planes de tratamiento', 'SPECIALTY', {
    compatibleSpecialties: ['DENTAL'],
    dependsOn: ['DENTAL_ODONTOGRAM'],
  }),
  mod('DENTAL_PERIODONTOGRAM', 'Periodontograma', 'SPECIALTY', {
    compatibleSpecialties: ['DENTAL'],
    dependsOn: ['DENTAL_ODONTOGRAM'],
  }),
  mod('PODIATRY_FOOT_EXAM', 'Exploración podológica', 'SPECIALTY', {
    compatibleSpecialties: ['PODIATRY'],
  }),
];

/** Kill switches globales (feature flags) activos en el backend falso. */
export const seedKillSwitches: string[] = ['GROWTH_REVIEWS'];

const CORE = seedModules.filter((m) => m.requiredCore).map((m) => m.code);

function matrix(enabled: string[], limits: Record<string, Record<string, number | null>> = {}) {
  const on = new Set([...CORE, ...enabled]);
  return seedModules.map((m) => ({
    moduleCode: m.code,
    enabled: on.has(m.code),
    ...(limits[m.code] ? { limits: limits[m.code] } : {}),
  }));
}

const BASIC = ['COMMS_EMAIL_REMINDERS'];
const PRO = [
  ...BASIC,
  'COMMS_WHATSAPP',
  'GROWTH_REVIEWS',
  'DENTAL_ODONTOGRAM',
  'DENTAL_TREATMENT_PLANS',
  'PODIATRY_FOOT_EXAM',
];

export const seedPlans: Plan[] = [
  {
    id: 'p-basic',
    code: 'BASIC',
    name: 'Básico',
    active: true,
    sortOrder: 10,
    modules: matrix(BASIC, { COMMS_EMAIL_REMINDERS: { monthlyEmails: 1000 } }),
  },
  {
    id: 'p-pro',
    code: 'PRO',
    name: 'Pro',
    active: true,
    sortOrder: 20,
    modules: matrix(PRO, { COMMS_WHATSAPP: { monthlyMessages: 2000 } }),
  },
  {
    id: 'p-premium',
    code: 'PREMIUM',
    name: 'Premium',
    active: true,
    sortOrder: 30,
    modules: matrix(
      seedModules.map((m) => m.code),
      {
        AI_RECEPTIONIST: { monthlyConversations: 5000 },
        COMMS_WHATSAPP: { monthlyMessages: null },
      },
    ),
  },
  {
    id: 'p-legacy-dental',
    code: 'LEGACY_DENTAL',
    name: 'Legacy dental',
    description: 'Clínicas dentales existentes antes de la plataforma modular.',
    active: true,
    sortOrder: 99,
    modules: matrix([
      'COMMS_EMAIL_REMINDERS',
      'COMMS_WHATSAPP',
      'AI_RECEPTIONIST',
      'MARKETING_CAMPAIGNS',
      'GROWTH_REVIEWS',
      'DENTAL_ODONTOGRAM',
      'DENTAL_TREATMENT_PLANS',
      'DENTAL_PERIODONTOGRAM',
    ]),
  },
];

const planId = (code: string) => seedPlans.find((p) => p.code === code)!.id;

function clinic(
  id: string,
  name: string,
  slug: string,
  specialtyCode: string,
  operationalStatus: ClinicDetail['operationalStatus'],
  planCode: string | null,
  createdAt: string,
): ClinicDetail {
  const trial = operationalStatus === 'TRIAL';
  return {
    id,
    name,
    slug,
    specialtyCode,
    operationalStatus,
    planCode,
    createdAt,
    subscription: planCode
      ? {
          id: `s-${id}`,
          planId: planId(planCode),
          planCode,
          status: trial ? 'TRIAL' : operationalStatus === 'SUSPENDED' ? 'PAST_DUE' : 'ACTIVE',
          startsAt: createdAt,
          endsAt: trial ? '2026-10-31T23:59:59-04:00' : null,
          renewalDate: trial ? null : '2026-11-01T00:00:00-04:00',
          trial,
        }
      : null,
  };
}

const FILLER_NAMES = [
  'Clínica Dental Altamira',
  'Odontólogos Asociados Mérida',
  'Pie Sano Valencia',
  'Consultorio San Rafael',
  'Dental Care Maracay',
  'Podología Los Andes',
  'Centro Médico La Candelaria',
  'Sonrisa Perfecta',
  'Clínica Dental Chacao',
  'Podocentro Barquisimeto',
  'Medicina Familiar El Valle',
  'Dentistas del Este',
  'Clínica Dental Puerto Ordaz',
  'Unidad Podológica Maturín',
  'Policlínica Santa Rosa',
  'Ortodoncia Cumaná',
  'Dental Express Margarita',
  'Consultorio Dr. Pérez',
];
const FILLER_SPECIALTIES = ['DENTAL', 'DENTAL', 'PODIATRY', 'GENERAL'] as const;
const FILLER_PLANS = ['BASIC', 'PRO', 'PREMIUM', 'LEGACY_DENTAL'] as const;
const FILLER_STATUS = ['ACTIVE', 'ACTIVE', 'ACTIVE', 'TRIAL', 'SUSPENDED'] as const;

const slugify = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export const seedClinics: ClinicDetail[] = [
  clinic(
    'c-darmas',
    "Clínica Dental D'Armas",
    'clinica-dental-darmas',
    'DENTAL',
    'ACTIVE',
    'PREMIUM',
    '2025-03-14T10:00:00-04:00',
  ),
  clinic(
    'c-podologico-x',
    'Centro Podológico X',
    'centro-podologico-x',
    'PODIATRY',
    'ACTIVE',
    'PRO',
    '2026-06-02T09:30:00-04:00',
  ),
  clinic(
    'c-sonrisas-norte',
    'Sonrisas del Norte',
    'sonrisas-del-norte',
    'DENTAL',
    'SUSPENDED',
    'LEGACY_DENTAL',
    '2024-11-20T15:45:00-04:00',
  ),
  clinic(
    'c-lara',
    'Odontología Integral Lara',
    'odontologia-integral-lara',
    'DENTAL',
    'ACTIVE',
    'PRO',
    '2026-01-10T08:00:00-04:00',
  ),
  clinic(
    'c-vida',
    'Consultorio Médico Vida',
    'consultorio-medico-vida',
    'GENERAL',
    'TRIAL',
    'BASIC',
    '2026-09-20T12:00:00-04:00',
  ),
  clinic(
    'c-piel-sana',
    'Clínica Piel Sana',
    'clinica-piel-sana',
    'GENERAL',
    'INACTIVE',
    null,
    '2025-08-01T10:00:00-04:00',
  ),
  ...FILLER_NAMES.map((name, i) => {
    const specialty = FILLER_SPECIALTIES[i % FILLER_SPECIALTIES.length];
    const plan = specialty === 'DENTAL' ? FILLER_PLANS[i % 4] : FILLER_PLANS[i % 3];
    const day = String((i % 27) + 1).padStart(2, '0');
    const month = String((i % 9) + 1).padStart(2, '0');
    return clinic(
      `c-${slugify(name)}`,
      name,
      slugify(name),
      specialty,
      FILLER_STATUS[i % FILLER_STATUS.length],
      plan,
      `2026-${month}-${day}T10:00:00-04:00`,
    );
  }),
];

export const seedOverrides: Record<string, ModuleOverride[]> = {
  'c-lara': [
    {
      moduleCode: 'COMMS_WHATSAPP',
      enabled: false,
      reason: 'La clínica pidió pausar WhatsApp mientras cambian de número.',
      createdBy: 'admin@kodewave.com',
      createdAt: '2026-09-15T11:00:00-04:00',
      expiresAt: '2026-12-31T23:59:59-04:00',
    },
    {
      moduleCode: 'AI_RECEPTIONIST',
      enabled: true,
      reason: 'Piloto comercial de recepcionista IA aprobado por ventas.',
      createdBy: 'admin@kodewave.com',
      createdAt: '2026-09-15T11:05:00-04:00',
      expiresAt: null,
    },
  ],
};

export const seedAuditLogs: AuditLog[] = [
  {
    id: 'a-1',
    actor: { id: 'u-admin', email: 'admin@kodewave.com' },
    action: 'CLINIC_SUSPENDED',
    clinicId: 'c-sonrisas-norte',
    entityType: 'Clinic',
    entityId: 'c-sonrisas-norte',
    before: { operationalStatus: 'ACTIVE' },
    after: { operationalStatus: 'SUSPENDED' },
    reason: 'Tres meses sin pago; se notificó por correo al administrador.',
    ip: '10.0.0.12',
    createdAt: '2026-09-01T09:12:00-04:00',
  },
  {
    id: 'a-2',
    actor: { id: 'u-admin', email: 'admin@kodewave.com' },
    action: 'MODULE_OVERRIDES_UPDATED',
    clinicId: 'c-lara',
    entityType: 'ModuleOverride',
    entityId: 'c-lara',
    before: [],
    after: seedOverrides['c-lara'],
    reason: 'Piloto comercial de recepcionista IA aprobado por ventas.',
    ip: '10.0.0.12',
    createdAt: '2026-09-15T11:05:00-04:00',
  },
];
