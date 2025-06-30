
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
  LifeBuoy,
  MessageCircleQuestion,
  FileText,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '../ui/badge';
import { usePermissions } from '@/contexts/PermissionsContext';

interface SubNavItem {
  href: string;
  label: string;
  badge?: string;
  permission?: string;
}

interface NavItem {
  href?: string;
  label: string;
  icon: LucideIcon;
  matchPrefix?: boolean;
  subItems?: SubNavItem[];
  permission?: string;
  subItemPermissions?: string[];
}

const navItems: NavItem[] = [
    { 
        label: 'Dashboard', 
        icon: LayoutDashboard, 
        matchPrefix: true,
        href: '/dashboard',
        subItemPermissions: ['dashboard:view_resumen', 'dashboard:view_procesos', 'dashboard:view_mejoras', 'dashboard:view_auditoria', 'dashboard:view_politicas'],
        subItems: [
            { href: '/dashboard', label: 'Resumen Ejecutivo', permission: 'dashboard:view_resumen' },
            { href: '/dashboard/procesos', label: 'Procesos y Eficiencia', permission: 'dashboard:view_procesos' },
            { href: '/dashboard/mejoras', label: 'Impacto y Mejoras', permission: 'dashboard:view_mejoras' },
            { href: '/dashboard/politicas', label: 'Políticas y Cumplimiento', permission: 'dashboard:view_politicas'},
            { href: '/dashboard/auditoria', label: 'Auditoría', permission: 'dashboard:view_auditoria' },
        ]
    },
    { href: '/captura', label: 'Captura', icon: ClipboardEdit, permission: 'captura:create_process' },
    { href: '/procesos-y-flujos-registrados', label: 'Procesos Registrados', icon: Database, permission: 'procesosRegistrados:view' },
    { href: '/actividades', label: 'Actividades', icon: ListChecks, permission: 'actividades:view' },
    { href: '/politicas', label: 'Políticas', icon: FileText, permission: 'politicas:view' },
    { href: '/analisis/panel-jerarquico', label: 'Panel Jerárquico', icon: FolderTree, matchPrefix: true, permission: 'panelJerarquico:view' },
    { href: '/mejoras', label: 'Análisis IA', icon: TrendingUp, permission: 'analisis_ia:view' },
    { href: '/consulta-ia', label: 'Consulta IA', icon: MessageCircleQuestion, permission: 'consulta_ia:view' },
    { href: '/acciones', label: 'Acciones', icon: Target, permission: 'acciones:view' },
    { href: '/auditoria', label: 'Auditoría', icon: ClipboardCheck, permission: 'auditoria:view_history' },
    { 
        label: 'Configuración', 
        icon: Settings, 
        href: '/configuracion',
        matchPrefix: true,
        subItemPermissions: ['configuracion_catalogos:view', 'configuracion_cargamasiva:view'],
        subItems: [
            { href: '/configuracion', label: 'Catálogos', permission: 'configuracion_catalogos:view' },
            { href: '/configuracion/carga-masiva', label: 'Carga Masiva', permission: 'configuracion_cargamasiva:view' },
        ]
    },
    { href: '/usuarios', label: 'Usuarios', icon: Users, permission: 'usuarios:view' },
    { href: '/ayuda', label: 'Ayuda', icon: LifeBuoy, permission: 'ayuda:view' },
];


export function SidebarNav() {
  const pathname = usePathname();
  const { hasPermission, isLoadingPermissions } = usePermissions();
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>(() => {
    const open: Record<string, boolean> = {};
    navItems.forEach(item => {
        if (item.subItems && item.href && pathname.startsWith(item.href)) {
            open[item.label] = true;
        }
    });
    return open;
  });

  if (isLoadingPermissions) {
    return null; // or a loading skeleton
  }

  const toggleMenu = (label: string) => {
    setOpenMenus(prev => ({...prev, [label]: !prev[label]}));
  };

  return (
    <SidebarMenu>
      {navItems.map((item) => {
        if (item.subItems) {
            const canViewParent = item.subItemPermissions ? item.subItemPermissions.some(p => hasPermission(p)) : true;
            if (!canViewParent) return null;
            
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
                        {item.subItems.map(subItem => {
                            if (!subItem.permission || !hasPermission(subItem.permission)) return null;
                            return (
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
                            );
                        })}
                    </SidebarMenu>
                 </div>
              )}
            </SidebarMenuItem>
          );
        }

        if (!item.permission || !hasPermission(item.permission)) {
            return null;
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
