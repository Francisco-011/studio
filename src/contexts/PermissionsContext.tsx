
'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from './AuthContext';
import type { UserRole } from '@/app/(app)/usuarios/page';

const LOCAL_STORAGE_PERMISSIONS_KEY = 'proceza-role-permissions';

type PermissionsMap = Record<string, boolean>;

interface PermissionsContextType {
  hasPermission: (permissionKey: string) => boolean;
  userPermissions: PermissionsMap;
  isLoadingPermissions: boolean;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

// A default permission set, mirroring the initial state from the usuarios page.
// This serves as a fallback if localStorage is cleared or not yet populated.
const defaultPermissions: Record<UserRole, Record<string, boolean>> = {
  Administrador: {}, // Handled by proxy to always be true
  'Gerente de Proyecto': {
    'dashboard:view_resumen': true, 'dashboard:view_procesos': true, 'dashboard:view_mejoras': true, 'dashboard:view_auditoria': true, 'dashboard:view_politicas': true,
    'captura:create_process': true, 'captura:define_activities': true,
    'procesosRegistrados:view': true, 'procesosRegistrados:edit': true, 'procesosRegistrados:toggle_status': true, 'procesosRegistrados:delete': true, 'procesosRegistrados:restore': true, 'procesosRegistrados:export': true, 'procesosRegistrados:view_history': true,
    'actividades:view': true, 'actividades:create': true, 'actividades:edit': true, 'actividades:toggle_status': true, 'actividades:delete': true, 'actividades:restore': true, 'actividades:export': true, 'actividades:view_history': true,
    'politicas:view': true,
    'panelJerarquico:view': true, 'panelJerarquico:manage_flows': true, 'panelJerarquico:export': true, 'panelJerarquico:view_details': true,
    'analisis_ia:view': true, 'analisis_ia:analyze': true, 'analisis_ia:generate_actions': true,
    'consulta_ia:view': true,
    'acciones:view': true, 'acciones:create': true, 'acciones:edit': true, 'acciones:delete': true, 'acciones:export': true, 'acciones:view_history': true,
    'auditoria:view_history': true, 'auditoria:perform': true, 'auditoria:view_log': true,
    'configuracion_catalogos:view': true, 'configuracion_cargamasiva:view': true,
    'usuarios:view': true, 'usuarios:edit': true,
    'ayuda:view': true,
  },
  Consultor: {
    'dashboard:view_resumen': true, 'dashboard:view_procesos': true, 'dashboard:view_mejoras': true, 'dashboard:view_auditoria': true, 'dashboard:view_politicas': true,
    'captura:create_process': true, 'captura:define_activities': true,
    'procesosRegistrados:view': true, 'procesosRegistrados:edit': true, 'procesosRegistrados:export': true, 'procesosRegistrados:view_history': true,
    'actividades:view': true, 'actividades:create': true, 'actividades:edit': true, 'actividades:export': true, 'actividades:view_history': true,
    'politicas:view': true, 'politicas:create': true,
    'panelJerarquico:view': true, 'panelJerarquico:manage_flows': true, 'panelJerarquico:export': true, 'panelJerarquico:view_details': true,
    'analisis_ia:view': true, 'analisis_ia:analyze': true, 'analisis_ia:generate_actions': true,
    'consulta_ia:view': true,
    'acciones:view': true, 'acciones:create': true, 'acciones:edit': true, 'acciones:export': true, 'acciones:view_history': true,
    'auditoria:view_history': true, 'auditoria:perform': true,
    'configuracion_catalogos:view': true,
    'ayuda:view': true,
  },
  'Usuario Final': {
    'dashboard:view_resumen': true,
    'dashboard:view_procesos': true,
    'procesosRegistrados:view': true,
    'actividades:view': true,
    'politicas:view': true,
    'panelJerarquico:view': true,
    'panelJerarquico:view_details': true,
    'consulta_ia:view': true,
    'acciones:view': true,
    'auditoria:view_history': true,
    'ayuda:view': true,
  },
};

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<Record<UserRole, PermissionsMap>>({} as any);
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedPermissions = localStorage.getItem(LOCAL_STORAGE_PERMISSIONS_KEY);
        if (savedPermissions) {
          setPermissions(JSON.parse(savedPermissions));
        } else {
          setPermissions(defaultPermissions);
        }
      } catch (e) {
        console.error("Error loading permissions from localStorage", e);
        setPermissions(defaultPermissions);
      } finally {
        setIsLoadingPermissions(false);
      }
    }
  }, []);

  const userPermissions = useMemo(() => {
    if (!user || isLoadingPermissions) {
      return {};
    }
    // Administrator has all permissions implicitly
    if (user.rol === 'Administrador') {
      return new Proxy({}, { get: () => true });
    }
    return permissions[user.rol] || {};
  }, [user, permissions, isLoadingPermissions]);

  const hasPermission = useCallback((permissionKey: string): boolean => {
    if (isLoadingPermissions || !user) {
      return false;
    }
    return !!userPermissions[permissionKey];
  }, [userPermissions, isLoadingPermissions, user]);

  return (
    <PermissionsContext.Provider value={{ hasPermission, userPermissions, isLoadingPermissions }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions(): PermissionsContextType {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
}
