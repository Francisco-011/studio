
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
  Database,
  TrendingUp,
  Target,
  ClipboardCheck,
  FolderTree, 
  UploadCloud,
  ActivitySquare,
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
  { href: '/procesos-y-flujos-registrados', label: 'Procesos Registrados', icon: Database },
  { href: '/actividades', label: 'Actividades', icon: ListChecks },
  { href: '/analisis/panel-jerarquico', label: 'Panel Jerárquico', icon: FolderTree },
  { href: '/mejoras', label: 'Mejoras', icon: TrendingUp },
  { href: '/acciones', label: 'Acciones', icon: Target },
  { href: '/auditoria', label: 'Auditoría', icon: ClipboardCheck },
  { href: '/configuracion', label: 'Configuración', icon: Settings },
  { href: '/configuracion/carga-masiva', label: 'Carga Masiva', icon: UploadCloud },
  { href: '/usuarios', label: 'Usuarios', icon: Users },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <SidebarMenu>
      {navItems.map((item) => (
        <SidebarMenuItem key={item.href}>
          <SidebarMenuButton
            asChild
            isActive={pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href) && item.href.split('/').length === pathname.split('/').length || (pathname.startsWith(item.href) && item.href !== '/analisis' && item.href !== '/analisis/panel-jerarquico' && item.href !== '/configuracion/carga-masiva' && item.href.split('/').length < pathname.split('/').length) )}
            className={cn(
              'w-full justify-start',
               (pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href) && item.href.split('/').length === pathname.split('/').length || (pathname.startsWith(item.href) && item.href !== '/analisis' && item.href !== '/analisis/panel-jerarquico' && item.href !== '/configuracion/carga-masiva' && item.href.split('/').length < pathname.split('/').length) )) ? 'bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent/90' : ''
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
