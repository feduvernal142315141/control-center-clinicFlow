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

export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/clinicas', label: 'Clínicas', icon: Building2 },
  { href: '/planes', label: 'Planes', icon: Tags },
  { href: '/modulos', label: 'Módulos', icon: Blocks },
  { href: '/especialidades', label: 'Especialidades', icon: Stethoscope },
  { href: '/auditoria', label: 'Auditoría', icon: ScrollText },
];

export function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}
