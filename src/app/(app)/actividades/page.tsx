
'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { format } from 'date-fns';

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
import { ListChecks, Search, PlusCircle, Edit2, Trash2, RotateCcw, AlertTriangle } from "lucide-react";

interface Actividad {
  id: string;
  nombre: string;
  activa: boolean;
  procesosAsociadosCount: number;
  deletedAt?: number; // Timestamp in milliseconds
}

const actividadFormSchema = z.object({
  id: z.string().optional(),
  nombre: z.string().min(1, 'El nombre de la actividad es requerido.'),
  activa: z.boolean().default(true),
});
type ActividadFormData = z.infer<typeof actividadFormSchema>;

const initialMockActividades: Actividad[] = [
  { id: '1', nombre: 'Revisión de Documentación Legal', activa: true, procesosAsociadosCount: 5 },
  { id: '2', nombre: 'Elaboración de Propuesta Comercial', activa: true, procesosAsociadosCount: 12 },
  { id: '3', nombre: 'Aprobación de Descuentos Especiales', activa: false, procesosAsociadosCount: 2 },
  { id: '4', nombre: 'Seguimiento Post-Venta', activa: true, procesosAsociadosCount: 8 },
  { id: '5', nombre: 'Capacitación de Nuevo Personal', activa: true, procesosAsociadosCount: 3 },
  { id: '6', nombre: 'Generación de Reporte de Cumplimiento', activa: false, procesosAsociadosCount: 1 },
];

