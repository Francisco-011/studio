
'use client';

import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { useActividades, type Actividad } from '@/contexts/ActividadesContext';
import { useSistemasCostos } from '@/contexts/SistemasCostosContext';
import { frecuenciaOptions } from '@/app/(app)/captura/page';

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
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { toast } from '@/hooks/use-toast';
import { ListChecks, Search, PlusCircle, Edit2, Trash2, RotateCcw, AlertTriangle, CalendarClock, Link2, ChevronDown, Lock, Loader2, Clock, Repeat, Server, ArrowUp, ArrowDown, ChevronsUpDown, FileText } from "lucide-react";
import type { CapturedProcess } from '../procesos-y-flujos-registrados/page';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const CAPTURED_DATA_LOCAL_STORAGE_KEY = 'proceza-captured-data';
const NO_SYSTEM_SELECTED_VALUE = "__NO_SYSTEM_SELECTED__";
const NO_FRECUENCIA_SELECTED_VALUE = "__NO_FRECUENCIA_SELECTED__";


const actividadFormSchema = z.object({
  id: z.string().optional(),
  nombre: z.string().min(1, 'El nombre de la actividad es requerido.'),
  descripcionBreve: z.string().optional(),
  sistemaUtilizado: z.string().optional(),
  tiempoEstimadoActividad: z.preprocess(
    (val) => (String(val).trim() === '' ? undefined : parseInt(String(val), 10)),
    z.number().int("El tiempo debe ser un número entero.").nonnegative("El tiempo debe ser positivo o cero.").optional()
  ),
  frecuenciaActividad: z.string().optional(),
  activa: z.boolean().default(true),
  procesosAsociadosIds: z.array(z.string()).optional().default([]),
});
type ActividadFormData = z.infer<typeof actividadFormSchema>;

