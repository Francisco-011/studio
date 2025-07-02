

'use client';

import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { format, isValid, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useActividades, type Actividad, type CambioHistorial, type ActividadCreationData } from '@/contexts/ActividadesContext';
import { useProcedimientos, type Procedimiento } from '@/contexts/ProcedimientosContext';

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
import { Textarea } from '@/components/ui/textarea';
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
import { ListChecks, Search, PlusCircle, Edit2, Trash2, RotateCcw, AlertTriangle, Link2, ChevronDown, Lock, Loader2, ArrowUp, ArrowDown, ChevronsUpDown, FileText, History } from "lucide-react";
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";


const actividadFormSchema = z.object({
  id: z.string().optional(),
  nombre: z.string().min(1, 'El nombre de la actividad es requerido.'),
  descripcionBreve: z.string().optional(),
  activa: z.boolean().default(true),
});
type ActividadFormData = z.infer<typeof actividadFormSchema>;

type SortableActividadKeys = keyof Omit<Actividad, 'historialDeCambios' | 'descripcionBreve'> | 'asignaciones';
type SortDirection = 'ascending' | 'descending';

interface SortConfig {
  key: SortableActividadKeys;
  direction: SortDirection;
}

const ITEMS_PER_PAGE = 10;

const escapeCsvCell = (cellData: string | number | undefined | null | string[]): string => {
  if (cellData === undefined || cellData === null) {
    return '';
  }
  if (Array.isArray(cellData)) {
    const joinedString = cellData.join('; ');
    if (joinedString.includes(',') || joinedString.includes('"') || joinedString.includes('\n')) {
      return `"${joinedString.replace(/"/g, '""')}"`;
    }
    return joinedString;
  }
  const stringValue = String(cellData);
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

export default function ActividadesPage() {
  const {
    actividades,
    deletedActividades,
    addActividad,
    updateActividad,
    softDeleteActividad,
    restoreActividad,
    toggleActividadStatus,
    isLoadingActividades
  } = useActividades();
  const { procedimientos, isLoadingProcedimientos } = useProcedimientos();

  const searchParams = useSearchParams();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [usageFilter, setUsageFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');

  const [isActividadDialogOpen, setIsActividadDialogOpen] = useState(false);
  const [editingActividad, setEditingActividad] = useState<Actividad | null>(null);

  const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] = useState(false);
  const [activityToDelete, setActivityToDelete] = useState<Actividad | null>(null);
  const [isRecoveryDialogOpen, setIsRecoveryDialogOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [activityForHistory, setActivityForHistory] = useState<Actividad | null>(null);


  useEffect(() => {
    const searchQuery = searchParams.get('search');
    if (searchQuery) {
        setSearchTerm(searchQuery);
    }
  }, [searchParams]);
  
  const assignmentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    procedimientos.forEach(proc => {
        (proc.activityOrder || []).forEach(actId => {
            counts.set(actId, (counts.get(actId) || 0) + 1);
        });
    });
    return counts;
  }, [procedimientos]);


  const actividadForm = useForm<ActividadFormData>({
    resolver: zodResolver(actividadFormSchema),
    defaultValues: {
      nombre: '',
      descripcionBreve: '',
      activa: true,
    },
  });

  useEffect(() => {
    if (isActividadDialogOpen) {
      if (editingActividad) {
        actividadForm.reset({
          id: editingActividad.id,
          nombre: editingActividad.nombre,
          descripcionBreve: editingActividad.descripcionBreve || '',
          activa: editingActividad.activa,
        });
      } else {
        actividadForm.reset({
          nombre: '',
          descripcionBreve: '',
          activa: true,
        });
      }
    }
  }, [editingActividad, isActividadDialogOpen, actividadForm]);

  function handleActividadSubmit(data: ActividadFormData) {
    const { id, ...activityDataFromForm } = data;
    const activityDataForStorage: ActividadCreationData = activityDataFromForm;

    if (editingActividad && id) {
      updateActividad(id, activityDataForStorage);
      toast({ title: 'Actividad Actualizada', description: 'La actividad ha sido actualizada exitosamente.' });
    } else {
      addActividad(activityDataForStorage);
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

  function handleViewHistory(actividad: Actividad) {
    setActivityForHistory(actividad);
    setIsHistoryDialogOpen(true);
  }

  function promptDeleteActividad(actividad: Actividad) {
    const usageCount = assignmentCounts.get(actividad.id) || 0;
    if (usageCount > 0) {
      toast({
        title: 'Eliminación Bloqueada',
        description: `La actividad "${actividad.nombre}" está asignada a ${usageCount} procedimiento(s) y no puede ser eliminada.`,
        variant: 'destructive',
        duration: 5000,
      });
      return;
    }
    setActivityToDelete(actividad);
    setIsConfirmDeleteDialogOpen(true);
  }

  function executeDeleteActividad() {
    if (!activityToDelete) return;
    softDeleteActividad(activityToDelete.id);
    toast({ title: 'Actividad Eliminada', description: `"${activityToDelete.nombre}" ha sido eliminada. Puede recuperarla en los próximos 30 días.`, variant: 'destructive' });
    setActivityToDelete(null);
    setIsConfirmDeleteDialogOpen(false);
  }

  function handleRestoreActividad(actividadId: string) {
    const activityToRestore = deletedActividades.find(act => act.id === actividadId);
    if (activityToRestore) {
        restoreActividad(actividadId);
        toast({ title: 'Actividad Restaurada', description: `"${activityToRestore.nombre}" ha sido restaurada y activada.`});
    }
  }

  function handleToggleActividadStatus(actividad: Actividad) {
    toggleActividadStatus(actividad);
  }

  const sortedAndFilteredActividades = useMemo(() => {
    setCurrentPage(1); // Reset to first page on filter change
    let filtered = actividades.filter(actividad => {
      const count = assignmentCounts.get(actividad.id) || 0;
      const matchesSearchTerm = actividad.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                (actividad.descripcionBreve || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && actividad.activa) ||
        (statusFilter === 'inactive' && !actividad.activa);
      const matchesUsage =
        usageFilter === 'all' ||
        (usageFilter === 'assigned' && count > 0) ||
        (usageFilter === 'unassigned' && count === 0);
      return matchesSearchTerm && matchesStatus && matchesUsage;
    });

    if (sortConfig !== null) {
      filtered.sort((a, b) => {
        let valA: any;
        let valB: any;

        if (sortConfig.key === 'asignaciones') {
            valA = assignmentCounts.get(a.id) || 0;
            valB = assignmentCounts.get(b.id) || 0;
        } else {
            valA = a[sortConfig.key as keyof Actividad];
            valB = b[sortConfig.key as keyof Actividad];
        }

        if (sortConfig.key === 'createdAt' || sortConfig.key === 'updatedAt') {
          valA = valA || 0;
          valB = valB || 0;
        } else if (sortConfig.key === 'activa') {
           valA = a.activa;
           valB = b.activa;
        }

        if (typeof valA === 'string' && typeof valB === 'string') {
          valA = valA.toLowerCase();
          valB = valB.toLowerCase();
        }

        if (valA === undefined || valA === null) valA = sortConfig.direction === 'ascending' ? Infinity : -Infinity;
        if (valB === undefined || valB === null) valB = sortConfig.direction === 'ascending' ? Infinity : -Infinity;


        if (valA < valB) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (valA > valB) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    } else {
      filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }
    return filtered;
  }, [actividades, searchTerm, statusFilter, usageFilter, sortConfig, assignmentCounts]);

  const totalPages = Math.ceil(sortedAndFilteredActividades.length / ITEMS_PER_PAGE);
  const paginatedActividades = useMemo(() => {
    return sortedAndFilteredActividades.slice(
      (currentPage - 1) * ITEMS_PER_PAGE,
      currentPage * ITEMS_PER_PAGE
    );
  }, [sortedAndFilteredActividades, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    } else if (currentPage !== 1 && totalPages === 0 && sortedAndFilteredActividades.length > 0) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages, sortedAndFilteredActividades.length]);


  const requestSort = (key: SortableActividadKeys) => {
    let direction: SortDirection = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: SortableActividadKeys) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ChevronsUpDown className="ml-1 h-3 w-3 opacity-40 group-hover:opacity-100" />;
    }
    return sortConfig.direction === 'ascending' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />;
  };


  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recoverableActividades = deletedActividades.filter(act => act.deletedAt && act.deletedAt > thirtyDaysAgo)
                                  .sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));


  const handleExport = () => {
    if (sortedAndFilteredActividades.length === 0) {
      toast({ title: "Nada que exportar", description: "No hay actividades que coincidan con los filtros actuales.", variant: "default" });
      return;
    }

    const headers = [
      "ID", "Código", "Nombre Actividad", "Descripción Breve",
      "Estado", "Asignaciones",
      "Fecha Creación", "Última Modificación"
    ];

    const csvRows = [
      headers.join(','),
      ...sortedAndFilteredActividades.map(act => {
        return [
          escapeCsvCell(act.id),
          escapeCsvCell(act.codigo),
          escapeCsvCell(act.nombre),
          escapeCsvCell(act.descripcionBreve),
          escapeCsvCell(act.activa ? 'Activa' : 'Inactiva'),
          escapeCsvCell(assignmentCounts.get(act.id) || 0),
          escapeCsvCell(act.createdAt && isValid(new Date(act.createdAt)) ? format(new Date(act.createdAt), 'yyyy-MM-dd HH:mm:ss') : 'N/A'),
          escapeCsvCell(act.updatedAt && isValid(new Date(act.updatedAt)) ? format(new Date(act.updatedAt), 'yyyy-MM-dd HH:mm:ss') : 'N/A')
        ].join(',');
      })
    ];

    const csvString = csvRows.join('\n');
    const blob = new Blob(["\uFEFF" + csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `actividades_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: "Exportación Iniciada", description: "El archivo CSV se está descargando." });
    } else {
      toast({ title: "Exportación Fallida", description: "Su navegador no soporta la descarga directa.", variant: "destructive" });
    }
  };


  if (isLoadingActividades || isLoadingProcedimientos) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-16 w-16 text-primary animate-spin" />
          <p className="ml-4 text-lg text-muted-foreground">Cargando datos de actividades...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-2 mb-1">
            <ListChecks className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl font-headline">Gestión de Actividades</CardTitle>
          </div>
          <CardDescription className="text-muted-foreground">
            Visualización, creación, edición y gestión de estados de todas las actividades granulares. Asocie actividades a procedimientos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 space-y-4 md:flex md:items-end md:justify-between md:space-y-0 md:space-x-4">
            <div className="relative flex-1 md:flex-grow">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar por nombre o descripción..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10"
              />
            </div>
            <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-2">
              <Select
                value={statusFilter}
                onValueChange={(value: 'all' | 'active' | 'inactive') => setStatusFilter(value)}
              >
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="Filtrar por estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos (Estado)</SelectItem>
                  <SelectItem value="active">Activas</SelectItem>
                  <SelectItem value="inactive">Inactivas</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={usageFilter}
                onValueChange={(value: 'all' | 'assigned' | 'unassigned') => setUsageFilter(value)}
              >
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="Filtrar por uso" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos (Uso)</SelectItem>
                  <SelectItem value="assigned">Asignadas</SelectItem>
                  <SelectItem value="unassigned">Sin Asignar</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleExport} variant="outline" className="w-full sm:w-auto">
                  <FileText className="mr-2 h-4 w-4" /> Exportar CSV ({sortedAndFilteredActividades.length})
              </Button>
              <Dialog open={isRecoveryDialogOpen} onOpenChange={setIsRecoveryDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" disabled={recoverableActividades.length === 0} className="w-full sm:w-auto">
                    <RotateCcw className="mr-2 h-4 w-4" /> Recuperar ({recoverableActividades.length})
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Recuperar Actividades Eliminadas</DialogTitle>
                    <DialogDescription>
                      Actividades eliminadas en los últimos 30 días que pueden ser restauradas.
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
                          {recoverableActividades.map((act) => (
                            <TableRow key={act.id}>
                              <TableCell>{act.nombre}</TableCell>
                              <TableCell>{act.deletedAt && isValid(new Date(act.deletedAt)) ? format(new Date(act.deletedAt), 'dd/MM/yyyy HH:mm') : 'N/A'}</TableCell>
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
                  actividadForm.reset();
                }
              }}>
                <DialogTrigger asChild>
                  <Button onClick={() => { setEditingActividad(null); actividadForm.reset(); setIsActividadDialogOpen(true); }} className="w-full sm:w-auto">
                    <PlusCircle className="mr-2 h-4 w-4" /> Agregar Actividad
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>{editingActividad ? 'Editar Actividad' : 'Agregar Nueva Actividad'}</DialogTitle>
                    <DialogDescription>
                      {editingActividad ? 'Modifica los detalles de la actividad.' : 'Completa la información para agregar una nueva actividad.'}
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...actividadForm}>
                    <form onSubmit={actividadForm.handleSubmit(handleActividadSubmit)} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
                      <FormField control={actividadForm.control} name="nombre" render={({ field }) => (<FormItem><FormLabel>Nombre de la Actividad</FormLabel><FormControl><Input placeholder="Ej: Revisar Facturas, Aprobar Solicitud" {...field} /></FormControl><FormMessage /></FormItem>)} />
                       <FormField control={actividadForm.control} name="descripcionBreve" render={({ field }) => (<FormItem><FormLabel>Descripción Breve (Opcional)</FormLabel><FormControl><Textarea placeholder="Un resumen conciso de la actividad." {...field} value={field.value ?? ''} className="min-h-[80px]" /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={actividadForm.control} name="activa" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><div className="space-y-0.5"><FormLabel>Estado Activo</FormLabel><FormDescription>Indica si la actividad está disponible para ser usada.</FormDescription></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange}/></FormControl></FormItem>)} />
                      <DialogFooter><DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose><Button type="submit">{editingActividad ? 'Guardar Cambios' : 'Agregar'}</Button></DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {paginatedActividades.length > 0 ? (
            <>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px] cursor-pointer" onClick={() => requestSort('codigo')}>Código {getSortIcon('codigo')}</TableHead>
                    <TableHead className="min-w-[200px] cursor-pointer" onClick={() => requestSort('nombre')}>Nombre {getSortIcon('nombre')}</TableHead>
                    <TableHead className="w-[150px] cursor-pointer" onClick={() => requestSort('asignaciones')}>Asignaciones {getSortIcon('asignaciones')}</TableHead>
                     <TableHead className="w-[140px] cursor-pointer" onClick={() => requestSort('updatedAt')}>Últ. Modif. {getSortIcon('updatedAt')}</TableHead>
                    <TableHead className="w-[100px] text-center cursor-pointer" onClick={() => requestSort('activa')}>Estado {getSortIcon('activa')}</TableHead>
                    <TableHead className="text-right w-[180px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedActividades.map((actividad) => (
                    <TableRow key={actividad.id}>
                      <TableCell className="font-mono text-xs">{actividad.codigo}</TableCell>
                      <TableCell className="font-medium">{actividad.nombre}</TableCell>
                      <TableCell className="text-sm">
                        <Badge variant="secondary" className="cursor-default">{assignmentCounts.get(actividad.id) || 0} Asign.</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{actividad.updatedAt && isValid(new Date(actividad.updatedAt)) ? format(new Date(actividad.updatedAt), 'dd/MM/yy HH:mm') : '-'}</TableCell>
                      <TableCell className="text-center"><Badge variant={actividad.activa ? 'default' : 'secondary'}>{actividad.activa ? 'Activa' : 'Inactiva'}</Badge></TableCell>
                      <TableCell className="text-right space-x-1">
                        <Switch checked={actividad.activa} onCheckedChange={() => handleToggleActividadStatus(actividad)} aria-label="Cambiar estado" className="mr-2"/>
                        <Button variant="ghost" size="icon" onClick={() => handleViewHistory(actividad)} disabled={!actividad.historialDeCambios || actividad.historialDeCambios.length === 0} title="Ver historial"><History className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleEditActividad(actividad)} className="mr-1"><Edit2 className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => promptDeleteActividad(actividad)} className="text-destructive" title={ (assignmentCounts.get(actividad.id) || 0) > 0 ? "No se puede eliminar: actividad asignada" : "Eliminar"}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between space-x-2 py-4">
              <span className="text-sm text-muted-foreground">Página {currentPage} de {totalPages} ({sortedAndFilteredActividades.length} total)</span>
              <div className="space-x-2"><Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Anterior</Button><Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>Siguiente</Button></div>
            </div>
            </>
          ) : (
            <div className="mt-6 p-8 border-dashed rounded-lg text-center bg-muted/20">
              <ListChecks className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <p className="font-semibold text-lg">No se encontraron actividades</p>
              <p className="text-sm text-muted-foreground">Ajuste los filtros o agregue una nueva actividad.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={isConfirmDeleteDialogOpen} onOpenChange={setIsConfirmDeleteDialogOpen}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle><div className="flex items-center gap-2"><AlertTriangle className="text-destructive"/>Confirmar Eliminación</div></AlertDialogTitle><AlertDialogDescription>¿Está seguro de que desea eliminar la actividad "{activityToDelete?.nombre}"? Esta acción la moverá a la papelera.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={executeDeleteActividad} className={buttonVariants({variant: "destructive"})}>Eliminar</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
      
       <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle>Historial de Cambios para: {activityForHistory?.nombre}</DialogTitle><DialogDescription>Registro de las modificaciones realizadas.</DialogDescription></DialogHeader>
          <div className="py-4 max-h-[60vh] overflow-y-auto">
            {activityForHistory?.historialDeCambios && activityForHistory.historialDeCambios.length > 0 ? (
              <Table><TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Campo Modificado</TableHead><TableHead>Valor Anterior</TableHead><TableHead>Valor Nuevo</TableHead></TableRow></TableHeader><TableBody>
                {activityForHistory.historialDeCambios.sort((a,b) => parseISO(b.timestamp).getTime() - parseISO(a.timestamp).getTime()).map((cambio, index) => (
                  <TableRow key={index}><TableCell className="text-xs">{format(parseISO(cambio.timestamp), 'dd/MM/yy HH:mm')}</TableCell><TableCell>{cambio.field}</TableCell><TableCell className="text-xs">{String(cambio.before)}</TableCell><TableCell className="text-xs font-semibold">{String(cambio.after)}</TableCell></TableRow>
                ))}
              </TableBody></Table>
            ) : (<p className="text-center text-muted-foreground">No hay historial de cambios.</p>)}
          </div>
          <DialogFooter><DialogClose asChild><Button type="button" variant="outline">Cerrar</Button></DialogClose></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
