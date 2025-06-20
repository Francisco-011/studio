
'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
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
import { Users, Search, PlusCircle, Edit2, Trash2, AlertTriangle } from "lucide-react";

const userRoles = ["Administrador", "Gerente de Proyecto", "Consultor", "Usuario Final"] as const;
type UserRole = typeof userRoles[number];

interface User {
  id: string;
  nombreCompleto: string;
  email: string;
  rol: UserRole;
  activo: boolean;
}

const userFormSchema = z.object({
  id: z.string().optional(),
  nombreCompleto: z.string().min(3, 'El nombre completo debe tener al menos 3 caracteres.'),
  email: z.string().email('Ingrese un correo electrónico válido.'),
  rol: z.enum(userRoles, { errorMap: () => ({ message: "Seleccione un rol válido."})}),
  activo: z.boolean().default(true),
});
type UserFormData = z.infer<typeof userFormSchema>;

const initialMockUsers: User[] = [
  { id: '1', nombreCompleto: 'Ana Pérez García', email: 'ana.perez@example.com', rol: 'Administrador', activo: true },
  { id: '2', nombreCompleto: 'Luis Fernández López', email: 'luis.fernandez@example.com', rol: 'Gerente de Proyecto', activo: true },
  { id: '3', nombreCompleto: 'Sofía Martínez Rodríguez', email: 'sofia.martinez@example.com', rol: 'Consultor', activo: false },
  { id: '4', nombreCompleto: 'Carlos Sánchez Gómez', email: 'carlos.sanchez@example.com', rol: 'Usuario Final', activo: true },
  { id: '5', nombreCompleto: 'Laura Torres Díaz', email: 'laura.torres@example.com', rol: 'Consultor', activo: true },
];

const ITEMS_PER_PAGE = 10;

export default function UsuariosPage() {
  const [users, setUsers] = useState<User[]>(initialMockUsers);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const userForm = useForm<UserFormData>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      nombreCompleto: '',
      email: '',
      rol: undefined,
      activo: true,
    },
  });

  useEffect(() => {
    if (isUserDialogOpen) {
      if (editingUser) {
        userForm.reset(editingUser);
      } else {
        userForm.reset({ nombreCompleto: '', email: '', rol: undefined, activo: true });
      }
    }
  }, [editingUser, isUserDialogOpen, userForm]);

  function handleUserSubmit(data: UserFormData) {
    if (editingUser) {
      setUsers(users.map((user) => (user.id === editingUser.id ? { ...user, ...data } : user)));
      toast({ title: 'Usuario Actualizado', description: 'Los datos del usuario han sido actualizados.' });
    } else {
      setUsers([...users, { id: Date.now().toString(), ...data }]);
      toast({ title: 'Usuario Agregado', description: 'El nuevo usuario ha sido agregado exitosamente.' });
    }
    setEditingUser(null);
    setIsUserDialogOpen(false);
    userForm.reset();
  }

  function handleEditUser(user: User) {
    setEditingUser(user);
    setIsUserDialogOpen(true);
  }

  function promptDeleteUser(user: User) {
    setUserToDelete(user);
    setIsConfirmDeleteDialogOpen(true);
  }

  function executeDeleteUser() {
    if (!userToDelete) return;
    setUsers(users.filter((user) => user.id !== userToDelete.id));
    toast({ title: 'Usuario Eliminado', description: `El usuario "${userToDelete.nombreCompleto}" ha sido eliminado.`, variant: 'destructive' });
    setUserToDelete(null);
    setIsConfirmDeleteDialogOpen(false);
  }
  
  function handleToggleUserStatus(userId: string) {
    setUsers(
      users.map((user) =>
        user.id === userId ? { ...user, activo: !user.activo } : user
      )
    );
    const userActual = users.find(user => user.id === userId);
    if (userActual) {
      toast({
        title: `Usuario ${!userActual.activo ? 'Activado' : 'Desactivado'}`,
        description: `El usuario "${userActual.nombreCompleto}" ha sido ${!userActual.activo ? 'activado' : 'desactivado'}.`,
      });
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


  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl font-headline">Gestión de Usuarios</CardTitle>
          </div>
          <CardDescription className="text-muted-foreground">
            Administra las cuentas de usuario, sus roles y los permisos de acceso dentro del sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
              <Dialog open={isUserDialogOpen} onOpenChange={(isOpen) => {
                setIsUserDialogOpen(isOpen);
                if (!isOpen) {
                  setEditingUser(null);
                  userForm.reset({ nombreCompleto: '', email: '', rol: undefined, activo: true });
                }
              }}>
                <DialogTrigger asChild>
                  <Button onClick={() => { setEditingUser(null); userForm.reset({ nombreCompleto: '', email: '', rol: undefined, activo: true }); setIsUserDialogOpen(true); }} className="w-full sm:w-auto">
                    <PlusCircle className="mr-2 h-4 w-4" /> Agregar Usuario
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>{editingUser ? 'Editar Usuario' : 'Agregar Nuevo Usuario'}</DialogTitle>
                    <DialogDescription>
                      {editingUser ? 'Modifica los detalles del usuario.' : 'Completa la información para agregar un nuevo usuario.'}
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
                              <Input type="email" placeholder="Ej: juan.perez@example.com" {...field} />
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
                            <FormLabel>Rol</FormLabel>
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
                        <Button type="submit">{editingUser ? 'Guardar Cambios' : 'Agregar Usuario'}</Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {paginatedUsers.length > 0 ? (
            <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre Completo</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-center">Rol</TableHead>
                    <TableHead className="w-[120px] text-center">Estado</TableHead>
                    <TableHead className="text-right w-[180px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.nombreCompleto}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={user.rol === "Administrador" ? "default" : "secondary"}>{user.rol}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={user.activo ? 'default' : 'outline'}>
                          {user.activo ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                       <TableCell className="text-right space-x-1">
                        <Switch
                          checked={user.activo}
                          onCheckedChange={() => handleToggleUserStatus(user.id)}
                          aria-label={user.activo ? 'Desactivar usuario' : 'Activar usuario'}
                          className="mr-2"
                        />
                        <Button variant="ghost" size="icon" onClick={() => handleEditUser(user)} className="mr-1">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => promptDeleteUser(user)} className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
                Comience agregando un nuevo usuario.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={isConfirmDeleteDialogOpen} onOpenChange={setIsConfirmDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
                <div className="flex items-center">
                    <AlertTriangle className="h-5 w-5 mr-2 text-destructive" />
                    Confirmar Eliminación
                </div>
            </AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro de que desea eliminar al usuario "{userToDelete?.nombreCompleto}"? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setUserToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={executeDeleteUser} className={buttonVariants({variant: "destructive"})}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
