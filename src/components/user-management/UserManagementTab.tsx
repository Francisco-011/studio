
'use client';

import { useState, useEffect, useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { collection, onSnapshot, doc, updateDoc, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';

import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from '@/hooks/use-toast';
import { Search, Edit2, Save, Loader2, Shield, Key, AlertTriangle } from "lucide-react";

import { ClaimsHealthDashboard } from '@/components/ClaimsHealthDashboard';
import { useActivityLog } from '@/contexts/ActivityLogContext';
import { usePuestos } from '@/contexts/PuestosContext';
import { usePermissions } from '@/contexts/PermissionsContext';
import { useAuth } from '@/contexts/AuthContext';

const userRoles = ["Administrador", "Gerente de Proyecto", "Consultor", "Usuario Final"] as const;
type UserRole = typeof userRoles[number];

const nivelesAcceso = ["Público", "Departamental", "Jerárquico", "Ejecutivo", "Confidencial"] as const;
type NivelAcceso = typeof nivelesAcceso[number];

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
  rol: z.enum(userRoles, { errorMap: () => ({ message: "Seleccione un rol válido." }) }),
  nivelAcceso: z.enum(nivelesAcceso, { errorMap: () => ({ message: "Seleccione un nivel de acceso." }) }),
  puestoId: z.string().optional(),
  activo: z.boolean().default(true),
});
type UserFormData = z.infer<typeof userFormSchema>;

const ITEMS_PER_PAGE = 10;