type SortableActividadKeys = keyof Actividad | 'procesosAsociadosCount';
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
  const { sistemas: availableSystems, isLoadingSistemasCostos } = useSistemasCostos();

  const [capturedProcesses, setCapturedProcesses] = useState<CapturedProcess[]>([]);
  const [isLoadingCapturedProcesses, setIsLoadingCapturedProcesses] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [usageFilter, setUsageFilter] = useState<'all' | 'inUse' | 'notInUse'>('all');

  const [isActividadDialogOpen, setIsActividadDialogOpen] = useState(false);
  const [editingActividad, setEditingActividad] = useState<Actividad | null>(null);

  const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] = useState(false);
  const [activityToDelete, setActivityToDelete] = useState<Actividad | null>(null);
  const [isRecoveryDialogOpen, setIsRecoveryDialogOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [currentPage, setCurrentPage] = useState(1);


  useEffect(() => {
    setIsLoadingCapturedProcesses(true);
    try {
      const storedData = localStorage.getItem(CAPTURED_DATA_LOCAL_STORAGE_KEY);
      if (storedData) {
        const parsedData: CapturedProcess[] = JSON.parse(storedData);
        setCapturedProcesses(parsedData.filter(p => !p.deletedAt));
      }
    } catch (error) {
      console.error("Error loading captured processes from localStorage:", error);
      toast({ title: "Error al cargar procesos", description: "No se pudieron cargar los procesos para asociar.", variant: "destructive" });
    } finally {
        setIsLoadingCapturedProcesses(false);
    }
  }, []);

  const actividadForm = useForm<ActividadFormData>({
    resolver: zodResolver(actividadFormSchema),
    defaultValues: {
      nombre: '',
      descripcionBreve: '',
      sistemaUtilizado: undefined,
      tiempoEstimadoActividad: undefined,
      frecuenciaActividad: undefined,
      activa: true,
      procesosAsociadosIds: [],
    },
  });

  useEffect(() => {
    if (isActividadDialogOpen) {
      if (editingActividad) {
        actividadForm.reset({
          id: editingActividad.id,
          nombre: editingActividad.nombre,
          descripcionBreve: editingActividad.descripcionBreve || '',
          sistemaUtilizado: editingActividad.sistemaUtilizado || undefined,
          tiempoEstimadoActividad: editingActividad.tiempoEstimadoActividad,
          frecuenciaActividad: editingActividad.frecuenciaActividad || undefined,
          activa: editingActividad.activa,
          procesosAsociadosIds: editingActividad.procesosAsociadosIds || []
        });
      } else {
        actividadForm.reset({
          nombre: '',
          descripcionBreve: '',
          sistemaUtilizado: undefined,
          tiempoEstimadoActividad: undefined,
          frecuenciaActividad: undefined,
          activa: true,
          procesosAsociadosIds: []
        });
      }
    }
  }, [editingActividad, isActividadDialogOpen, actividadForm]);

  function handleActividadSubmit(data: ActividadFormData) {
    const { id, ...activityDataFromForm } = data;

    const activityDataForStorage = {
      ...activityDataFromForm,
      sistemaUtilizado: data.sistemaUtilizado === NO_SYSTEM_SELECTED_VALUE ? undefined : data.sistemaUtilizado,
      frecuenciaActividad: data.frecuenciaActividad === NO_FRECUENCIA_SELECTED_VALUE
        ? undefined
        : data.frecuenciaActividad as typeof frecuenciaOptions[number] | undefined,
    };

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

  function promptDeleteActividad(actividad: Actividad) {
    if (actividad.procesosAsociadosCount > 0) {
      toast({
        title: 'Eliminación Bloqueada',
        description: `La actividad "${actividad.nombre}" está asociada a ${actividad.procesosAsociadosCount} proceso(s) y no puede ser eliminada. Desvincúlela primero.`,
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
    if (activityToDelete.procesosAsociadosCount > 0) {
        toast({
            title: 'Error en Eliminación',
            description: `La actividad "${activityToDelete.nombre}" sigue asociada a procesos.`,
            variant: 'destructive',
        });
        setIsConfirmDeleteDialogOpen(false);
        setActivityToDelete(null);
        return;
    }
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

  function handleToggleActividadStatus(actividadId: string) {
    toggleActividadStatus(actividadId);
    const actividadActual = actividades.find(act => act.id === actividadId) || deletedActividades.find(act => act.id === actividadId);
    if (actividadActual) {
      toast({
        title: `Actividad ${!actividadActual.activa ? 'Activada' : 'Desactivada'}`,
        description: `La actividad "${actividadActual.nombre}" ha sido ${!actividadActual.activa ? 'activada' : 'desactivada'}.`,
      });
    }
  }

  const sortedAndFilteredActividades = useMemo(() => {
    setCurrentPage(1); // Reset to first page on filter change
    let filtered = actividades.filter(actividad => {
      const matchesSearchTerm = actividad.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                (actividad.descripcionBreve || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && actividad.activa) ||
        (statusFilter === 'inactive' && !actividad.activa);
      const matchesUsage =
        usageFilter === 'all' ||
        (usageFilter === 'inUse' && actividad.procesosAsociadosCount > 0) ||
        (usageFilter === 'notInUse' && actividad.procesosAsociadosCount === 0);
      return matchesSearchTerm && matchesStatus && matchesUsage;
    });

    if (sortConfig !== null) {
      filtered.sort((a, b) => {
        let valA: any = a[sortConfig.key as keyof Actividad];
        let valB: any = b[sortConfig.key as keyof Actividad];

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
  }, [actividades, searchTerm, statusFilter, usageFilter, sortConfig]);

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
      // This case might happen if filters result in 0 pages but there was data
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
      "ID", "Nombre Actividad", "Descripción Breve", "Sistema Utilizado", "Tiempo Estimado (min)",
      "Frecuencia Actividad", "Estado", "Num. Procesos Asociados", "Nombres Procesos Asociados",
      "Fecha Creación", "Última Modificación"
    ];

    const csvRows = [
      headers.join(','),
      ...sortedAndFilteredActividades.map(act => {
        const associatedProcessNames = act.procesosAsociadosIds
            ?.map(id => capturedProcesses.find(p=>p.id === id)?.proceso)
            .filter(Boolean)
            .join('; ') || ""; // Use semicolon for multi-value cells
        return [
          escapeCsvCell(act.id),
          escapeCsvCell(act.nombre),
          escapeCsvCell(act.descripcionBreve),
          escapeCsvCell(act.sistemaUtilizado),
          escapeCsvCell(act.tiempoEstimadoActividad),
          escapeCsvCell(act.frecuenciaActividad),
          escapeCsvCell(act.activa ? 'Activa' : 'Inactiva'),
          escapeCsvCell(act.procesosAsociadosCount),
          escapeCsvCell(associatedProcessNames),
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


  if (isLoadingActividades || isLoadingSistemasCostos || isLoadingCapturedProcesses) {
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
            Visualización, creación, edición y gestión de estados de todas las actividades granulares. Asocie actividades a procesos capturados.
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
                onValueChange={(value: 'all' | 'inUse' | 'notInUse') => setUsageFilter(value)}
              >
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="Filtrar por uso" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos (Uso)</SelectItem>
                  <SelectItem value="inUse">En Uso</SelectItem>
                  <SelectItem value="notInUse">Sin Uso</SelectItem>
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
                          {recoverableActividades.map((act, index) => (
                            <TableRow key={`${act.id}-${index}`}>
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
                        name="descripcionBreve"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Descripción Breve (Opcional)</FormLabel>
                            <FormControl><Textarea placeholder="Un resumen conciso de la actividad." {...field} value={field.value ?? ''} className="min-h-[80px]" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                       <FormField
                        control={actividadForm.control}
                        name="sistemaUtilizado"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Sistema Utilizado (Opcional)</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value || NO_SYSTEM_SELECTED_VALUE}
                              disabled={isLoadingSistemasCostos}
                            >
                              <FormControl>
                                <SelectTrigger><SelectValue placeholder={isLoadingSistemasCostos ? "Cargando sistemas..." : "Seleccione un sistema"} /></SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value={NO_SYSTEM_SELECTED_VALUE}>Ninguno / Manual</SelectItem>
                                {isLoadingSistemasCostos ? (
                                    <SelectItem value="loading-sistemas" disabled>Cargando...</SelectItem>
                                ) : availableSystems.length === 0 ? (
                                    <SelectItem value="no-sistemas-available" disabled>No hay sistemas configurados</SelectItem>
                                ) : (
                                    availableSystems.map((sys) => (
                                    <SelectItem key={sys.id} value={sys.nombre}>{sys.nombre}</SelectItem>
                                    ))
                                )}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={actividadForm.control}
                          name="tiempoEstimadoActividad"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Tiempo Estimado (min)</FormLabel>
                              <FormControl><Input type="number" placeholder="Ej: 15" {...field} value={field.value ?? ''} min="0" /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={actividadForm.control}
                          name="frecuenciaActividad"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Frecuencia de la Actividad</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                value={field.value || NO_FRECUENCIA_SELECTED_VALUE}
                              >
                                <FormControl>
                                  <SelectTrigger><SelectValue placeholder="Seleccione frecuencia" /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value={NO_FRECUENCIA_SELECTED_VALUE}>No aplica / Por instancia</SelectItem>
                                  {frecuenciaOptions.map((opt) => (
                                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={actividadForm.control}
                        name="procesosAsociadosIds"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>Procesos Asociados</FormLabel>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="w-full justify-between font-normal">
                                  <span className="truncate">
                                    {field.value && field.value.length > 0
                                      ? field.value.length === 1
                                        ? capturedProcesses.find(p => p.id === field.value?.[0])?.proceso || `${field.value.length} proceso seleccionado`
                                        : `${field.value.length} procesos seleccionados`
                                      : "Seleccionar procesos..."}
                                  </span>
                                  <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]" align="start">
                                <DropdownMenuLabel>Procesos Capturados Disponibles</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {isLoadingCapturedProcesses ? (
                                  <div className="px-2 py-1.5 text-sm text-muted-foreground">Cargando procesos...</div>
                                ) : capturedProcesses.length === 0 ? (
                                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                    No hay procesos capturados.
                                  </div>
                                ) : (
                                  capturedProcesses.map((proceso) => (
                                    <DropdownMenuCheckboxItem
                                      key={proceso.id}
                                      checked={field.value?.includes(proceso.id)}
                                      onCheckedChange={(checked) => {
                                        const currentSelected = field.value || [];
                                        if (checked) {
                                          field.onChange([...currentSelected, proceso.id]);
                                        } else {
                                          field.onChange(currentSelected.filter((id) => id !== proceso.id));
                                        }
                                      }}
                                    >
                                      {proceso.proceso}
                                    </DropdownMenuCheckboxItem>
                                  ))
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                             <FormDescription>
                              Vincule esta actividad a uno o más procesos capturados.
                            </FormDescription>
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

          {paginatedActividades.length > 0 ? (
            <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px] cursor-pointer hover:bg-muted/50 group" onClick={() => requestSort('nombre')}>
                      <div className="flex items-center">Nombre Actividad {getSortIcon('nombre')}</div>
                    </TableHead>
                    <TableHead className="max-w-sm">Desc. Breve</TableHead>
                    <TableHead className="w-[150px] text-center cursor-pointer hover:bg-muted/50 group" onClick={() => requestSort('sistemaUtilizado')}>
                      <div className="flex items-center justify-center">Sistema {getSortIcon('sistemaUtilizado')}</div>
                    </TableHead>
                    <TableHead className="w-[120px] text-center cursor-pointer hover:bg-muted/50 group" onClick={() => requestSort('tiempoEstimadoActividad')}>
                      <div className="flex items-center justify-center">Tiempo (min) {getSortIcon('tiempoEstimadoActividad')}</div>
                    </TableHead>
                    <TableHead className="w-[150px] text-center cursor-pointer hover:bg-muted/50 group" onClick={() => requestSort('frecuenciaActividad')}>
                      <div className="flex items-center justify-center">Frecuencia {getSortIcon('frecuenciaActividad')}</div>
                    </TableHead>
                    <TableHead className="w-[140px] text-center cursor-pointer hover:bg-muted/50 group" onClick={() => requestSort('createdAt')}>
                      <div className="flex items-center justify-center">Fecha Creación {getSortIcon('createdAt')}</div>
                    </TableHead>
                    <TableHead className="w-[140px] text-center cursor-pointer hover:bg-muted/50 group" onClick={() => requestSort('updatedAt')}>
                      <div className="flex items-center justify-center">Últ. Modif. {getSortIcon('updatedAt')}</div>
                    </TableHead>
                    <TableHead className="w-[100px] text-center cursor-pointer hover:bg-muted/50 group" onClick={() => requestSort('activa')}>
                      <div className="flex items-center justify-center">Estado {getSortIcon('activa')}</div>
                    </TableHead>
                    <TableHead className="w-[150px] text-center cursor-pointer hover:bg-muted/50 group" onClick={() => requestSort('procesosAsociadosCount')}>
                      <div className="flex items-center justify-center">En Uso {getSortIcon('procesosAsociadosCount')}</div>
                    </TableHead>
                    <TableHead className="text-right w-[180px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedActividades.map((actividad, index) => {
                    const associatedProcessNames = actividad.procesosAsociadosIds
                        ?.map(id => capturedProcesses.find(p=>p.id === id)?.proceso)
                        .filter(Boolean)
                        .join(', ') || "No asociada a procesos.";
                    return (
                    <TableRow key={`${actividad.id}-${index}`}>
                      <TableCell className="font-medium">{actividad.nombre}</TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-pre-wrap max-w-sm">{actividad.descripcionBreve || '-'}</TableCell>
                      <TableCell className="text-center text-xs">{actividad.sistemaUtilizado || '-'}</TableCell>
                      <TableCell className="text-center text-xs">{actividad.tiempoEstimadoActividad ?? '-'}</TableCell>
                      <TableCell className="text-center text-xs">{actividad.frecuenciaActividad || '-'}</TableCell>
                      <TableCell className="text-center text-xs text-muted-foreground">
                         {actividad.createdAt && isValid(new Date(actividad.createdAt)) ? format(new Date(actividad.createdAt), 'dd/MM/yy HH:mm', { locale: es }) : <CalendarClock className="h-4 w-4 inline-block" />}
                      </TableCell>
                      <TableCell className="text-center text-xs text-muted-foreground">
                        {actividad.updatedAt && isValid(new Date(actividad.updatedAt)) ? format(new Date(actividad.updatedAt), 'dd/MM/yy HH:mm', { locale: es }) : <CalendarClock className="h-4 w-4 inline-block" />}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={actividad.activa ? 'default' : 'secondary'}>
                          {actividad.activa ? 'Activa' : 'Inactiva'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                       <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                               <Badge variant={actividad.procesosAsociadosCount > 0 ? "outline" : "secondary"} className="cursor-default hover:bg-muted">
                                {actividad.procesosAsociadosCount > 0 ? (<><Link2 className="h-3 w-3 mr-1 inline-block"/> {`${actividad.procesosAsociadosCount} procesos`}</>) : "Sin Uso"}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent side="top" align="center" className="max-w-xs break-words">
                              <p className="text-xs">{associatedProcessNames}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
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
                        <Button variant="ghost" size="icon" onClick={() => promptDeleteActividad(actividad)} className="text-destructive hover:text-destructive"
                          title={actividad.procesosAsociadosCount > 0 ? `No se puede eliminar: actividad asociada a ${actividad.procesosAsociadosCount} proceso(s)` : "Eliminar actividad"}
                        >
                          {actividad.procesosAsociadosCount > 0 ? <Lock className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );})}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between space-x-2 py-4">
              <span className="text-sm text-muted-foreground">
                Página {currentPage} de {totalPages} (Total: {sortedAndFilteredActividades.length} actividades)
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
              <ListChecks className="h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-lg font-semibold text-foreground">No se encontraron actividades</p>
              <p className="text-sm text-muted-foreground text-center">
                {searchTerm || statusFilter !== 'all' || usageFilter !== 'all' ? 'Ajuste los filtros o ' : ''}
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
              ¿Está seguro de que desea eliminar la actividad "{activityToDelete?.nombre}"? Esta acción la moverá a la lista de recuperación por 30 días. Podrá restaurarla desde el botón "Recuperar".
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
