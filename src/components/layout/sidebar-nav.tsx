
'use client';

import React, { useState } from 'react';
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
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '../ui/badge';

interface SubNavItem {
  href: string;
  label: string;
  badge?: string;
}

interface NavItem {
  href?: string;
  label: string;
  icon: LucideIcon;
  matchPrefix?: boolean;
  subItems?: SubNavItem[];
}

const navItems: NavItem[] = [
    { 
        label: 'Dashboard', 
        icon: LayoutDashboard, 
        matchPrefix: true,
        href: '/dashboard',
        subItems: [
            { href: '/dashboard', label: 'Resumen Ejecutivo' },
            { href: '/dashboard/procesos', label: 'Procesos y Eficiencia' },
            { href: '/dashboard/mejoras', label: 'Impacto y Mejoras' },
            { href: '/dashboard/auditoria', label: 'Cumplimiento y Auditoría' },
        ]
    },
    { href: '/captura', label: 'Captura', icon: ClipboardEdit },
    { href: '/procesos-y-flujos-registrados', label: 'Procesos Registrados', icon: Database },
    { href: '/actividades', label: 'Actividades', icon: ListChecks },
    { href: '/analisis/panel-jerarquico', label: 'Panel Jerárquico', icon: FolderTree, matchPrefix: true },
    { href: '/mejoras', label: 'Análisis IA', icon: TrendingUp },
    { href: '/acciones', label: 'Acciones', icon: Target },
    { href: '/auditoria', label: 'Auditoría', icon: ClipboardCheck },
    { 
        label: 'Configuración', 
        icon: Settings, 
        href: '/configuracion',
        matchPrefix: true,
        subItems: [
            { href: '/configuracion', label: 'Catálogos' },
            { href: '/configuracion/carga-masiva', label: 'Carga Masiva' },
        ]
    },
    { href: '/usuarios', label: 'Usuarios', icon: Users },
];


export function SidebarNav() {
  const pathname = usePathname();
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>(() => {
    const open: Record<string, boolean> = {};
    navItems.forEach(item => {
        if (item.subItems && item.href && pathname.startsWith(item.href)) {
            open[item.label] = true;
        }
    });
    return open;
  });

  const toggleMenu = (label: string) => {
    setOpenMenus(prev => ({...prev, [label]: !prev[label]}));
  };

  return (
    <SidebarMenu>
      {navItems.map((item) => {
        if (item.subItems) {
            const isOpen = openMenus[item.label] || false;
            const isParentActive = item.href && pathname.startsWith(item.href);

          return (
            <SidebarMenuItem key={item.label} className="flex-col items-start">
              <SidebarMenuButton
                onClick={() => toggleMenu(item.label)}
                className={cn('w-full', isParentActive && !isOpen && 'bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent/90')}
                tooltip={{ children: item.label, side: "right", align: "center" }}
              >
                <item.icon className="h-5 w-5" />
                <span className="flex-grow group-data-[collapsible=icon]:hidden">{item.label}</span>
                {item.badge && <Badge variant="secondary" className="group-data-[collapsible=icon]:hidden">{item.badge}</Badge>}
                <ChevronRight className={cn("h-4 w-4 transition-transform group-data-[collapsible=icon]:hidden", isOpen && "rotate-90")} />
              </SidebarMenuButton>
              {isOpen && (
                 <div className="w-full pl-4 pt-1 group-data-[collapsible=icon]:hidden">
                    <SidebarMenu>
                        {item.subItems.map(subItem => (
                            <SidebarMenuItem key={subItem.href}>
                                <SidebarMenuButton
                                    asChild
                                    isActive={pathname === subItem.href}
                                    className={cn('w-full justify-start text-xs', pathname === subItem.href ? 'bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent/90' : '')}
                                >
                                    <Link href={subItem.href}>
                                    <span className="ml-5">{subItem.label}</span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                 </div>
              )}
            </SidebarMenuItem>
          );
        }

        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              asChild
              isActive={pathname === item.href}
              className={cn('w-full justify-start', pathname === item.href ? 'bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent/90' : '')}
              tooltip={{ children: item.label, side: "right", align: "center" }}
            >
              <Link href={item.href!}>
                <item.icon className="h-5 w-5" />
                <span className="flex-grow group-data-[collapsible=icon]:hidden">{item.label}</span>
                {item.badge && <Badge variant="secondary" className="group-data-[collapsible=icon]:hidden">{item.badge}</Badge>}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}
