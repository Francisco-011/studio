
'use client';

import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { collection, onSnapshot, doc, updateDoc, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';

import { Button, buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from '@/hooks/use-toast';
import { Users, Search, Edit2, ShieldCheck, Save, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useActivityLog } from '@/contexts/ActivityLogContext';
import { usePuestos, type Puesto } from '@/contexts/PuestosContext';
import { usePermissions } from '@/contexts/PermissionsContext';


const userRoles = ["Administrador", "Gerente de Proyecto", "Consultor", "Usuario Final"] as const;
export type UserRole = typeof userRoles[number];

const nivelesAcceso = ["Público", "Departamental", "Jerárquico", "Ejecutivo", "Confidencial"] as const;
export type NivelAcceso = typeof nivelesAcceso[number];

export interface User {
  id: string; // This is the UID from Firebase Auth
  nombreCompleto: string;
  email: string;
  rol: UserRole;
  nivelAcceso: NivelAcceso;
  activo: boolean;
  puestoId?: string;
}

const userFormSchema = z.object({
  id: z.string().optional(),
  nombreCompleto: z.string().min(3, 'El nombre completo debe tener al menos 3 caracteres.'),
  email: z.string().email('Ingrese un correo electrónico válido.'),
  rol: z.enum(userRoles, { errorMap: () => ({ message: "Seleccione un rol válido."})}),
  nivelAcceso: z.enum(nivelesAcceso, { errorMap: () => ({ message: "Seleccione un nivel de acceso." })}),
  puestoId: z.string().optional(),
  activo: z.boolean().default(true),
});
type UserFormData = z.infer<typeof userFormSchema>;

const ITEMS_PER_PAGE = 10;
const LOCAL_STORAGE_PERMISSIONS_KEY = 'proceza-role-permissions';

const PERMISSION_CONFIG = {
  dashboard: {
    label: 'Dashboards',
    permissions: {
      view_resumen: 'Ver Resumen Ejecutivo',
      view_procesos: 'Ver Dash. Procesos',
      view_mejoras: 'Ver Dash. Mejoras',
      view_auditoria: 'Ver Dash. Auditoría',
      view_politicas: 'Ver Dash. Políticas',
    },
  },
  captura: {
    label: 'Captura de Procesos',
    permissions: {
      create_process: 'Iniciar Nueva Captura de Proceso',
      define_activities: 'Definir/Editar Actividades de Proceso',
    },
  },
  procesosRegistrados: {
    label: 'Procesos Registrados',
    permissions: {
      view: 'Ver Lista de Procesos',
      edit: 'Editar Procesos',
      toggle_status: 'Activar/Inactivar Procesos',
      delete: 'Eliminar Procesos',
      restore: 'Recuperar Procesos Eliminados',
      export: 'Exportar CSV de Procesos',
      view_history: 'Ver Historial de Cambios de Proceso',
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
      restore: 'Recuperar Actividades Eliminadas',
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
    },
  },
  panelJerarquico: {
    label: 'Panel Jerárquico',
    permissions: {
      view: 'Ver Panel',
      manage_flows: 'Gestionar Flujos (Drag & Drop)',
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
  ayuda: {
    label: 'Ayuda',
    permissions: {
      view: 'Ver Módulo de Ayuda',
    },
  },
};
type ModuleKey = keyof typeof PERMISSION_CONFIG;

// Default permissions state
const initialRolePermissions: Record<UserRole, Record<string, boolean>> = {
  Administrador: Object.keys(PERMISSION_CONFIG).reduce((acc, mod) => ({ ...acc, ...Object.fromEntries(Object.keys(PERMISSION_CONFIG[mod as ModuleKey].permissions).map(p => [`${mod}:${p}`, true])) }), {}),
  'Gerente de Proyecto': Object.keys(PERMISSION_CONFIG).reduce((acc, mod) => {
    const modulePermissions = Object.fromEntries(Object.keys(PERMISSION_CONFIG[mod as ModuleKey].permissions).map(p => [`${mod}:${p}`, true]));
    if (mod === 'configuracion_catalogos' || mod === 'configuracion_cargamasiva' || mod === 'usuarios') {
        Object.keys(modulePermissions).forEach(key => {
            if (!key.endsWith(':view')) {
                modulePermissions[key] = false;
            }
        });
    }
    if (mod === 'usuarios') modulePermissions[`${mod}:manage_permissions`] = false;
    if (mod === 'auditoria') modulePermissions[`${mod}:delete`] = false;
    return { ...acc, ...modulePermissions };
  }, {}),
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


export default function UsuariosPage() {
  const [users, setUsers] = useState<User[]>([]);
  const { puestos, isLoadingPuestos } = usePuestos();
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const { addLogEntry } = useActivityLog();
  const { hasPermission } = usePermissions();
  
  const [rolePermissions, setRolePermissions] = useState<Record<UserRole, Record<string, boolean>>>(initialRolePermissions);
  const [selectedRoleForPerms, setSelectedRoleForPerms] = useState<UserRole>('Administrador');
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(true);

  useEffect(() => {
    setIsLoadingUsers(true);
    const q = query(collection(db, "users"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const usersData = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as User));
        setUsers(usersData);
        setIsLoadingUsers(false);
    }, (error) => {
        console.error("Error fetching users: ", error);
        toast({ title: "Error", description: "No se pudieron cargar los usuarios.", variant: "destructive" });
        setIsLoadingUsers(false);
    });

    return () => unsubscribe();
  }, []);


  useEffect(() => {
    try {
      const savedPermissions = localStorage.getItem(LOCAL_STORAGE_PERMISSIONS_KEY);
      if (savedPermissions) {
        setRolePermissions(JSON.parse(savedPermissions));
      }
    } catch (e) {
      console.error("Error loading permissions from localStorage", e);
    } finally {
      setIsLoadingPermissions(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoadingPermissions) {
      localStorage.setItem(LOCAL_STORAGE_PERMISSIONS_KEY, JSON.stringify(rolePermissions));
    }
  }, [rolePermissions, isLoadingPermissions]);


  const userForm = useForm<UserFormData>({
    resolver: zodResolver(userFormSchema),
    defaultValues: { nombreCompleto: '', email: '', rol: undefined, nivelAcceso: 'Público', activo: true, puestoId: undefined },
  });

  useEffect(() => {
    if (isUserDialogOpen && editingUser) {
      userForm.reset(editingUser);
    }
  }, [editingUser, isUserDialogOpen, userForm]);

  async function handleUserSubmit(data: UserFormData) {
    if (!editingUser || !hasPermission('usuarios:edit')) return;
    
    const userDocRef = doc(db, "users", editingUser.id);
    try {
        await updateDoc(userDocRef, {
            nombreCompleto: data.nombreCompleto,
            rol: data.rol,
            nivelAcceso: data.nivelAcceso,
            activo: data.activo,
            puestoId: data.puestoId || null,
        });
        toast({ title: 'Usuario Actualizado', description: 'Los datos del usuario han sido actualizados.' });
        addLogEntry({ action: 'update', entityType: 'Usuario', entityName: data.nombreCompleto, details: `Se actualizó el perfil del usuario "${data.nombreCompleto}".` });
    } catch (error) {
        console.error("Error updating user:", error);
        toast({ title: "Error", description: "No se pudo actualizar el usuario.", variant: "destructive"});
    }
    
    setEditingUser(null);
    setIsUserDialogOpen(false);
  }

  function handleEditUser(user: User) {
    setEditingUser(user);
    setIsUserDialogOpen(true);
  }

  async function handleToggleUserStatus(userToToggle: User) {
    const userDocRef = doc(db, "users", userToToggle.id);
    const newStatus = !userToToggle.activo;
    try {
      await updateDoc(userDocRef, { activo: newStatus });
       toast({
        title: `Usuario ${newStatus ? 'Activado' : 'Desactivado'}`,
        description: `El usuario "${userToToggle.nombreCompleto}" ha sido ${newStatus ? 'activado' : 'desactivado'}.`,
      });
      addLogEntry({ action: 'status_change', entityType: 'Usuario', entityName: userToToggle.nombreCompleto, details: `Estado del usuario "${userToToggle.nombreCompleto}" cambiado a ${newStatus ? 'Activo' : 'Inactivo'}.` });
    } catch (error) {
      console.error("Error toggling user status:", error);
      toast({ title: "Error", description: "No se pudo cambiar el estado del usuario.", variant: "destructive" });
    }
  }

  const filteredUsers = useMemo(() => {
    setCurrentPage(1); // Reset page on filter change
    return users.filter(user => {
      const matchesSearchTerm = user.nombreCompleto.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                user.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = roleFilter === 'all' || user.rol === roleFilter;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && user.activo) ||
        (statusFilter === 'inactive' && !user.activo);
      return matchesSearchTerm && matchesRole && matchesStatus;
    });
  }, [users, searchTerm, roleFilter, statusFilter]);

  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
  const paginatedUsers = useMemo(() => {
    return filteredUsers.slice(
      (currentPage - 1) * ITEMS_PER_PAGE,
      currentPage * ITEMS_PER_PAGE
    );
  }, [filteredUsers, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    } else if (currentPage !== 1 && totalPages === 0 && filteredUsers.length > 0) {
       setCurrentPage(1);
    }
  }, [currentPage, totalPages, filteredUsers.length]);

  const handlePermissionChange = (moduleKey: string, permissionKey: string, checked: boolean) => {
    setRolePermissions(prev => ({
      ...prev,
      [selectedRoleForPerms]: {
        ...prev[selectedRoleForPerms],
        [`${moduleKey}:${permissionKey}`]: checked,
      },
    }));
  };

  const handleSavePermissions = () => {
    toast({
      title: 'Permisos Guardados',
      description: `Los permisos para el rol '${selectedRoleForPerms}' han sido actualizados.`,
    });
    addLogEntry({ action: 'update', entityType: 'Permisos de Rol', entityName: selectedRoleForPerms, details: `Se actualizaron los permisos para el rol "${selectedRoleForPerms}".` });
  };


  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl font-headline">Gestión de Usuarios y Permisos</CardTitle>
          </div>
          <CardDescription className="text-muted-foreground">
            Administra las cuentas de usuario, sus roles y los permisos de acceso dentro del sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="users" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="users">Gestión de Usuarios</TabsTrigger>
              {hasPermission('usuarios:manage_permissions') && (
                <TabsTrigger value="permissions"><ShieldCheck className="mr-2 h-4 w-4"/>Roles y Permisos</TabsTrigger>
              )}
            </TabsList>
            
            <TabsContent value="users" className="mt-4">
              <div className="mb-6 space-y-4 md:flex md:items-end md:justify-between md:space-y-0 md:space-x-4">
                <div className="relative flex-1 md:flex-grow">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Buscar por nombre o email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10"
                  />
                </div>
                <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-2">
                  <Select
                    value={roleFilter}
                    onValueChange={(value: UserRole | 'all') => setRoleFilter(value)}
                  >
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="Filtrar por rol" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los roles</SelectItem>
                      {userRoles.map(role => (
                        <SelectItem key={role} value={role}>{role}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={statusFilter}
                    onValueChange={(value: 'all' | 'active' | 'inactive') => setStatusFilter(value)}
                  >
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="Filtrar por estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los estados</SelectItem>
                      <SelectItem value="active">Activos</SelectItem>
                      <SelectItem value="inactive">Inactivos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {isLoadingUsers ? (<div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>) :
              paginatedUsers.length > 0 ? (
                <>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre Completo</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Puesto</TableHead>
                        <TableHead>Rol</TableHead>
                        <TableHead>Nivel Acceso</TableHead>
                        <TableHead className="w-[120px] text-center">Estado</TableHead>
                        <TableHead className="text-right w-[140px]">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.nombreCompleto}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{puestos.find(p => p.id === user.puestoId)?.nombre || 'No asignado'}</TableCell>
                          <TableCell><Badge variant="outline">{user.rol}</Badge></TableCell>
                          <TableCell><Badge variant="secondary">{user.nivelAcceso}</Badge></TableCell>
                          <TableCell className="text-center">
                            <Badge variant={user.activo ? 'default' : 'outline'}>
                              {user.activo ? 'Activo' : 'Inactivo'}
                            </Badge>
                          </TableCell>
                           <TableCell className="text-right space-x-1">
                            {hasPermission('usuarios:edit') && (
                              <>
                                <Switch
                                  checked={user.activo}
                                  onCheckedChange={() => handleToggleUserStatus(user)}
                                  aria-label={user.activo ? 'Desactivar usuario' : 'Activar usuario'}
                                  className="mr-2"
                                />
                                <Button variant="ghost" size="icon" onClick={() => handleEditUser(user)} className="mr-1">
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex items-center justify-between space-x-2 py-4">
                  <span className="text-sm text-muted-foreground">
                    Página {currentPage} de {totalPages} (Total: {filteredUsers.length} usuarios)
                  </span>
                  <div className="space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages || totalPages === 0}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
                </>
              ) : (
                <div className="mt-6 p-8 border border-dashed border-border rounded-lg flex flex-col items-center justify-center min-h-[200px] bg-muted/20">
                  <Users className="h-16 w-16 text-muted-foreground mb-4" />
                  <p className="text-lg font-semibold text-foreground">No se encontraron usuarios</p>
                  <p className="text-sm text-muted-foreground text-center">
                    {searchTerm || roleFilter !== 'all' || statusFilter !== 'all' ? 'Ajuste los filtros o ' : ''}
                    Los usuarios se registran a través de la página de Signup.
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="permissions" className="mt-4">
              {hasPermission('usuarios:manage_permissions') ? (
                <>
                  <CardDescription className="mb-4">
                    Seleccione un rol para ver y modificar los permisos asociados.
                  </CardDescription>
                  <div className="flex flex-col sm:flex-row sm:items-end gap-4 mb-6">
                    <div className="flex-grow">
                      <Label htmlFor="role-select">Seleccionar Rol a Editar</Label>
                      <Select value={selectedRoleForPerms} onValueChange={(value) => setSelectedRoleForPerms(value as UserRole)}>
                        <SelectTrigger id="role-select">
                          <SelectValue placeholder="Seleccione un rol..." />
                        </SelectTrigger>
                        <SelectContent>
                          {userRoles.map(role => (
                            <SelectItem key={role} value={role}>{role}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={handleSavePermissions}>
                      <Save className="mr-2 h-4 w-4" /> Guardar Permisos para este Rol
                    </Button>
                  </div>

                  {isLoadingPermissions ? (<div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>) : (
                  <Accordion type="multiple" className="w-full" defaultValue={Object.keys(PERMISSION_CONFIG)}>
                    {(Object.keys(PERMISSION_CONFIG) as ModuleKey[]).map(moduleKey => (
                      <AccordionItem value={moduleKey} key={moduleKey}>
                        <AccordionTrigger>{PERMISSION_CONFIG[moduleKey].label}</AccordionTrigger>
                        <AccordionContent>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-2">
                            {Object.entries(PERMISSION_CONFIG[moduleKey].permissions).map(([permissionKey, permissionLabel]) => (
                              <div key={`${moduleKey}-${permissionKey}`} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`${moduleKey}-${permissionKey}`}
                                  checked={rolePermissions[selectedRoleForPerms]?.[`${moduleKey}:${permissionKey}`] || false}
                                  onCheckedChange={(checked) => handlePermissionChange(moduleKey, permissionKey, !!checked)}
                                  disabled={selectedRoleForPerms === 'Administrador'}
                                />
                                <label
                                  htmlFor={`${moduleKey}-${permissionKey}`}
                                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                  {permissionLabel}
                                </label>
                              </div>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                  )}
                </>
              ) : (
                <div className="text-center text-muted-foreground p-8">No tiene permiso para gestionar roles y permisos.</div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      
      <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Usuario</DialogTitle>
            <DialogDescription>
              Modifica los detalles del usuario. El email no se puede cambiar.
            </DialogDescription>
          </DialogHeader>
          <Form {...userForm}>
            <form onSubmit={userForm.handleSubmit(handleUserSubmit)} className="space-y-4 py-4">
              <FormField
                control={userForm.control}
                name="nombreCompleto"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre Completo</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej: Juan Pérez" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={userForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Correo Electrónico</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} disabled />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={userForm.control}
                name="rol"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rol Funcional</FormLabel>
                     <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione un rol" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {userRoles.map((role) => (
                          <SelectItem key={role} value={role}>
                            {role}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={userForm.control}
                name="nivelAcceso"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nivel de Acceso a Información</FormLabel>
                     <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione un nivel" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {nivelesAcceso.map((nivel) => (
                          <SelectItem key={nivel} value={nivel}>
                            {nivel}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={userForm.control}
                name="puestoId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Puesto Asignado</FormLabel>
                     <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione un puesto" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No Asignado</SelectItem>
                        {puestos.map((puesto) => (
                          <SelectItem key={puesto.id} value={puesto.id}>
                            {puesto.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>Define la posición del usuario en la jerarquía.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={userForm.control}
                name="activo"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Estado Activo</FormLabel>
                      <FormDescription>
                        Indica si el usuario puede acceder al sistema.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline" onClick={() => { setIsUserDialogOpen(false); setEditingUser(null); }}>Cancelar</Button>
                </DialogClose>
                <Button type="submit" disabled={!hasPermission('usuarios:edit')}>Guardar Cambios</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
