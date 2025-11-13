
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, ShieldCheck, ShieldQuestion } from "lucide-react";
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { collection, onSnapshot, doc, updateDoc, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';

import { usePermissions } from '@/contexts/PermissionsContext';
import UserManagementTab from '@/components/user-management/UserManagementTab';
import PermissionsTab from '@/components/user-management/PermissionsTab';
import ExceptionsTab from '@/components/user-management/ExceptionsTab';
import { usePuestos } from '@/contexts/PuestosContext';
import { useActivityLog } from '@/contexts/ActivityLogContext';
import { useAuth } from '@/contexts/AuthContext';
import { useExceptions, type AccessException } from '@/contexts/ExceptionsContext';
import { useProcesos } from '@/contexts/ProcesosContext';
import { usePoliticas } from '@/contexts/PoliticasContext';
import { toast } from '@/hooks/use-toast';
import type { UserRole, NivelAcceso } from '@/app/(app)/usuarios/page';

interface User {
  id: string;
  nombreCompleto: string;
  email: string;
  rol: UserRole;
  nivelAcceso: NivelAcceso;
  activo: boolean;
  puestoId?: string;
  claimsVersion?: number;
}

const userFormSchema = z.object({
  id: z.string().optional(),
  nombreCompleto: z.string().min(3, 'El nombre completo debe tener al menos 3 caracteres.').max(60, 'El nombre no puede exceder 60 caracteres.').regex(/^[a-zA-ZÀ-ÿ\u00f1\u00d1\s]+$/, 'El nombre solo puede contener letras y espacios.'),
  email: z.string().email('Ingrese un correo electrónico válido.'),
  rol: z.enum(["Administrador", "Gerente de Proyecto", "Consultor", "Usuario Final"], { errorMap: () => ({ message: "Seleccione un rol válido." }) }),
  nivelAcceso: z.enum(["Público", "Departamental", "Jerárquico", "Ejecutivo", "Confidencial"], { errorMap: () => ({ message: "Seleccione un nivel de acceso." }) }),
  puestoId: z.string().optional(),
  activo: z.boolean().default(true),
});
type UserFormData = z.infer<typeof userFormSchema>;

const exceptionFormSchema = z.object({
  userId: z.string({ required_error: 'Debe seleccionar un usuario.' }),
  documentType: z.enum(['politica', 'proceso'], { required_error: 'Debe seleccionar un tipo de documento.' }),
  documentId: z.string({ required_error: 'Debe seleccionar un documento.' }),
  exceptionType: z.enum(['INCLUDE', 'EXCLUDE'], { required_error: 'Debe seleccionar un tipo de excepción.' }),
  expiresAt: z.date().optional(),
  justification: z.string().min(10, 'La justificación es requerida (mínimo 10 caracteres).').max(1000, 'La justificación no puede exceder 1000 caracteres.'),
});
type ExceptionFormData = z.infer<typeof exceptionFormSchema>;

type AccessExceptionCreationData = Omit<AccessException, 'id' | 'createdAt' | 'createdBy'>;


const ITEMS_PER_PAGE = 10;

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
  const { user: currentUser } = useAuth();
  const { hasPermission, rolePermissions, setRolePermissions, isLoadingPermissions } = usePermissions();
  
  const [selectedRoleForPerms, setSelectedRoleForPerms] = useState<UserRole>('Gerente de Proyecto');

  // Exception management states
  const { exceptions, addException, deleteException, isLoadingExceptions } = useExceptions();
  const { procesos, isLoadingProcesos } = useProcesos();
  const { politicas, isLoadingPoliticas } = usePoliticas();
  const [isExceptionDialogOpen, setIsExceptionDialogOpen] = useState(false);
  const [exceptionToDelete, setExceptionToDelete] = useState<AccessException | null>(null);
  const [isConfirmDeleteExceptionOpen, setIsConfirmDeleteExceptionOpen] = useState(false);

  // 🔐 NUEVOS ESTADOS PARA VALIDACIÓN DE SEGURIDAD
  const [isSecurityDialogOpen, setIsSecurityDialogOpen] = useState(false);
  const [pendingUserUpdate, setPendingUserUpdate] = useState<UserFormData | null>(null);
  const [securityValidation, setSecurityValidation] = useState({
    isLastAdmin: false,
    isCriticalChange: false,
    isSelfModification: false,
    currentUserRole: '',
    targetUserRole: ''
  });
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [isValidatingPassword, setIsValidatingPassword] = useState(false);

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

  const userForm = useForm<UserFormData>({
    resolver: zodResolver(userFormSchema),
    defaultValues: { nombreCompleto: '', email: '', rol: undefined, nivelAcceso: 'Público', activo: true, puestoId: undefined },
  });

  const exceptionForm = useForm<ExceptionFormData>({
    resolver: zodResolver(exceptionFormSchema),
  });

  const watchedDocType = exceptionForm.watch('documentType');

  const availableDocuments = useMemo(() => {
    if (watchedDocType === 'politica') {
      return politicas.map(p => ({ id: p.id, name: `${p.codigo} - ${p.titulo}` }));
    }
    if (watchedDocType === 'proceso') {
      return procesos.filter(p => !p.deletedAt).map(p => ({ id: p.id, name: p.proceso }));
    }
    return [];
  }, [watchedDocType, politicas, procesos]);

  useEffect(() => {
    exceptionForm.reset({ ...exceptionForm.getValues(), documentId: undefined });
  }, [watchedDocType, exceptionForm]);

  useEffect(() => {
    if (isUserDialogOpen && editingUser) {
      userForm.reset(editingUser);
    }
  }, [editingUser, isUserDialogOpen, userForm]);

  // 🔐 FUNCIÓN DE VALIDACIÓN DE SEGURIDAD
  function validateSecurityChanges(data: UserFormData, editingUser: User): boolean {
    if (!editingUser || !currentUser) return false;
    
    const adminCount = users.filter(u => u.rol === 'Administrador' && u.activo).length;
    const isLastAdmin = editingUser.rol === 'Administrador' && 
                        data.rol !== 'Administrador' && 
                        adminCount <= 1;

    const isCriticalChange = (editingUser.rol === 'Administrador' && data.rol !== 'Administrador') ||
                            (editingUser.rol !== 'Administrador' && data.rol === 'Administrador');

    const isSelfModification = editingUser.id === currentUser?.id;

    if (isLastAdmin) {
      toast({
        title: "⛔ Operación Bloqueada",
        description: "No se puede degradar el último administrador del sistema. Debe crear otro administrador primero.",
        variant: "destructive",
      });
      return false; // Bloquea la operación
    }

    if (isCriticalChange || isSelfModification) {
        setSecurityValidation({
          isLastAdmin,
          isCriticalChange,
          isSelfModification,
          currentUserRole: editingUser.rol,
          targetUserRole: data.rol
        });
        setPendingUserUpdate(data);
        setIsSecurityDialogOpen(true);
        return false; // Espera confirmación
    }

    return true; // Procede directamente
  }

  // 🔐 FUNCIÓN DE VALIDACIÓN DE CONTRASEÑA
  async function validatePasswordForCriticalChange(): Promise<boolean> {
    if (!passwordConfirmation || !currentUser?.email) {
      toast({
        title: "⚠️ Contraseña Requerida",
        description: "Debe ingresar su contraseña actual para confirmar este cambio crítico.",
        variant: "destructive",
      });
      return false;
    }

    setIsValidatingPassword(true);
    
    try {
      // Reautenticar para validar la contraseña
      const { ReauthenticateWithCredential, EmailAuthProvider } = await import('firebase/auth');
      const { auth } = await import('@/lib/firebase');
      
      const credential = EmailAuthProvider.credential(currentUser.email, passwordConfirmation);
      if (auth.currentUser) {
          await ReauthenticateWithCredential(auth.currentUser, credential);
      } else {
          throw new Error("No hay usuario actual para reautenticar");
      }
      
      setIsValidatingPassword(false);
      return true;
    } catch (error: any) {
      setIsValidatingPassword(false);
      toast({
        title: "❌ Contraseña Incorrecta",
        description: "La contraseña ingresada no es correcta. No se realizaron cambios.",
        variant: "destructive",
      });
      return false;
    }
  }

  // 🔐 FUNCIÓN PARA PROCEDER CON CAMBIO DESPUÉS DE VALIDACIONES
  async function proceedWithSecureChange() {
    if (!pendingUserUpdate || !editingUser) return;

    if (securityValidation.isCriticalChange) {
      const passwordValid = await validatePasswordForCriticalChange();
      if (!passwordValid) return;
    }

    await executeUserUpdate(pendingUserUpdate);
    
    setIsSecurityDialogOpen(false);
    setPendingUserUpdate(null);
    setPasswordConfirmation('');
  }

  // 🔐 FUNCIÓN EJECUTORA
  async function executeUserUpdate(data: UserFormData) {
    if (!editingUser || !hasPermission('usuarios:edit')) return;
    
    try {
      const functions = getFunctions();
      const setUserRole = httpsCallable(functions, 'setUserRole');
      const result = await setUserRole({
        userId: editingUser.id,
        rol: data.rol,
        nivelAcceso: data.nivelAcceso,
        puestoId: data.puestoId || null,
      });

      const { claimsVersion } = (result.data as any);

      // Actualizar nombre y estado en Firestore
      const userDocRef = doc(db, "users", editingUser.id);
      
      const updatePayload: any = {
        nombreCompleto: data.nombreCompleto,
        activo: data.activo,
        puestoId: data.puestoId || null,
        rol: data.rol,
        nivelAcceso: data.nivelAcceso,
      };

      if (claimsVersion !== undefined) {
        updatePayload.claimsVersion = claimsVersion;
      }

      await updateDoc(userDocRef, updatePayload);

      let successMessage = `Los permisos para ${data.nombreCompleto} han sido actualizados.`;
      
      if (securityValidation.isSelfModification) {
        successMessage += " ⚠️ Ha modificado sus propios permisos. El cambio se aplicará en su próximo inicio de sesión.";
      }
      
      if (securityValidation.isCriticalChange) {
        successMessage += " 🔐 Cambio crítico de seguridad registrado.";
      }

      toast({
        title: '✅ Usuario Actualizado',
        description: successMessage,
      });

      addLogEntry({ action: 'update', entityType: 'Usuario', entityName: data.nombreCompleto, details: `Permisos de "${data.nombreCompleto}" actualizados a Rol: ${data.rol}, Nivel: ${data.nivelAcceso}.` });

    } catch (error: any) {
      console.error("Error setting user role via function:", error.message);
      toast({
        title: "❌ Error de Permisos",
        description: error.message || "No se pudo actualizar el rol del usuario.",
        variant: "destructive"
      });
    }
    
    setEditingUser(null);
    setIsUserDialogOpen(false);
  }

  // 🔐 FUNCIÓN handleUserSubmit MODIFICADA CON VALIDACIONES DE SEGURIDAD
  async function handleUserSubmit(data: UserFormData) {
    if (!editingUser || !hasPermission('usuarios:edit')) return;
    
    const canProceedDirectly = validateSecurityChanges(data, editingUser);
    
    if (canProceedDirectly) {
      await executeUserUpdate(data);
    }
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

  const handleSavePermissions = async () => {
    if (!rolePermissions[selectedRoleForPerms]) {
      toast({ title: "Error", description: `No hay permisos definidos para el rol ${selectedRoleForPerms}`, variant: "destructive"});
      return;
    }
    try {
        const roleDocRef = doc(db, 'permissions', selectedRoleForPerms);
        await setDoc(roleDocRef, rolePermissions[selectedRoleForPerms]);
        toast({
          title: 'Permisos Guardados',
          description: `Los permisos para el rol '${selectedRoleForPerms}' han sido actualizados en la base de datos.`,
        });
        addLogEntry({ action: 'update', entityType: 'Permisos de Rol', entityName: selectedRoleForPerms, details: `Se actualizaron los permisos para el rol "${selectedRoleForPerms}".` });
    } catch (e) {
        console.error("Error saving permissions to Firestore:", e);
        toast({ title: "Error al Guardar", description: "No se pudieron guardar los permisos en la base de datos.", variant: "destructive"});
    }
  };

  async function handleExceptionSubmit(data: ExceptionFormData) {
    const payload: AccessExceptionCreationData = {
        ...data,
        expiresAt: data.expiresAt ? data.expiresAt.toISOString() : undefined,
    };
    await addException(payload);
    setIsExceptionDialogOpen(false);
    exceptionForm.reset();
  }

  function promptDeleteException(exception: AccessException) {
    setExceptionToDelete(exception);
    setIsConfirmDeleteExceptionOpen(true);
  }

  function executeDeleteException() {
    if (!exceptionToDelete) return;
    deleteException(exceptionToDelete.id);
    setExceptionToDelete(null);
    setIsConfirmDeleteExceptionOpen(false);
  }

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
            <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
              <TabsTrigger value="users">Gestión de Usuarios</TabsTrigger>
              {hasPermission('usuarios:manage_permissions') && (
                <TabsTrigger value="permissions"><ShieldCheck className="mr-2 h-4 w-4"/>Roles y Permisos</TabsTrigger>
              )}
               {hasPermission('excepciones:view') && (
                <TabsTrigger value="exceptions"><ShieldQuestion className="mr-2 h-4 w-4"/>Excepciones</TabsTrigger>
              )}
            </TabsList>
            
            <TabsContent value="users" className="mt-4">
              <UserManagementTab />
            </TabsContent>

            <TabsContent value="permissions" className="mt-4">
              {hasPermission('usuarios:manage_permissions') ? (
                <PermissionsTab />
              ) : (
                <div className="text-center text-muted-foreground p-8">No tiene permiso para gestionar roles y permisos.</div>
              )}
            </TabsContent>
            
            <TabsContent value="exceptions" className="mt-4">
               {hasPermission('excepciones:view') ? (
                  <ExceptionsTab />
               ) : (
                  <div className="text-center text-muted-foreground p-8">No tiene permiso para gestionar excepciones de acceso.</div>
               )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
