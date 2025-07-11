
'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from './AuthContext';
import type { UserRole } from '@/app/(app)/usuarios/page';
import { db } from '@/lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';

type PermissionsMap = Record<string, boolean>;

interface PermissionsContextType {
  hasPermission: (permissionKey: string) => boolean;
  userPermissions: PermissionsMap;
  isLoadingPermissions: boolean;
  rolePermissions: Record<UserRole, PermissionsMap>;
  setRolePermissions: React.Dispatch<React.SetStateAction<Record<UserRole, PermissionsMap>>>;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export const PERMISSION_CONFIG = {
  dashboard: {
    label: 'Dashboards',
    permissions: {
      view_resumen: 'Ver Resumen Ejecutivo',
      view_procesos: 'Ver Dash. Procesos',
      view_mejoras: 'Ver Dash. Mejoras',
      view_sistemas: 'Ver Dash. Sistemas y Costos',
      view_auditoria: 'Ver Dash. Auditoría',
      view_politicas: 'Ver Dash. Políticas',
    },
  },
  captura: {
    label: 'Captura de Procesos',
    permissions: {
      create_process: 'Iniciar Nueva Captura de Proceso',
    },
  },
  procesosRegistrados: {
    label: 'Procesos Registrados',
    permissions: {
      view: 'Ver Lista de Procesos',
      edit: 'Editar Procesos',
      toggle_status: 'Activar/Inactivar Procesos',
      delete: 'Eliminar Procesos',
      recalculate: 'Recalcular Totales de Proceso',
      export: 'Exportar CSV de Procesos',
      view_history: 'Ver Historial de Cambios de Proceso',
    },
  },
  procedimientos: {
    label: 'Procedimientos',
    permissions: {
      view: 'Ver Lista de Procedimientos',
      create: 'Crear Procedimientos',
      edit: 'Editar Procedimientos',
      delete: 'Eliminar Procedimientos',
      recalculate: 'Recalcular Totales de Procedimiento',
    },
  },
  actividades: {
    label: 'Actividades',
    permissions: {
      view: 'Ver Lista de Actividades',
      create: 'Crear Actividades',
      edit: 'Editar Actividades',
      toggle_status: 'Activar/Inactivar Actividades',
      delete: 'Eliminar Actividades',
      export: 'Exportar CSV de Actividades',
      view_history: 'Ver Historial de Cambios de Actividad',
    },
  },
  politicas: {
    label: 'Políticas',
    permissions: {
      view: 'Ver Políticas',
      create: 'Crear/Editar Políticas',
      delete: 'Eliminar Políticas',
      manage_status: 'Gestionar Estados (Aprobar, Archivar)',
    },
  },
  panelJerarquico: {
    label: 'Panel Jerárquico',
    permissions: {
      view: 'Ver Panel',
      manage_flows: 'Gestionar Flujos (Drag & Drop)',
      reassign_puesto: 'Reasignar Puesto a Actividad',
      export: 'Exportar Vista a CSV',
      view_details: 'Ver Detalles de Elementos',
    },
  },
  analisis_ia: {
    label: 'Análisis IA (Oportunidades)',
    permissions: {
      view: 'Ver Página de Análisis',
      analyze: 'Ejecutar Análisis con IA',
      generate_actions: 'Generar Acciones Propuestas desde IA',
    },
  },
  consulta_ia: {
    label: 'Consulta IA',
    permissions: {
      view: 'Ver y Usar Chat de IA',
    },
  },
  acciones: {
    label: 'Acciones de Mejora',
    permissions: {
      view: 'Ver Acciones',
      create: 'Crear Acciones',
      edit: 'Editar Acciones',
      delete: 'Eliminar Acciones',
      export: 'Exportar CSV de Acciones',
      view_history: 'Ver Historial de Cambios de Acción',
    },
  },
  auditoria: {
    label: 'Auditoría y Cumplimiento',
    permissions: {
      view_history: 'Ver Historial de Auditorías',
      perform: 'Realizar Nuevas Auditorías',
      delete: 'Eliminar Auditorías',
      view_log: 'Ver Registro de Actividad del Sistema',
    },
  },
  configuracion_catalogos: {
    label: 'Configuración - Catálogos',
    permissions: {
      view: 'Ver Página de Catálogos',
      manage_areas: 'Gestionar Áreas',
      manage_deptos: 'Gestionar Departamentos',
      manage_puestos: 'Gestionar Puestos',
      manage_sistemas: 'Gestionar Sistemas y Costos',
    },
  },
  configuracion_cargamasiva: {
    label: 'Configuración - Carga Masiva',
    permissions: {
      view: 'Ver Página de Carga Masiva',
      execute: 'Ejecutar Cargas Masivas',
    },
  },
  usuarios: {
    label: 'Gestión de Usuarios',
    permissions: {
      view: 'Ver Lista de Usuarios',
      edit: 'Editar Usuarios',
      manage_permissions: 'Gestionar Permisos de Roles',
    },
  },
  excepciones: {
    label: 'Excepciones de Acceso',
    permissions: {
      view: 'Ver Excepciones',
      create: 'Crear Excepciones',
      delete: 'Eliminar Excepciones',
    },
  },
  ayuda: {
    label: 'Ayuda',
    permissions: {
      view: 'Ver Módulo de Ayuda',
    },
  },
};

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [rolePermissions, setRolePermissions] = useState<Record<UserRole, PermissionsMap>>({} as any);
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(true);

  useEffect(() => {
    const q = collection(db, 'permissions');
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const permsFromDb: Record<string, PermissionsMap> = {};
        snapshot.forEach(doc => {
            permsFromDb[doc.id] = doc.data() as PermissionsMap;
        });
        setRolePermissions(permsFromDb as Record<UserRole, PermissionsMap>);
        setIsLoadingPermissions(false);
    }, (error) => {
        console.error("Error fetching permissions from Firestore:", error);
        toast({
            title: "Error de Permisos",
            description: "No se pudieron cargar las configuraciones de roles. Se usarán permisos por defecto.",
            variant: "destructive"
        });
        setIsLoadingPermissions(false);
    });

    return () => unsubscribe();
  }, []);


  const userPermissions = useMemo(() => {
    if (!user || isLoadingPermissions) {
      return {};
    }
    // Administrator has all permissions implicitly
    if (user.rol === 'Administrador') {
      return new Proxy({}, { get: () => true });
    }
    return rolePermissions[user.rol] || {};
  }, [user, rolePermissions, isLoadingPermissions]);

  const hasPermission = useCallback((permissionKey: string): boolean => {
    if (isLoadingPermissions || !user) {
      return false;
    }
    return !!userPermissions[permissionKey];
  }, [userPermissions, isLoadingPermissions, user]);

  return (
    <PermissionsContext.Provider value={{ hasPermission, userPermissions, isLoadingPermissions, rolePermissions, setRolePermissions }}>
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
