
'use client';

import { useState, useEffect, useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAcciones, type Accion, accionEstados, monedaOptions, type Moneda, type AccionEstado, tiempoUnidadOptions, type TiempoUnidad, type CambioHistorial } from '@/contexts/AccionesContext';
import { useAreas } from '@/contexts/AreasContext';
import { usePuestos } from '@/contexts/PuestosContext';
import { useActividades, type Actividad } from '@/contexts/ActividadesContext';
import type { CapturedProcess } from '@/app/(app)/procesos-y-flujos-registrados/page';
import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from '@/hooks/use-toast';
import { Target, Search, PlusCircle, Edit2, Trash2, AlertTriangle, CalendarIcon, DollarSign, Loader2, FileText, Clock, History } from "lucide-react";

const NO_AREA_SELECTED = "__NO_AREA_SELECTED__";
const NO_PUESTO_SELECTED = "__NO_PUESTO_SELECTED__";
const NO_ELEMENTO_SELECTED = "__NO_ELEMENTO_SELECTED__";
const CAPTURED_DATA_LOCAL_STORAGE_KEY = 'proceza-captured-data';


const accionFormSchema = z.object({
  id: z.string().optional(),
  nombre: z.string().min(3, 'El nombre de la acción es requerido (mínimo 3 caracteres).'),
  descripcion: z.string().min(10, 'La descripción es requerida (mínimo 10 caracteres).'),
  responsable: z.string().min(1, 'El responsable es requerido.'),
  procesoId: z.string().optional(),
  actividadId: z.string().optional(),
  area: z.string().optional(),
  puesto: z.string().optional(),
  estado: z.enum(accionEstados, { errorMap: () => ({ message: "Seleccione un estado válido."})}),
  fechaObjetivo: z.date().optional(),
  fechaFinalizacion: z.date().optional(),
  ahorroEstimado: z.preprocess(
    (val) => (String(val).trim() === '' ? undefined : parseFloat(String(val))),
    z.number().nonnegative("El ahorro debe ser un número positivo o cero.").optional()
  ),
  monedaAhorro: z.enum(monedaOptions).optional(),
  ahorroTiempoEstimado: z.preprocess(
    (val) => (String(val).trim() === '' ? undefined : parseInt(String(val), 10)),
    z.number().int("El tiempo debe ser un número entero.").nonnegative("El tiempo debe ser positivo o cero.").optional()
  ),
  unidadTiempoAhorro: z.enum(tiempoUnidadOptions).optional(),
  origenMejora: z.string().optional(),
  historialDeCambios: z.array(z.any()).optional(),
}).refine(data => {
  if (data.ahorroEstimado !== undefined && data.ahorroEstimado > 0 && !data.monedaAhorro) {
    return false;
  }
  return true;
}, {
  message: "Debe seleccionar una moneda si especifica un ahorro estimado.",
  path: ["monedaAhorro"],
}).refine(data => {
    if (data.fechaFinalizacion && data.fechaObjetivo && data.fechaFinalizacion < data.fechaObjetivo) {
        return false;
    }
    return true;
}, {
    message: "La fecha de finalización no puede ser anterior a la fecha objetivo.",
    path: ["fechaFinalizacion"],
}).refine(data => {
  if (data.ahorroTiempoEstimado !== undefined && data.ahorroTiempoEstimado > 0 && !data.unidadTiempoAhorro) {
    return false;
  }
  return true;
}, {
  message: "Debe seleccionar una unidad de tiempo si especifica un ahorro de tiempo.",
  path: ["unidadTiempoAhorro"],
});

type AccionFormData = z.infer<typeof accionFormSchema>;

const ITEMS_PER_PAGE = 10;

