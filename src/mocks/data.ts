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
 * - Consultorio Médico Vida: ACTIVE con suscripción en trial (el trial no es estado operativo).
 * - Clínica Piel Sana: INACTIVE sin plan.
 * - Trial por vencer (3 días) y trial vencido (D8: suscripción PAST_DUE, clínica ACTIVE).
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

/** Las cuentas (clínicas, módulos) las calcula el handler. */
export type SpecialtyRow = Omit<Specialty, 'clinicCount' | 'compatibleModuleCount'>;

export const seedSpecialties: SpecialtyRow[] = [
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
  allowedLimits: [],
  version: 1,
  ...extra,
});

const limit = (key: string, label: string, unit: string) => ({ key, label, unit });

export const seedModules: PlatformModule[] = [
  mod('CORE_PATIENTS', 'Pacientes', 'CORE', {
    requiredCore: true,
    allowedLimits: [limit('maxPatients', 'Pacientes', 'pacientes')],
  }),
  mod('CORE_PROFESSIONALS', 'Profesionales', 'CORE', {
    requiredCore: true,
    allowedLimits: [limit('maxProfessionals', 'Profesionales', 'profesionales')],
  }),
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
  mod('COMMS_WHATSAPP', 'WhatsApp', 'COMMS', {
    dependsOn: ['CORE_APPOINTMENTS'],
    allowedLimits: [
      limit('maxWhatsAppNumbers', 'Números de WhatsApp', 'números'),
      limit('maxMonthlyMessages', 'Mensajes por mes', 'mensajes/mes'),
    ],
  }),
  mod('AI_RECEPTIONIST', 'Recepcionista IA', 'AI', {
    description: 'Agenda citas por WhatsApp con IA.',
    dependsOn: ['COMMS_WHATSAPP'],
  }),
  mod('AI_CLINICAL_NOTES', 'Notas clínicas con IA', 'AI', {
    active: false,
    dependsOn: ['CORE_CLINICAL_RECORDS'],
  }),
  mod('MARKETING_CAMPAIGNS', 'Campañas', 'MARKETING', {
    dependsOn: ['COMMS_EMAIL_REMINDERS'],
    allowedLimits: [limit('maxCampaignsPerMonth', 'Campañas por mes', 'campañas/mes')],
  }),
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
    modules: matrix(BASIC, {
      CORE_PATIENTS: { maxPatients: 500 },
      CORE_PROFESSIONALS: { maxProfessionals: 2 },
    }),
    version: 1,
  },
  {
    id: 'p-pro',
    code: 'PRO',
    name: 'Pro',
    active: true,
    sortOrder: 20,
    modules: matrix(PRO, {
      CORE_PROFESSIONALS: { maxProfessionals: 5 },
      COMMS_WHATSAPP: { maxWhatsAppNumbers: 1, maxMonthlyMessages: 2000 },
    }),
    version: 1,
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
        CORE_PROFESSIONALS: { maxProfessionals: null },
        COMMS_WHATSAPP: { maxWhatsAppNumbers: 3, maxMonthlyMessages: null },
        MARKETING_CAMPAIGNS: { maxCampaignsPerMonth: 10 },
      },
    ),
    version: 1,
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
    version: 1,
  },
];

const daysFromNow = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

const planId = (code: string) => seedPlans.find((p) => p.code === code)!.id;

