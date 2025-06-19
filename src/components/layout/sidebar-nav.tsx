
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  ClipboardEdit,
  Settings,
  Users,
  ListChecks,
  ActivitySquare,
  Database,
  TrendingUp,
  Target,
  History,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/captura', label: 'Captura', icon: ClipboardEdit },
  { href: '/configuracion', label: 'Configuración', icon: Settings },
  { href: '/usuarios', label: 'Usuarios', icon: Users },
  { href: '/actividades', label: 'Actividades', icon: ListChecks },
  { href: '/analisis', label: 'Análisis', icon: ActivitySquare },
  { href: '/datos-capturados', label: 'Datos Capturados', icon: Database },
  { href: '/mejoras', label: 'Mejoras', icon: TrendingUp },
  { href: '/acciones', label: 'Acciones', icon: Target },
  { href: '/auditoria', label: 'Auditoría', icon: History },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <SidebarMenu>
      {navItems.map((item) => (
        <SidebarMenuItem key={item.href}>
          <SidebarMenuButton
            asChild
            isActive={pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))}
            className={cn(
              'w-full justify-start',
              (pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))) ? 'bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent/90' : ''
            )}
            tooltip={{ children: item.label, side: "right", align: "center" }}
          >
            <Link href={item.href}>
              <item.icon className="h-5 w-5" />
              <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}
