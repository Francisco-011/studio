
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
import { useProcesos, type CapturedProcess } from '@/contexts/ProcesosContext';
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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from '@/hooks/use-toast';
import { Target, Search, PlusCircle, Edit2, Trash2, AlertTriangle, CalendarIcon, DollarSign, Loader2, FileText, Clock, History, CheckSquare, ChevronsUpDown, ArrowUp, ArrowDown, Lock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";


const NO_AREA_SELECTED = "__NO_AREA_SELECTED__";
const NO_PUESTO_SELECTED = "__NO_PUESTO_SELECTED__";
const NO_ELEMENTO_SELECTED = "__NO_ELEMENTO_SELECTED__";


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

type SortableAccionKeys = keyof Omit<Accion, 'historialDeCambios' | 'descripcion'> | 'elementoAsociado';
type SortDirection = 'ascending' | 'descending';

interface SortConfig {
  key: SortableAccionKeys;
  direction: SortDirection;
}


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
  const { procesos: capturedProcesses, updateProceso, isLoadingProcesos } = useProcesos();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<AccionEstado | 'all'>('all');
  const [areaFilter, setAreaFilter] = useState('all');
  const [puestoFilter, setPuestoFilter] = useState('all');
  
  const [isAccionDialogOpen, setIsAccionDialogOpen] = useState(false);
  const [editingAccion, setEditingAccion] = useState<Accion | null>(null);

  const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] = useState(false);
  const [accionToDelete, setAccionToDelete] = useState<Accion | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [actionForHistory, setActionForHistory] = useState<Accion | null>(null);

  const [isCompleteConfirmDialogOpen, setIsCompleteConfirmDialogOpen] = useState(false);
  const [actionToComplete, setActionToComplete] = useState<{ id: string; data: AccionFormData } | null>(null);
  const [completionOptions, setCompletionOptions] = useState({
    applyTimeSaving: true,
    applyCostSaving: true,
  });

  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

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

  async function handleAccionSubmit(data: AccionFormData) {
    const isCompleting = editingAccion && data.estado === 'Completada' && editingAccion.estado !== 'Completada';
    const hasSavings = data.ahorroEstimado || data.ahorroTiempoEstimado;

    if (isCompleting && hasSavings) {
      setActionToComplete({ id: editingAccion.id, data });
      setCompletionOptions({ applyTimeSaving: true, applyCostSaving: true });
      setIsCompleteConfirmDialogOpen(true);
      setIsAccionDialogOpen(false);
      return;
    }

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
      await updateAccion(editingAccion.id, dataToSave);
      toast({ title: 'Acción Actualizada', description: 'La acción de mejora ha sido actualizada.' });
    } else {
      await addAccion(dataToSave);
      toast({ title: 'Acción Agregada', description: 'La nueva acción de mejora ha sido registrada.' });
    }
    setEditingAccion(null);
    setIsAccionDialogOpen(false);
    accionForm.reset();
  }

  async function handleConfirmCompletion() {
    if (!actionToComplete) return;

    const { id, data } = actionToComplete;
    const { applyTimeSaving, applyCostSaving } = completionOptions;
    
    const cambios: CambioHistorial[] = [];
    if (data.procesoId && (applyCostSaving || applyTimeSaving)) {
        const targetProcess = capturedProcesses.find(p => p.id === data.procesoId);
        if (targetProcess) {
            const updatesForProcess: Partial<CapturedProcess> = {};
            
            if (applyTimeSaving && data.ahorroTiempoEstimado && data.unidadTiempoAhorro === 'Minutos/Instancia') {
                if (targetProcess.tiempoEstimado !== undefined) {
                    updatesForProcess.tiempoEstimado = Math.max(0, targetProcess.tiempoEstimado - data.ahorroTiempoEstimado);
                    cambios.push({ timestamp: new Date().toISOString(), field: 'Tiempo Estimado Proceso', before: targetProcess.tiempoEstimado, after: updatesForProcess.tiempoEstimado });
                }
            }
            
            if (applyCostSaving && data.ahorroEstimado) {
                 if (targetProcess.costoEstimado !== undefined) {
                    updatesForProcess.costoEstimado = Math.max(0, targetProcess.costoEstimado - data.ahorroEstimado);
                    cambios.push({ timestamp: new Date().toISOString(), field: 'Costo Estimado Proceso', before: targetProcess.costoEstimado, after: updatesForProcess.costoEstimado });
                }
            }

            if (Object.keys(updatesForProcess).length > 0) {
                 await updateProceso(data.procesoId, updatesForProcess);
                 toast({ title: "Mejora Aplicada", description: `Se aplicaron ${cambios.length} cambio(s) al proceso asociado.`});
            }
        }
    }
    
    const dataToSave = {
        ...data,
        area: data.area || undefined,
        puesto: data.puesto || undefined,
        procesoId: data.procesoId === NO_ELEMENTO_SELECTED ? undefined : data.procesoId,
        actividadId: data.actividadId === NO_ELEMENTO_SELECTED ? undefined : data.actividadId,
        fechaObjetivo: data.fechaObjetivo ? data.fechaObjetivo.toISOString() : undefined,
        fechaFinalizacion: data.fechaFinalizacion ? data.fechaFinalizacion.toISOString() : undefined,
    };
    
    await updateAccion(id, dataToSave, cambios);

    toast({ title: 'Acción Completada', description: 'La acción y sus mejoras asociadas han sido aplicadas.' });

    setIsCompleteConfirmDialogOpen(false);
    setActionToComplete(null);
    setEditingAccion(null);
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
    if (accion.origenMejora?.includes('Auditoría')) {
      toast({
        title: "Eliminación Bloqueada",
        description: "Las acciones originadas en una auditoría no se pueden eliminar. Si es necesario, puede cambiar su estado a 'Cancelada'.",
        variant: "default",
        duration: 7000,
      });
      return;
    }
     if (accion.estado !== 'En Revisión') {
        toast({
            title: "Eliminación Bloqueada",
            description: "Solo se pueden eliminar las acciones que se encuentran en estado 'En Revisión'.",
            variant: "default",
            duration: 7000,
        });
        return;
    }
    setAccionToDelete(accion);
    setIsConfirmDeleteDialogOpen(true);
  }

  async function executeDeleteAccion() {
    if (!accionToDelete) return;
    await deleteAccion(accionToDelete.id);
    toast({ title: 'Acción Eliminada', description: `La acción "${accionToDelete.nombre}" ha sido eliminada.`, variant: 'destructive' });
    setAccionToDelete(null);
    setIsConfirmDeleteDialogOpen(false);
  }
  
  const sortedAndFilteredAcciones = useMemo(() => {
    setCurrentPage(1); // Reset page on filter change
    let filtered = acciones.filter(accion => {
      const matchesSearchTerm = 
        accion.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        accion.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
        accion.responsable.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (accion.origenMejora && accion.origenMejora.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesStatus = statusFilter === 'all' || accion.estado === statusFilter;
      const matchesArea = areaFilter === 'all' || accion.area === areaFilter;
      const matchesPuesto = puestoFilter === 'all' || accion.puesto === puestoFilter;
      return matchesSearchTerm && matchesStatus && matchesArea && matchesPuesto;
    });

    if (sortConfig !== null) {
      filtered.sort((a, b) => {
        let valA: any;
        let valB: any;

        if (sortConfig.key === 'elementoAsociado') {
            const getElementName = (acc: Accion) => {
                if (acc.procesoId) return `P: ${capturedProcesses.find(p => p.id === acc.procesoId)?.proceso || ''}`;
                if (acc.actividadId) return `A: ${actividades.find(ac => ac.id === acc.actividadId)?.nombre || ''}`;
                return '';
            };
            valA = getElementName(a);
            valB = getElementName(b);
        } else {
            valA = a[sortConfig.key as keyof Accion];
            valB = b[sortConfig.key as keyof Accion];
        }

        if (['fechaObjetivo', 'updatedAt'].includes(sortConfig.key)) {
            valA = valA ? (isValid(parseISO(valA)) ? parseISO(valA).getTime() : (typeof valA === 'number' ? valA : 0)) : 0;
            valB = valB ? (isValid(parseISO(valB)) ? parseISO(valB).getTime() : (typeof valB === 'number' ? valB : 0)) : 0;
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
        filtered.sort((a, b) => new Date(b.fechaCreacion).getTime() - new Date(a.fechaCreacion).getTime());
    }
    return filtered;

  }, [acciones, searchTerm, statusFilter, sortConfig, capturedProcesses, actividades, areaFilter, puestoFilter]);

  const requestSort = (key: SortableAccionKeys) => {
    let direction: SortDirection = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: SortableAccionKeys) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ChevronsUpDown className="ml-1 h-3 w-3 opacity-40 group-hover:opacity-100" />;
    }
    return sortConfig.direction === 'ascending' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />;
  };


  const totalPages = Math.ceil(sortedAndFilteredAcciones.length / ITEMS_PER_PAGE);
  const paginatedAcciones = useMemo(() => {
     return sortedAndFilteredAcciones.slice(
      (currentPage - 1) * ITEMS_PER_PAGE,
      currentPage * ITEMS_PER_PAGE
    );
  }, [sortedAndFilteredAcciones, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    } else if (currentPage !== 1 && totalPages === 0 && sortedAndFilteredAcciones.length > 0) {
       setCurrentPage(1);
    }
  }, [currentPage, totalPages, sortedAndFilteredAcciones.length]);
  
  const puestosInAreaFilter = useMemo(() => {
    if (areaFilter === 'all' || isLoadingPuestos || isLoadingAreas) return puestos;
    const areaId = areas.find(a => a.nombre === areaFilter)?.id;
    return areaId ? puestos.filter(p => p.areaId === areaId) : [];
  }, [areaFilter, puestos, areas, isLoadingPuestos, isLoadingAreas]);


  const handleExport = () => {
    if (sortedAndFilteredAcciones.length === 0) {
      toast({ title: "Nada que exportar", description: "No hay acciones que coincidan con los filtros actuales.", variant: "default" });
      return;
    }

    const headers = [
      "ID", "Nombre de la Acción", "Descripción", "Responsable", "Área", "Puesto", 
      "Proceso Asociado", "Actividad Asociada",
      "Estado", "Fecha Objetivo", "Fecha Finalización", "Ahorro Anual Estimado", "Moneda Ahorro", 
      "Ahorro Tiempo Estimado", "Unidad Tiempo Ahorro",
      "Origen Mejora", "Fecha Creación", "Última Modificación"
    ];

    const csvRows = [
      headers.join(','),
      ...sortedAndFilteredAcciones.map(acc => {
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


  if (isLoadingAcciones || isLoadingProcesos || isLoadingActividades) {
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
          <div className="mb-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-4">
                <Label htmlFor="search-input">Búsqueda General</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="search-input"
                    type="search"
                    placeholder="Buscar por nombre, descripción, responsable..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="area-filter">Filtrar por Área</Label>
                <Select value={areaFilter} onValueChange={v => { setAreaFilter(v); setPuestoFilter('all'); }}>
                  <SelectTrigger id="area-filter"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las Áreas</SelectItem>
                    {areas.map(a => <SelectItem key={a.id} value={a.nombre}>{a.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="puesto-filter">Filtrar por Puesto</Label>
                 <Select value={puestoFilter} onValueChange={setPuestoFilter} disabled={areaFilter === 'all'}>
                  <SelectTrigger id="puesto-filter">
                    <SelectValue placeholder={areaFilter === 'all' ? "Seleccione un área primero" : "Todos los Puestos"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los Puestos</SelectItem>
                    {puestosInAreaFilter.map(p => <SelectItem key={p.id} value={p.nombre}>{p.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="status-filter">Filtrar por Estado</Label>
                <Select
                  value={statusFilter}
                  onValueChange={(value: AccionEstado | 'all') => setStatusFilter(value)}
                >
                  <SelectTrigger id="status-filter">
                    <SelectValue placeholder="Filtrar por estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    {accionEstados.map(estado => (
                      <SelectItem key={estado} value={estado}>{estado}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2">
                <Button onClick={handleExport} variant="outline" className="w-full">
                    <FileText className="mr-2 h-4 w-4" /> Exportar
                </Button>
                <Dialog open={isAccionDialogOpen} onOpenChange={(isOpen) => {
                  setIsAccionDialogOpen(isOpen);
                  if (!isOpen) {
                    setEditingAccion(null);
                    accionForm.reset();
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button onClick={() => { setEditingAccion(null); accionForm.reset(); setIsAccionDialogOpen(true); }} className="w-full">
                      <PlusCircle className="mr-2 h-4 w-4" /> Agregar
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
                                  <Select onValueChange={field.onChange} value={field.value || NO_ELEMENTO_SELECTED} disabled={!!watchedActividadId && watchedActividadId !== NO_ELEMENTO_SELECTED}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Seleccione un proceso" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                      <SelectItem value={NO_ELEMENTO_SELECTED}>Ninguno</SelectItem>
                                      {capturedProcesses.filter(p => p.activo !== false).map(proc => (<SelectItem key={proc.id} value={proc.id}>{proc.proceso}</SelectItem>))}
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
                                  <Select onValueChange={field.onChange} value={field.value || NO_ELEMENTO_SELECTED} disabled={!!watchedProcesoId && watchedProcesoId !== NO_ELEMENTO_SELECTED}>
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
                                <FormLabel>Fecha Límite (Objetivo)</FormLabel>
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
                                <FormDescription className="text-xs">La fecha en que se planea completar esta acción.</FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={accionForm.control}
                            name="fechaFinalizacion"
                            render={({ field }) => (
                              <FormItem className="flex flex-col">
                                <FormLabel>Fecha de Finalización Real</FormLabel>
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
                                <FormDescription className="text-xs">Fecha en que la acción fue completada.</FormDescription>
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
                                <FormLabel>Ahorro Anual Estimado (Opcional)</FormLabel>
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
          </div>

          {paginatedAcciones.length > 0 ? (
            <>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[250px] cursor-pointer hover:bg-muted/50 group" onClick={() => requestSort('nombre')}>
                      <div className="flex items-center">Nombre de la Acción {getSortIcon('nombre')}</div>
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50 group" onClick={() => requestSort('elementoAsociado')}>
                      <div className="flex items-center">Elemento Asociado {getSortIcon('elementoAsociado')}</div>
                    </TableHead>
                    <TableHead className="cursor-pointer hover:bg-muted/50 group" onClick={() => requestSort('responsable')}>
                      <div className="flex items-center">Responsable {getSortIcon('responsable')}</div>
                    </TableHead>
                    <TableHead className="text-center cursor-pointer hover:bg-muted/50 group" onClick={() => requestSort('estado')}>
                      <div className="flex items-center justify-center">Estado {getSortIcon('estado')}</div>
                    </TableHead>
                    <TableHead className="text-center cursor-pointer hover:bg-muted/50 group" onClick={() => requestSort('fechaObjetivo')}>
                      <div className="flex items-center justify-center">Fecha Límite {getSortIcon('fechaObjetivo')}</div>
                    </TableHead>
                    <TableHead className="text-right cursor-pointer hover:bg-muted/50 group" onClick={() => requestSort('ahorroEstimado')}>
                      <div className="flex items-center justify-end">Ahorro Anual {getSortIcon('ahorroEstimado')}</div>
                    </TableHead>
                    <TableHead className="text-right cursor-pointer hover:bg-muted/50 group" onClick={() => requestSort('ahorroTiempoEstimado')}>
                      <div className="flex items-center justify-end">Ahorro Tiempo {getSortIcon('ahorroTiempoEstimado')}</div>
                    </TableHead>
                    <TableHead className="text-center cursor-pointer hover:bg-muted/50 group" onClick={() => requestSort('updatedAt')}>
                      <div className="flex items-center justify-center">Últ. Modif. {getSortIcon('updatedAt')}</div>
                    </TableHead>
                    <TableHead className="text-right w-[160px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedAcciones.map((accion, index) => {
                    const linkedProcess = accion.procesoId ? capturedProcesses.find(p => p.id === accion.procesoId) : null;
                    const linkedActivity = accion.actividadId ? actividades.find(a => a.id === accion.actividadId) : null;
                    const isOverdue = 
                        isClient &&
                        (accion.estado === 'Pendiente' || accion.estado === 'En Progreso') && 
                        accion.fechaObjetivo &&
                        isValid(parseISO(accion.fechaObjetivo)) &&
                        parseISO(accion.fechaObjetivo) < new Date(new Date().setHours(0, 0, 0, 0));
                    
                    const isFromAudit = accion.origenMejora?.includes('Auditoría');
                    const canBeDeleted = !isFromAudit && accion.estado === 'En Revisión';

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
                      <TableCell>{accion.responsable}</TableCell>
                      <TableCell className="text-center">
                        {isOverdue ? (
                            <Badge variant="destructive" className="bg-orange-700 text-white">
                              Atrasada
                            </Badge>
                          ) : (
                            <Badge
                              className={cn(
                                "text-white border-transparent",
                                {
                                  "bg-green-700 hover:bg-green-600": accion.estado === "Completada",
                                  "bg-red-600 hover:bg-red-700": accion.estado === "Cancelada",
                                  "bg-blue-600 hover:bg-blue-700": accion.estado === "En Progreso",
                                  "bg-amber-600 hover:bg-amber-700": accion.estado === "Pendiente",
                                  "bg-purple-600 hover:bg-purple-700": accion.estado === "En Revisión",
                                }
                              )}
                            >
                              {accion.estado}
                            </Badge>
                          )}
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
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span tabIndex={0}>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => promptDeleteAccion(accion)}
                                  className="text-destructive hover:text-destructive"
                                  disabled={!canBeDeleted}
                                >
                                  {!canBeDeleted ? <Lock className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                                </Button>
                              </span>
                            </TooltipTrigger>
                            {!canBeDeleted && (
                              <TooltipContent>
                                <p>
                                  {isFromAudit 
                                    ? "Esta acción viene de una auditoría y no puede ser eliminada."
                                    : "Solo se pueden eliminar acciones en estado 'En Revisión'."
                                  }
                                </p>
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  )})}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between space-x-2 py-4">
              <span className="text-sm text-muted-foreground">
                Página {currentPage} de {totalPages} (Total: {sortedAndFilteredAcciones.length} acciones)
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

      <Dialog open={isCompleteConfirmDialogOpen} onOpenChange={setIsCompleteConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-primary"/>
              Confirmar Finalización de Acción
            </DialogTitle>
            <DialogDescription>
              La acción "{actionToComplete?.data.nombre}" se marcará como 'Completada'. Seleccione qué mejoras automáticas desea aplicar al elemento asociado.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {actionToComplete?.data.ahorroTiempoEstimado && (
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="applyTimeSaving" 
                  checked={completionOptions.applyTimeSaving}
                  onCheckedChange={(checked) => setCompletionOptions(prev => ({...prev, applyTimeSaving: !!checked}))}
                />
                <Label htmlFor="applyTimeSaving" className="text-sm font-normal cursor-pointer">
                  Aplicar ahorro de tiempo de {actionToComplete.data.ahorroTiempoEstimado} {actionToComplete.data.unidadTiempoAhorro?.split('/')[0]}
                </Label>
              </div>
            )}
             {actionToComplete?.data.ahorroEstimado && (
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="applyCostSaving" 
                  checked={completionOptions.applyCostSaving}
                  onCheckedChange={(checked) => setCompletionOptions(prev => ({...prev, applyCostSaving: !!checked}))}
                />
                <Label htmlFor="applyCostSaving" className="text-sm font-normal cursor-pointer">
                  Aplicar ahorro de costo de {formatCurrencyDisplay(actionToComplete.data.ahorroEstimado, actionToComplete.data.monedaAhorro)}
                </Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsCompleteConfirmDialogOpen(false); setActionToComplete(null);}}>Cancelar</Button>
            <Button onClick={handleConfirmCompletion}>Confirmar y Completar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