function clinic(
  id: string,
  name: string,
  slug: string,
  specialtyCode: string,
  /** 'TRIAL' es solo un atajo de la semilla: clínica ACTIVE con suscripción en trial. */
  seedStatus: ClinicDetail['operationalStatus'] | 'TRIAL',
  planCode: string | null,
  createdAt: string,
  trialEndsAt = '2026-10-31T23:59:59-04:00',
): ClinicDetail {
  const trial = seedStatus === 'TRIAL' && planCode !== null;
  const operationalStatus = seedStatus === 'TRIAL' ? 'ACTIVE' : seedStatus;
  return {
    id,
    name,
    slug,
    specialtyCode,
    operationalStatus,
    planCode,
    trial,
    createdAt,
    version: 1,
    subscription: planCode
      ? {
          id: `s-${id}`,
          planId: planId(planCode),
          planCode,
          status: trial ? 'TRIAL' : operationalStatus === 'SUSPENDED' ? 'PAST_DUE' : 'ACTIVE',
          startsAt: createdAt,
          endsAt: trial ? trialEndsAt : null,
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
/** Especialidad coherente con el nombre de la clínica de relleno. */
const fillerSpecialty = (name: string) =>
  /dent|odont|sonris|ortodon/i.test(name)
    ? 'DENTAL'
    : /pie|podo/i.test(name)
      ? 'PODIATRY'
      : 'GENERAL';
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
  // D8: trials relativos a "hoy" para que el bloque Trials del dashboard tenga datos.
  clinic(
    'c-trial-por-vencer',
    'Clínica Dental Trial Próximo',
    'clinica-dental-trial-proximo',
    'DENTAL',
    'TRIAL',
    'BASIC',
    daysFromNow(-25),
    daysFromNow(3),
  ),
  clinic(
    'c-trial-vencido',
    'Podología Trial Vencido',
    'podologia-trial-vencido',
    'PODIATRY',
    'TRIAL',
    'PRO',
    daysFromNow(-35),
    daysFromNow(-5),
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
    const specialty = fillerSpecialty(name);
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
  // Vencido: se lista aparte y no tiene efecto.
  'c-darmas': [
    {
      moduleCode: 'GROWTH_REVIEWS',
      enabled: true,
      reason: 'Prueba de reseñas durante el congreso dental.',
      createdBy: 'admin@kodewave.com',
      createdAt: '2026-08-01T09:00:00-04:00',
      expiresAt: '2026-09-01T23:59:59-04:00',
    },
  ],
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

export const seedAuditLogs: Omit<AuditLog, 'clinicName'>[] = [
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
    action: 'MODULE_OVERRIDE_SET',
    clinicId: 'c-lara',
    entityType: 'ModuleOverride',
    entityId: 'c-lara:AI_RECEPTIONIST',
    before: null,
    after: seedOverrides['c-lara'][1],
    reason: 'Piloto comercial de recepcionista IA aprobado por ventas.',
    ip: '10.0.0.12',
    createdAt: '2026-09-15T11:05:00-04:00',
  },
  {
    id: 'a-3',
    actor: { id: 'u-admin', email: 'admin@kodewave.com' },
    action: 'MODULE_OVERRIDE_SET',
    clinicId: 'c-lara',
    entityType: 'ModuleOverride',
    entityId: 'c-lara:COMMS_WHATSAPP',
    before: null,
    after: seedOverrides['c-lara'][0],
    reason: 'La clínica pidió pausar WhatsApp mientras cambian de número.',
    ip: '10.0.0.12',
    createdAt: '2026-09-15T11:00:00-04:00',
  },
  {
    id: 'a-4',
    actor: { id: 'u-mfa', email: 'mfa@kodewave.com' },
    action: 'PLAN_CHANGED',
    clinicId: 'c-darmas',
    entityType: 'Subscription',
    entityId: 's-c-darmas',
    before: { planCode: 'PRO', status: 'ACTIVE', trial: false },
    after: { planCode: 'PREMIUM', status: 'ACTIVE', trial: false },
    reason: 'Upgrade a Premium acordado con la clínica.',
    ip: '10.0.0.20',
    createdAt: '2026-08-20T16:30:00-04:00',
  },
  {
    id: 'a-5',
    actor: { id: 'u-admin', email: 'admin@kodewave.com' },
    // D19: acción que el front no conoce; se muestra con su código.
    action: 'LEGACY_IMPORT',
    clinicId: 'c-sonrisas-norte',
    entityType: 'Clinic',
    entityId: 'c-sonrisas-norte',
    before: null,
    after: { source: 'ClinicaDental', importedModules: 9 },
    reason: null,
    ip: null,
    createdAt: '2026-07-01T08:00:00-04:00',
  },
];