export default function UserManagementTab() {
  const [users, setUsers] = useState<User[]>([]);
  const { puestos } = usePuestos();
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const { addLogEntry } = useActivityLog();
  const { user: currentUser } = useAuth();
  const { hasPermission } = usePermissions();

  useEffect(() => {
    setIsLoadingUsers(true);
    const q = query(collection(db, "users"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const usersData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
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

  useEffect(() => {
    if (isUserDialogOpen && editingUser) {
      userForm.reset(editingUser);
    }
  }, [editingUser, isUserDialogOpen, userForm]);

  async function handleUserSubmit(data: UserFormData) {
    if (!editingUser || !hasPermission('usuarios:edit')) return;

    try {
      const functions = getFunctions();
      const setUserRole = httpsCallable(functions, 'setUserRole');
      await setUserRole({
        userId: editingUser.id,
        rol: data.rol,
        nivelAcceso: data.nivelAcceso,
        puestoId: data.puestoId || null,
      });

      const userDocRef = doc(db, "users", editingUser.id);
      await updateDoc(userDocRef, {
        nombreCompleto: data.nombreCompleto,
        activo: data.activo,
        puestoId: data.puestoId || null,
        rol: data.rol,
        nivelAcceso: data.nivelAcceso,
      });

      toast({ title: '✅ Usuario Actualizado', description: `Los permisos para ${data.nombreCompleto} han sido actualizados.` });
      addLogEntry({ action: 'update', entityType: 'Usuario', entityName: data.nombreCompleto, details: `Permisos actualizados a Rol: ${data.rol}, Nivel: ${data.nivelAcceso}.` });
    } catch (error: any) {
      console.error("Error setting user role via function:", error.message);
      toast({ title: "❌ Error de Permisos", description: error.message || "No se pudo actualizar el rol del usuario.", variant: "destructive" });
    } finally {
      setEditingUser(null);
      setIsUserDialogOpen(false);
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
      toast({ title: `Usuario ${newStatus ? 'Activado' : 'Desactivado'}`, description: `El usuario "${userToToggle.nombreCompleto}" ha sido ${newStatus ? 'activado' : 'desactivado'}.` });
      addLogEntry({ action: 'status_change', entityType: 'Usuario', entityName: userToToggle.nombreCompleto, details: `Estado cambiado a ${newStatus ? 'Activo' : 'Inactivo'}.` });
    } catch (error) {
      console.error("Error toggling user status:", error);
      toast({ title: "Error", description: "No se pudo cambiar el estado del usuario.", variant: "destructive" });
    }
  }

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearchTerm = user.nombreCompleto.toLowerCase().includes(searchTerm.toLowerCase()) || user.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = roleFilter === 'all' || user.rol === roleFilter;
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' && user.activo) || (statusFilter === 'inactive' && !user.activo);
      return matchesSearchTerm && matchesRole && matchesStatus;
    });
  }, [users, searchTerm, roleFilter, statusFilter]);

  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
  const paginatedUsers = useMemo(() => filteredUsers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE), [filteredUsers, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  return (
    <>
      {currentUser?.rol === 'Administrador' && <div className="mb-6"><ClaimsHealthDashboard /></div>}
      <div className="mb-6 space-y-4 md:flex md:items-end md:justify-between md:space-y-0 md:space-x-4">
        <div className="relative flex-1 md:flex-grow"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" /><Input type="search" placeholder="Buscar por nombre o email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10" /></div>
        <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-2">
          <Select value={roleFilter} onValueChange={(value: UserRole | 'all') => setRoleFilter(value)}><SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Filtrar por rol" /></SelectTrigger><SelectContent><SelectItem value="all">Todos los roles</SelectItem>{userRoles.map(role => (<SelectItem key={role} value={role}>{role}</SelectItem>))}</SelectContent></Select>
          <Select value={statusFilter} onValueChange={(value: 'all' | 'active' | 'inactive') => setStatusFilter(value)}><SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Filtrar por estado" /></SelectTrigger><SelectContent><SelectItem value="all">Todos los estados</SelectItem><SelectItem value="active">Activos</SelectItem><SelectItem value="inactive">Inactivos</SelectItem></SelectContent></Select>
        </div>
      </div>
      {isLoadingUsers ? (<div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>) :
        paginatedUsers.length > 0 ? (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader><TableRow><TableHead>Nombre Completo</TableHead><TableHead>Email</TableHead><TableHead>Puesto</TableHead><TableHead>Rol</TableHead><TableHead>Nivel Acceso</TableHead><TableHead className="w-[120px] text-center">Estado</TableHead><TableHead className="text-right w-[140px]">Acciones</TableHead></TableRow></TableHeader>
                <TableBody>{paginatedUsers.map((user) => (<TableRow key={user.id}><TableCell className="font-medium">{user.nombreCompleto}{user.rol === 'Administrador' && (<Badge variant="destructive" className="ml-2 text-xs">ADMIN</Badge>)}</TableCell><TableCell>{user.email}</TableCell><TableCell className="text-sm text-muted-foreground">{puestos.find(p => p.id === user.puestoId)?.nombre || 'No asignado'}</TableCell><TableCell><Badge variant="outline">{user.rol}</Badge></TableCell><TableCell><Badge variant="secondary">{user.nivelAcceso}</Badge></TableCell><TableCell className="text-center"><Badge variant={user.activo ? 'default' : 'outline'}>{user.activo ? 'Activo' : 'Inactivo'}</Badge></TableCell><TableCell className="text-right space-x-1">{hasPermission('usuarios:edit') && (<><Switch checked={user.activo} onCheckedChange={() => handleToggleUserStatus(user)} aria-label={user.activo ? 'Desactivar' : 'Activar'} className="mr-2" /><Button variant="ghost" size="icon" onClick={() => handleEditUser(user)} className="mr-1"><Edit2 className="h-4 w-4" /></Button></>)}</TableCell></TableRow>))}</TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between space-x-2 py-4"><span className="text-sm text-muted-foreground">Página {currentPage} de {totalPages} ({filteredUsers.length} total)</span><div className="space-x-2"><Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Anterior</Button><Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>Siguiente</Button></div></div>
          </>
        ) : (<div className="mt-6 p-8 border-dashed rounded-lg text-center bg-muted/20"><Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" /><p className="font-semibold text-lg">No se encontraron usuarios</p><p className="text-sm text-muted-foreground">Ajuste los filtros o espere a que se registren nuevos usuarios.</p></div>)}
      <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
        <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Editar Usuario</DialogTitle><DialogDescription>Modifica los detalles. El email no se puede cambiar.</DialogDescription></DialogHeader>
          <Form {...userForm}><form onSubmit={userForm.handleSubmit(handleUserSubmit)} className="space-y-4 py-4">
              <FormField control={userForm.control} name="nombreCompleto" render={({ field }) => (<FormItem><FormLabel>Nombre Completo</FormLabel><FormControl><Input placeholder="Juan Pérez" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={userForm.control} name="email" render={({ field }) => (<FormItem><FormLabel>Correo Electrónico</FormLabel><FormControl><Input type="email" {...field} disabled /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={userForm.control} name="rol" render={({ field }) => (<FormItem><FormLabel>Rol Funcional</FormLabel><Select onValueChange={field.onChange} value={field.value} defaultValue={field.value} disabled={currentUser?.rol !== 'Administrador'}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione un rol" /></SelectTrigger></FormControl><SelectContent>{userRoles.map((role) => (<SelectItem key={role} value={role}>{role}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
              <FormField control={userForm.control} name="nivelAcceso" render={({ field }) => (<FormItem><FormLabel>Nivel de Acceso</FormLabel><Select onValueChange={field.onChange} value={field.value} defaultValue={field.value} disabled={currentUser?.rol !== 'Administrador'}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione un nivel" /></SelectTrigger></FormControl><SelectContent>{nivelesAcceso.map((nivel) => (<SelectItem key={nivel} value={nivel}>{nivel}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
              <FormField control={userForm.control} name="puestoId" render={({ field }) => (<FormItem><FormLabel>Puesto Asignado</FormLabel><Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="No Asignado" /></SelectTrigger></FormControl><SelectContent><SelectItem value="none">No Asignado</SelectItem>{puestos.map((puesto) => (<SelectItem key={puesto.id} value={puesto.id}>{puesto.nombre}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
              <FormField control={userForm.control} name="activo" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><div className="space-y-0.5"><FormLabel>Estado Activo</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
              <DialogFooter><Button type="button" variant="outline" onClick={() => setIsUserDialogOpen(false)}>Cancelar</Button><Button type="submit" disabled={!hasPermission('usuarios:edit')}>Guardar Cambios</Button></DialogFooter>
            </form></Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
