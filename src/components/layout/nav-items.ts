import {
  Blocks,
  Building2,
  LayoutDashboard,
  type LucideIcon,
  ScrollText,
  Stethoscope,
  Tags,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Operación',
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/clinicas', label: 'Clínicas', icon: Building2 },
    ],
  },
  {
    label: 'Catálogo',
    items: [
      { href: '/planes', label: 'Planes', icon: Tags },
      { href: '/modulos', label: 'Módulos', icon: Blocks },
      { href: '/especialidades', label: 'Especialidades', icon: Stethoscope },
    ],
  },
  {
    label: 'Control',
    items: [{ href: '/auditoria', label: 'Auditoría', icon: ScrollText }],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

export function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

/** Etiquetas de segmentos estáticos para los breadcrumbs. */
export const SEGMENT_LABELS: Record<string, string> = {
  clinicas: 'Clínicas',
  planes: 'Planes',
  modulos: 'Módulos',
  especialidades: 'Especialidades',
  auditoria: 'Auditoría',
  nueva: 'Nueva',
  nuevo: 'Nuevo',
};