export default function ActividadesPage() {
  const [actividades, setActividades] = useState<Actividad[]>(initialMockActividades);
  const [deletedActividades, setDeletedActividades] = useState<Actividad[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  
  const [isActividadDialogOpen, setIsActividadDialogOpen] = useState(false);
  const [editingActividad, setEditingActividad] = useState<Actividad | null>(null);

  const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] = useState(false);
  const [activityToDelete, setActivityToDelete] = useState<Actividad | null>(null);
  const [isRecoveryDialogOpen, setIsRecoveryDialogOpen] = useState(false);

  const actividadForm = useForm<ActividadFormData>({
    resolver: zodResolver(actividadFormSchema),
    defaultValues: {
      nombre: '',
      activa: true,
    },
  });

  useEffect(() => {
    if (isActividadDialogOpen) {
      if (editingActividad) {
        actividadForm.reset({ id: editingActividad.id, nombre: editingActividad.nombre, activa: editingActividad.activa });
      } else {
        actividadForm.reset({ nombre: '', activa: true });
      }
    }
  }, [editingActividad, isActividadDialogOpen, actividadForm]);

  function handleActividadSubmit(data: ActividadFormData) {
    if (editingActividad) {
      setActividades(actividades.map((act) => (act.id === editingActividad.id ? { ...act, nombre: data.nombre, activa: data.activa } : act)));
      toast({ title: 'Actividad Actualizada', description: 'La actividad ha sido actualizada exitosamente.' });
    } else {
      setActividades([...actividades, { id: Date.now().toString(), nombre: data.nombre, activa: data.activa, procesosAsociadosCount: 0 }]);
      toast({ title: 'Actividad Agregada', description: 'La actividad ha sido agregada exitosamente.' });
    }
    setEditingActividad(null);
    setIsActividadDialogOpen(false);
    actividadForm.reset();
  }

  function handleEditActividad(actividad: Actividad) {
    setEditingActividad(actividad);
    setIsActividadDialogOpen(true);
  }

  function promptDeleteActividad(actividad: Actividad) {
    setActivityToDelete(actividad);
    setIsConfirmDeleteDialogOpen(true);
  }

  function executeDeleteActividad() {
    if (!activityToDelete) return;

    setDeletedActividades(prev => [...prev, { ...activityToDelete, deletedAt: Date.now() }]);
    setActividades(actividades.filter((act) => act.id !== activityToDelete.id));
    
    toast({ title: 'Actividad Eliminada', description: `"${activityToDelete.nombre}" ha sido eliminada. Puede recuperarla en los próximos 30 días.`, variant: 'destructive' });
    setActivityToDelete(null);
    setIsConfirmDeleteDialogOpen(false);
  }
  
  function handleRestoreActividad(actividadId: string) {
    const activityToRestore = deletedActividades.find(act => act.id === actividadId);
    if (activityToRestore) {
      const { deletedAt, ...restoredActivity } = activityToRestore;
      setActividades(prev => [...prev, restoredActivity]);
      setDeletedActividades(prev => prev.filter(act => act.id !== actividadId));
      toast({ title: 'Actividad Restaurada', description: `"${restoredActivity.nombre}" ha sido restaurada.`});
    }
  }

  function handleToggleActividadStatus(actividadId: string) {
    setActividades(
      actividades.map((act) =>
        act.id === actividadId ? { ...act, activa: !act.activa } : act
      )
    );
    const actividadActual = actividades.find(act => act.id === actividadId);
    if (actividadActual) {
      toast({
        title: `Actividad ${!actividadActual.activa ? 'Activada' : 'Desactivada'}`,
        description: `La actividad "${actividadActual.nombre}" ha sido ${!actividadActual.activa ? 'activada' : 'desactivada'}.`,
      });
    }
  }

  const filteredActividades = actividades.filter(actividad => {
    const matchesSearchTerm = actividad.nombre.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && actividad.activa) ||
      (statusFilter === 'inactive' && !actividad.activa);
    return matchesSearchTerm && matchesStatus;
  });

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recoverableActividades = deletedActividades.filter(act => act.deletedAt && act.deletedAt > thirtyDaysAgo);

  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-2 mb-1">
            <ListChecks className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl font-headline">Gestión de Actividades</CardTitle>
          </div>
          <CardDescription className="text-muted-foreground">
            Visualización, creación, edición y gestión de estados de todas las actividades granulares.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 space-y-4 md:flex md:items-end md:justify-between md:space-y-0 md:space-x-4">
            <div className="relative flex-1 md:flex-grow">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar actividad por nombre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Select
                value={statusFilter}
                onValueChange={(value: 'all' | 'active' | 'inactive') => setStatusFilter(value)}
              >
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Filtrar por estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="active">Activas</SelectItem>
                  <SelectItem value="inactive">Inactivas</SelectItem>
                </SelectContent>
              </Select>
              <Dialog open={isRecoveryDialogOpen} onOpenChange={setIsRecoveryDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" disabled={recoverableActividades.length === 0}>
                    <RotateCcw className="mr-2 h-4 w-4" /> Recuperar ({recoverableActividades.length})
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Recuperar Actividades Eliminadas</DialogTitle>
                    <DialogDescription>
                      Actividades eliminadas en los últimos 30 días.
                    </DialogDescription>
                  </DialogHeader>
                  {recoverableActividades.length > 0 ? (
                    <div className="max-h-[60vh] overflow-y-auto py-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Eliminada el</TableHead>
                            <TableHead className="text-right">Acción</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {recoverableActividades.map(act => (
                            <TableRow key={act.id}>
                              <TableCell>{act.nombre}</TableCell>
                              <TableCell>{act.deletedAt ? format(new Date(act.deletedAt), 'dd/MM/yyyy HH:mm') : 'N/A'}</TableCell>
                              <TableCell className="text-right">
                                <Button size="sm" onClick={() => handleRestoreActividad(act.id)}>
                                  <RotateCcw className="mr-2 h-3 w-3" /> Restaurar
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="py-4 text-muted-foreground">No hay actividades para recuperar.</p>
                  )}
                   <DialogFooter>
                      <DialogClose asChild>
                        <Button type="button" variant="outline">Cerrar</Button>
                      </DialogClose>
                    </DialogFooter>
                </DialogContent>
              </Dialog>
              <Dialog open={isActividadDialogOpen} onOpenChange={(isOpen) => {
                setIsActividadDialogOpen(isOpen);
                if (!isOpen) {
                  setEditingActividad(null);
                  actividadForm.reset({ nombre: '', activa: true });
                }
              }}>
                <DialogTrigger asChild>
                  <Button onClick={() => { setEditingActividad(null); actividadForm.reset({ nombre: '', activa: true }); setIsActividadDialogOpen(true); }}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Agregar Actividad
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>{editingActividad ? 'Editar Actividad' : 'Agregar Nueva Actividad'}</DialogTitle>
                    <DialogDescription>
                      {editingActividad ? 'Modifica los detalles de la actividad.' : 'Completa la información para agregar una nueva actividad.'}
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...actividadForm}>
                    <form onSubmit={actividadForm.handleSubmit(handleActividadSubmit)} className="space-y-4 py-4">
                      <FormField
                        control={actividadForm.control}
                        name="nombre"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nombre de la Actividad</FormLabel>
                            <FormControl>
                              <Input placeholder="Ej: Revisar Facturas, Aprobar Solicitud" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={actividadForm.control}
                        name="activa"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                            <div className="space-y-0.5">
                              <FormLabel>Estado Activo</FormLabel>
                              <FormDescription>
                                Indica si la actividad está disponible para ser usada en procesos.
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
                          <Button type="button" variant="outline" onClick={() => { setIsActividadDialogOpen(false); setEditingActividad(null); }}>Cancelar</Button>
                        </DialogClose>
                        <Button type="submit">{editingActividad ? 'Guardar Cambios' : 'Agregar Actividad'}</Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {filteredActividades.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre de la Actividad</TableHead>
                    <TableHead className="w-[120px] text-center">Estado</TableHead>
                    <TableHead className="w-[180px] text-center">Procesos Asociados</TableHead>
                    <TableHead className="text-right w-[180px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredActividades.map((actividad) => (
                    <TableRow key={actividad.id}>
                      <TableCell className="font-medium">{actividad.nombre}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={actividad.activa ? 'default' : 'secondary'}>
                          {actividad.activa ? 'Activa' : 'Inactiva'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {actividad.procesosAsociadosCount > 0 ? `${actividad.procesosAsociadosCount} procesos` : 'N/A'}
                      </TableCell>
                       <TableCell className="text-right space-x-1">
                        <Switch
                          checked={actividad.activa}
                          onCheckedChange={() => handleToggleActividadStatus(actividad.id)}
                          aria-label={actividad.activa ? 'Desactivar actividad' : 'Activar actividad'}
                          className="mr-2"
                        />
                        <Button variant="ghost" size="icon" onClick={() => handleEditActividad(actividad)} className="mr-1">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => promptDeleteActividad(actividad)} className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="mt-6 p-8 border border-dashed border-border rounded-lg flex flex-col items-center justify-center min-h-[200px] bg-muted/20">
              <ListChecks className="h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-lg font-semibold text-foreground">No se encontraron actividades</p>
              <p className="text-sm text-muted-foreground text-center">
                {searchTerm || statusFilter !== 'all' ? 'Ajuste los filtros o ' : ''}
                Comience agregando una nueva actividad.
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
              ¿Está seguro de que desea eliminar la actividad "{activityToDelete?.nombre}"? Esta acción la moverá a la lista de recuperación por 30 días.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setActivityToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={executeDeleteActividad} className={buttonVariants({variant: "destructive"})}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