function formatCurrencyDisplay(amount?: number, currency?: Moneda) {
  if (amount === undefined || amount === null || currency === undefined) return "-";
  try {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: currency }).format(amount);
  } catch (e) {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function formatTimeSavingDisplay(amount?: number, unit?: TiempoUnidad) {
  if (amount === undefined || amount === null || !unit) return "-";
  return `${amount} ${unit.split('/')[0]}`;
}


const escapeCsvCell = (cellData: string | number | undefined | null): string => {
  if (cellData === undefined || cellData === null) {
    return '';
  }
  const stringValue = String(cellData);
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

export default function AccionesPage() {
  const { acciones, addAccion, updateAccion, deleteAccion, isLoadingAcciones } = useAcciones();
  const { areas, isLoading: isLoadingAreas } = useAreas();
  const { puestos, isLoadingPuestos } = usePuestos();
  const { actividades, isLoadingActividades } = useActividades();
  const [capturedProcesses, setCapturedProcesses] = useState<CapturedProcess[]>([]);
  const [isLoadingProcesses, setIsLoadingProcesses] = useState(true);

  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<AccionEstado | 'all'>('all');
  
  const [isAccionDialogOpen, setIsAccionDialogOpen] = useState(false);
  const [editingAccion, setEditingAccion] = useState<Accion | null>(null);

  const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] = useState(false);
  const [accionToDelete, setAccionToDelete] = useState<Accion | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [actionForHistory, setActionForHistory] = useState<Accion | null>(null);

  function formatHistoryValue(field: string, value: any, moneda?: Moneda): string {
    if (value === undefined || value === null) return "-";
    if (String(field).toLowerCase().includes('costo')) {
      return formatCurrencyDisplay(Number(value), moneda);
    }
    if (String(field).toLowerCase().includes('tiempo')) {
      return `${value} min`;
    }
    return String(value);
  }


  useEffect(() => {
    setIsLoadingProcesses(true);
    try {
      const storedData = localStorage.getItem(CAPTURED_DATA_LOCAL_STORAGE_KEY);
      if (storedData) {
        setCapturedProcesses(JSON.parse(storedData).filter((p: any) => !p.deletedAt && p.activo !== false));
      }
    } catch (e) {
      console.error("Error loading processes for dropdown:", e);
    } finally {
      setIsLoadingProcesses(false);
    }
  }, []);

  const accionForm = useForm<AccionFormData>({
    resolver: zodResolver(accionFormSchema),
    defaultValues: {
      nombre: '',
      descripcion: '',
      responsable: '',
      area: undefined,
      puesto: undefined,
      procesoId: undefined,
      actividadId: undefined,
      estado: 'Pendiente',
      fechaObjetivo: undefined,
      fechaFinalizacion: undefined,
      ahorroEstimado: undefined,
      monedaAhorro: undefined,
      ahorroTiempoEstimado: undefined,
      unidadTiempoAhorro: undefined,
      origenMejora: '',
      historialDeCambios: [],
    },
  });
  
  const watchedArea = accionForm.watch('area');
  const availablePuestos = useMemo(() => {
    if (!watchedArea || isLoadingPuestos || isLoadingAreas) {
        return puestos;
    }
    const areaId = areas.find(a => a.nombre === watchedArea)?.id;
    if (!areaId) return puestos;
    return puestos.filter(p => p.areaId === areaId);
  }, [watchedArea, areas, puestos, isLoadingPuestos, isLoadingAreas]);

  const watchedProcesoId = accionForm.watch('procesoId');
  const watchedActividadId = accionForm.watch('actividadId');

  useEffect(() => {
    if (watchedProcesoId && watchedProcesoId !== NO_ELEMENTO_SELECTED) {
        accionForm.setValue('actividadId', undefined);
        const process = capturedProcesses.find(p => p.id === watchedProcesoId);
        if (process) {
            accionForm.setValue('area', process.area);
            accionForm.setValue('puesto', process.puesto);
        }
    }
  }, [watchedProcesoId, accionForm, capturedProcesses]);
  
  useEffect(() => {
     if (watchedActividadId && watchedActividadId !== NO_ELEMENTO_SELECTED) {
        accionForm.setValue('procesoId', undefined);
     }
  }, [watchedActividadId, accionForm]);


  useEffect(() => {
    if (isAccionDialogOpen) {
      if (editingAccion) {
        accionForm.reset({
          ...editingAccion,
          area: editingAccion.area || undefined,
          puesto: editingAccion.puesto || undefined,
          procesoId: editingAccion.procesoId || undefined,
          actividadId: editingAccion.actividadId || undefined,
          fechaObjetivo: editingAccion.fechaObjetivo ? parseISO(editingAccion.fechaObjetivo) : undefined,
          fechaFinalizacion: editingAccion.fechaFinalizacion ? parseISO(editingAccion.fechaFinalizacion) : undefined,
        });
      } else {
        accionForm.reset({
          nombre: '',
          descripcion: '',
          responsable: '',
          area: undefined,
          puesto: undefined,
          procesoId: undefined,
          actividadId: undefined,
          estado: 'Pendiente',
          fechaObjetivo: undefined,
          fechaFinalizacion: undefined,
          ahorroEstimado: undefined,
          monedaAhorro: undefined,
          ahorroTiempoEstimado: undefined,
          unidadTiempoAhorro: undefined,
          origenMejora: '',
          historialDeCambios: [],
        });
      }
    }
  }, [editingAccion, isAccionDialogOpen, accionForm]);

  function handleAccionSubmit(data: AccionFormData) {
    const dataToSave = {
        ...data,
        area: data.area || undefined,
        puesto: data.puesto || undefined,
        procesoId: data.procesoId === NO_ELEMENTO_SELECTED ? undefined : data.procesoId,
        actividadId: data.actividadId === NO_ELEMENTO_SELECTED ? undefined : data.actividadId,
        fechaObjetivo: data.fechaObjetivo ? data.fechaObjetivo.toISOString() : undefined,
        fechaFinalizacion: data.fechaFinalizacion ? data.fechaFinalizacion.toISOString() : undefined,
    };

    if (editingAccion) {
      updateAccion(editingAccion.id, dataToSave);
      toast({ title: 'Acción Actualizada', description: 'La acción de mejora ha sido actualizada.' });
    } else {
      addAccion(dataToSave);
      toast({ title: 'Acción Agregada', description: 'La nueva acción de mejora ha sido registrada.' });
    }
    setEditingAccion(null);
    setIsAccionDialogOpen(false);
    accionForm.reset();
  }

  function handleEditAccion(accion: Accion) {
    setEditingAccion(accion);
    setIsAccionDialogOpen(true);
  }

  function handleViewHistory(accion: Accion) {
    setActionForHistory(accion);
    setIsHistoryDialogOpen(true);
  }


  function promptDeleteAccion(accion: Accion) {
    setAccionToDelete(accion);
    setIsConfirmDeleteDialogOpen(true);
  }

  function executeDeleteAccion() {
    if (!accionToDelete) return;
    deleteAccion(accionToDelete.id);
    toast({ title: 'Acción Eliminada', description: `La acción "${accionToDelete.nombre}" ha sido eliminada.`, variant: 'destructive' });
    setAccionToDelete(null);
    setIsConfirmDeleteDialogOpen(false);
  }
  
  const filteredAcciones = useMemo(() => {
    setCurrentPage(1); // Reset page on filter change
    return acciones.filter(accion => {
      const matchesSearchTerm = 
        accion.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        accion.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
        accion.responsable.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (accion.origenMejora && accion.origenMejora.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (accion.area && accion.area.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (accion.puesto && accion.puesto.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesStatus = statusFilter === 'all' || accion.estado === statusFilter;
      return matchesSearchTerm && matchesStatus;
    }).sort((a, b) => new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime());
  }, [acciones, searchTerm, statusFilter]);

  const totalPages = Math.ceil(filteredAcciones.length / ITEMS_PER_PAGE);
  const paginatedAcciones = useMemo(() => {
     return filteredAcciones.slice(
      (currentPage - 1) * ITEMS_PER_PAGE,
      currentPage * ITEMS_PER_PAGE
    );
  }, [filteredAcciones, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    } else if (currentPage !== 1 && totalPages === 0 && filteredAcciones.length > 0) {
       setCurrentPage(1);
    }
  }, [currentPage, totalPages, filteredAcciones.length]);

  const handleExport = () => {
    if (filteredAcciones.length === 0) {
      toast({ title: "Nada que exportar", description: "No hay acciones que coincidan con los filtros actuales.", variant: "default" });
      return;
    }

    const headers = [
      "ID", "Nombre de la Acción", "Descripción", "Responsable", "Área", "Puesto", 
      "Proceso Asociado", "Actividad Asociada",
      "Estado", "Fecha Objetivo", "Fecha Finalización", "Ahorro Estimado", "Moneda Ahorro", 
      "Ahorro Tiempo Estimado", "Unidad Tiempo Ahorro",
      "Origen Mejora", "Fecha Creación", "Última Modificación"
    ];

    const csvRows = [
      headers.join(','),
      ...filteredAcciones.map(acc => {
        const procName = acc.procesoId ? capturedProcesses.find(p => p.id === acc.procesoId)?.proceso : '';
        const actName = acc.actividadId ? actividades.find(a => a.id === acc.actividadId)?.nombre : '';
        return [
          escapeCsvCell(acc.id),
          escapeCsvCell(acc.nombre),
          escapeCsvCell(acc.descripcion),
          escapeCsvCell(acc.responsable),
          escapeCsvCell(acc.area),
          escapeCsvCell(acc.puesto),
          escapeCsvCell(procName),
          escapeCsvCell(actName),
          escapeCsvCell(acc.estado),
          escapeCsvCell(acc.fechaObjetivo && isValid(parseISO(acc.fechaObjetivo)) ? format(parseISO(acc.fechaObjetivo), 'yyyy-MM-dd') : ''),
          escapeCsvCell(acc.fechaFinalizacion && isValid(parseISO(acc.fechaFinalizacion)) ? format(parseISO(acc.fechaFinalizacion), 'yyyy-MM-dd') : ''),
          escapeCsvCell(acc.ahorroEstimado),
          escapeCsvCell(acc.monedaAhorro),
          escapeCsvCell(acc.ahorroTiempoEstimado),
          escapeCsvCell(acc.unidadTiempoAhorro),
          escapeCsvCell(acc.origenMejora),
          escapeCsvCell(isValid(parseISO(acc.fechaCreacion)) ? format(parseISO(acc.fechaCreacion), 'yyyy-MM-dd HH:mm:ss') : ''),
          escapeCsvCell(isValid(new Date(acc.updatedAt)) ? format(new Date(acc.updatedAt), 'yyyy-MM-dd HH:mm:ss') : '')
        ].join(',');
      })
    ];

    const csvString = csvRows.join('\n');
    const blob = new Blob(["\uFEFF" + csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `acciones_mejora_${new Date().toISOString().split('T')[0]}.csv`);
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


  if (isLoadingAcciones || isLoadingProcesses || isLoadingActividades) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-16 w-16 text-primary animate-spin" />
          <p className="ml-4 text-lg text-muted-foreground">Cargando datos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-2 mb-1">
            <Target className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl font-headline">Gestión de Acciones de Mejora</CardTitle>
          </div>
          <CardDescription className="text-muted-foreground">
            Registre, planifique, asigne responsables, defina estados y cuantifique ahorros para cada acción de mejora.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 space-y-4 md:flex md:items-end md:justify-between md:space-y-0 md:space-x-4">
            <div className="relative flex-1 md:flex-grow">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar por nombre, descripción, responsable, área, puesto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10"
              />
            </div>
            <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-2">
              <Select
                value={statusFilter}
                onValueChange={(value: AccionEstado | 'all') => setStatusFilter(value)}
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filtrar por estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  {accionEstados.map(estado => (
                    <SelectItem key={estado} value={estado}>{estado}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
               <Button onClick={handleExport} variant="outline" className="w-full sm:w-auto">
                  <FileText className="mr-2 h-4 w-4" /> Exportar CSV ({filteredAcciones.length})
              </Button>
              <Dialog open={isAccionDialogOpen} onOpenChange={(isOpen) => {
                setIsAccionDialogOpen(isOpen);
                if (!isOpen) {
                  setEditingAccion(null);
                  accionForm.reset();
                }
              }}>
                <DialogTrigger asChild>
                  <Button onClick={() => { setEditingAccion(null); accionForm.reset(); setIsAccionDialogOpen(true); }} className="w-full sm:w-auto">
                    <PlusCircle className="mr-2 h-4 w-4" /> Agregar Acción
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>{editingAccion ? 'Editar Acción de Mejora' : 'Agregar Nueva Acción de Mejora'}</DialogTitle>
                    <DialogDescription>
                      {editingAccion ? 'Modifica los detalles de la acción.' : 'Completa la información para registrar una nueva acción.'}
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...accionForm}>
                    <form onSubmit={accionForm.handleSubmit(handleAccionSubmit)} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
                      <FormField
                        control={accionForm.control}
                        name="nombre"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nombre de la Acción</FormLabel>
                            <FormControl><Input placeholder="Ej: Implementar nuevo CRM" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={accionForm.control}
                        name="descripcion"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Descripción Detallada</FormLabel>
                            <FormControl><Textarea placeholder="Describe el objetivo, alcance y pasos clave de la acción." {...field} className="min-h-[100px]" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={accionForm.control}
                            name="procesoId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Proceso Asociado (Opcional)</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value || NO_ELEMENTO_SELECTED} disabled={!!watchedActividadId}>
                                  <FormControl><SelectTrigger><SelectValue placeholder="Seleccione un proceso" /></SelectTrigger></FormControl>
                                  <SelectContent>
                                    <SelectItem value={NO_ELEMENTO_SELECTED}>Ninguno</SelectItem>
                                    {capturedProcesses.map(proc => (<SelectItem key={proc.id} value={proc.id}>{proc.proceso}</SelectItem>))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={accionForm.control}
                            name="actividadId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Actividad Asociada (Opcional)</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value || NO_ELEMENTO_SELECTED} disabled={!!watchedProcesoId}>
                                  <FormControl><SelectTrigger><SelectValue placeholder="Seleccione una actividad" /></SelectTrigger></FormControl>
                                  <SelectContent>
                                    <SelectItem value={NO_ELEMENTO_SELECTED}>Ninguna</SelectItem>
                                    {actividades.filter(a => a.activa).map(act => (<SelectItem key={act.id} value={act.id}>{act.nombre}</SelectItem>))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                       </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={accionForm.control}
                          name="responsable"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Responsable</FormLabel>
                              <FormControl><Input placeholder="Ej: Equipo de TI, Ana Pérez" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={accionForm.control}
                          name="estado"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Estado</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Seleccione un estado" /></SelectTrigger></FormControl>
                                <SelectContent>
                                  {accionEstados.map(estado => (<SelectItem key={estado} value={estado}>{estado}</SelectItem>))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <FormField
                          control={accionForm.control}
                          name="area"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Área (Opcional)</FormLabel>
                              <Select
                                onValueChange={(value) => field.onChange(value === NO_AREA_SELECTED ? undefined : value)}
                                value={field.value || NO_AREA_SELECTED}
                                disabled={isLoadingAreas}
                              >
                                <FormControl><SelectTrigger><SelectValue placeholder="Seleccione un área" /></SelectTrigger></FormControl>
                                <SelectContent>
                                  <SelectItem value={NO_AREA_SELECTED}>Ninguna</SelectItem>
                                  {areas.map(area => (<SelectItem key={area.id} value={area.nombre}>{area.nombre}</SelectItem>))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={accionForm.control}
                          name="puesto"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Puesto (Opcional)</FormLabel>
                              <Select
                                onValueChange={(value) => field.onChange(value === NO_PUESTO_SELECTED ? undefined : value)}
                                value={field.value || NO_PUESTO_SELECTED}
                                disabled={isLoadingPuestos}
                              >
                                <FormControl><SelectTrigger><SelectValue placeholder="Seleccione un puesto" /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value={NO_PUESTO_SELECTED}>Ninguno</SelectItem>
                                    {availablePuestos.map(puesto => (<SelectItem key={puesto.id} value={puesto.nombre}>{puesto.nombre}</SelectItem>))}
                                </SelectContent>
                              </Select>
                              <FormDescription className="text-xs">Puestos filtrados por el área seleccionada.</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                       </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={accionForm.control}
                          name="fechaObjetivo"
                          render={({ field }) => (
                            <FormItem className="flex flex-col">
                              <FormLabel>Fecha Objetivo (Opcional)</FormLabel>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                      {field.value && isValid(field.value) ? format(field.value, "PPP", { locale: es }) : <span>Seleccione una fecha</span>}
                                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))} />
                                </PopoverContent>
                              </Popover>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={accionForm.control}
                          name="fechaFinalizacion"
                          render={({ field }) => (
                            <FormItem className="flex flex-col">
                              <FormLabel>Fecha Finalización (Opcional)</FormLabel>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                      {field.value && isValid(field.value) ? format(field.value, "PPP", { locale: es }) : <span>Seleccione una fecha</span>}
                                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar mode="single" selected={field.value} onSelect={field.onChange} />
                                </PopoverContent>
                              </Popover>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={accionForm.control}
                          name="ahorroEstimado"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Ahorro Estimado (Opcional)</FormLabel>
                              <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <FormControl><Input type="number" placeholder="Ej: 5000" {...field} value={field.value ?? ''} className="pl-9" min="0" step="any" /></FormControl>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                         <FormField
                          control={accionForm.control}
                          name="monedaAhorro"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Moneda del Ahorro</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value} disabled={!accionForm.watch('ahorroEstimado') || accionForm.watch('ahorroEstimado') === 0}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Seleccione moneda" /></SelectTrigger></FormControl>
                                <SelectContent>
                                  {monedaOptions.map(moneda => (<SelectItem key={moneda} value={moneda}>{moneda}</SelectItem>))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={accionForm.control}
                          name="ahorroTiempoEstimado"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Ahorro de Tiempo Estimado (Opcional)</FormLabel>
                              <div className="relative">
                                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <FormControl><Input type="number" placeholder="Ej: 40" {...field} value={field.value ?? ''} className="pl-9" min="0" step="1" /></FormControl>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                         <FormField
                          control={accionForm.control}
                          name="unidadTiempoAhorro"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Unidad de Tiempo</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value} disabled={!accionForm.watch('ahorroTiempoEstimado') || accionForm.watch('ahorroTiempoEstimado') === 0}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Seleccione unidad" /></SelectTrigger></FormControl>
                                <SelectContent>
                                  {tiempoUnidadOptions.map(unidad => (<SelectItem key={unidad} value={unidad}>{unidad}</SelectItem>))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={accionForm.control}
                        name="origenMejora"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Origen de la Mejora (Opcional)</FormLabel>
                            <FormControl><Input placeholder="Ej: Análisis IA Q2, Sugerencia Cliente X" {...field} value={field.value ?? ''} /></FormControl>
                            <FormDescription>Indique de dónde surgió esta acción de mejora.</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button type="button" variant="outline">Cancelar</Button>
                        </DialogClose>
                        <Button type="submit">{editingAccion ? 'Guardar Cambios' : 'Agregar Acción'}</Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {paginatedAcciones.length > 0 ? (
            <>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[250px]">Nombre de la Acción</TableHead>
                    <TableHead>Elemento Asociado</TableHead>
                    <TableHead>Área</TableHead>
                    <TableHead>Puesto</TableHead>
                    <TableHead>Responsable</TableHead>
                    <TableHead className="text-center">Estado</TableHead>
                    <TableHead className="text-center">Fecha Objetivo</TableHead>
                    <TableHead className="text-right">Ahorro Costo</TableHead>
                    <TableHead className="text-right">Ahorro Tiempo</TableHead>
                    <TableHead className="text-center">Últ. Modif.</TableHead>
                    <TableHead className="text-right w-[160px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedAcciones.map((accion, index) => {
                    const linkedProcess = accion.procesoId ? capturedProcesses.find(p => p.id === accion.procesoId) : null;
                    const linkedActivity = accion.actividadId ? actividades.find(a => a.id === accion.actividadId) : null;
                    
                    return (
                    <TableRow key={`${accion.id}-${index}`}>
                      <TableCell className="font-medium">{accion.nombre}</TableCell>
                       <TableCell className="text-xs">
                          {linkedProcess ? (
                              <Badge variant="outline">P: {linkedProcess.proceso}</Badge>
                          ) : linkedActivity ? (
                              <Badge variant="secondary">A: {linkedActivity.nombre}</Badge>
                          ) : (
                              '-'
                          )}
                      </TableCell>
                      <TableCell>{accion.area || '-'}</TableCell>
                      <TableCell>{accion.puesto || '-'}</TableCell>
                      <TableCell>{accion.responsable}</TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          variant={accion.estado === "Completada" ? "default" : accion.estado === "Cancelada" ? "destructive" : "secondary"}
                          className={cn(
                            "text-white",
                            accion.estado === "En Progreso" && "bg-blue-500",
                            accion.estado === "Pendiente" && "bg-yellow-500",
                            accion.estado === "En Revisión" && "bg-purple-500",
                            accion.estado === "Completada" && "bg-green-500",
                            accion.estado === "Cancelada" && "bg-red-500",
                          )}
                        >
                          {accion.estado}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {accion.fechaObjetivo && isValid(parseISO(accion.fechaObjetivo)) ? format(parseISO(accion.fechaObjetivo), 'dd/MM/yyyy', { locale: es }) : '-'}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrencyDisplay(accion.ahorroEstimado, accion.monedaAhorro)}</TableCell>
                      <TableCell className="text-right">{formatTimeSavingDisplay(accion.ahorroTiempoEstimado, accion.unidadTiempoAhorro)}</TableCell>
                       <TableCell className="text-center text-xs text-muted-foreground">
                        {isValid(new Date(accion.updatedAt)) ? format(new Date(accion.updatedAt), 'dd/MM/yy HH:mm', { locale: es }) : '-'}
                      </TableCell>
                       <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleViewHistory(accion)} className="mr-1" disabled={!accion.historialDeCambios || accion.historialDeCambios.length === 0}>
                          <History className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleEditAccion(accion)} className="mr-1">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => promptDeleteAccion(accion)} className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )})}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between space-x-2 py-4">
              <span className="text-sm text-muted-foreground">
                Página {currentPage} de {totalPages} (Total: {filteredAcciones.length} acciones)
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
             <div className="mt-10 p-8 border border-dashed border-border rounded-lg flex flex-col items-center justify-center min-h-[200px] bg-muted/20">
                <Target className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-lg font-semibold text-foreground">No hay acciones de mejora</p>
                <p className="text-sm text-muted-foreground text-center">
                  {searchTerm || statusFilter !== 'all' ? 'Ajuste los filtros o ' : ''}
                  Comience agregando una nueva acción de mejora.
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
              ¿Está seguro de que desea eliminar la acción "{accionToDelete?.nombre}"? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setAccionToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={executeDeleteAccion} className={buttonVariants({variant: "destructive"})}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Historial de Cambios para: {actionForHistory?.nombre}</DialogTitle>
            <DialogDescription>
              Registro de las mejoras aplicadas al completar esta acción.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {actionForHistory?.historialDeCambios && actionForHistory.historialDeCambios.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Campo Modificado</TableHead>
                    <TableHead className="text-right">Valor Anterior</TableHead>
                    <TableHead className="text-right">Valor Nuevo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {actionForHistory.historialDeCambios.map((cambio, index) => (
                    <TableRow key={index}>
                      <TableCell className="text-xs">{format(parseISO(cambio.timestamp), 'dd/MM/yy HH:mm', { locale: es })}</TableCell>
                      <TableCell>{cambio.field}</TableCell>
                      <TableCell className="text-right">{formatHistoryValue(cambio.field, cambio.before, actionForHistory?.monedaAhorro)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatHistoryValue(cambio.field, cambio.after, actionForHistory?.monedaAhorro)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-center">No hay historial de cambios registrado para esta acción.</p>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cerrar</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
