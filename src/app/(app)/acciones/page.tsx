
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAcciones, type Accion, accionEstados, monedaOptions, type Moneda, type AccionEstado, tiempoUnidadOptions, type TiempoUnidad, type CambioHistorial } from '@/contexts/AccionesContext';
import { useAreas } from '@/contexts/AreasContext';
import { useDepartamentos } from '@/contexts/DepartamentosContext';
import { usePuestos } from '@/contexts/PuestosContext';
import { useActividades, type Actividad } from '@/contexts/ActividadesContext';
import { useProcesos, type CapturedProcess } from '@/contexts/ProcesosContext';
import { useProcedimientos, type Procedimiento } from '@/contexts/ProcedimientosContext';
import { cn, formatMinutesToHours } from '@/lib/utils';
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
import { Target, Search, PlusCircle, Edit2, Trash2, AlertTriangle, CalendarIcon, DollarSign, Loader2, FileText, Clock, History, CheckSquare, ChevronsUpDown, ArrowUp, ArrowDown, Eye, XCircle, Lock, Save, Workflow as WorkflowIcon, Building, Users as UsersIcon, ListChecks } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Combobox } from '@/components/ui/combobox';
import { Separator } from '@/components/ui/separator';


const NO_AREA_SELECTED = "__NO_AREA_SELECTED__";
const NO_DEPARTAMENTO_SELECTED = "__NO_DEPARTAMENTO__";
const NO_PUESTO_SELECTED = "__NO_PUESTO_SELECTED__";
const NO_ELEMENTO_SELECTED = "__NO_ELEMENTO_SELECTED__";


const accionFormSchema = z.object({
  id: z.string().optional(),
  nombre: z.string().min(3, 'El nombre de la acción es requerido (mínimo 3 caracteres).'),
  descripcion: z.string().min(10, 'La descripción es requerida (mínimo 10 caracteres).'),
  responsable: z.string().min(1, 'El responsable es requerido.'),
  procesoId: z.string().optional(),
  procedimientoId: z.string().optional(),
  actividadId: z.string().optional(),
  area: z.string().optional(),
  departamento: z.string().optional(),
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
  historialDeCambios: z.array(z.any()).optional(),
  origenMejora: z.string().optional(),
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

// Schema for the impact registration dialog
const impactActivitySchema = z.object({
  id: z.string(),
  nombre: z.string(),
  tiempoEstimadoActual: z.number().optional(),
  costoEstimadoActual: z.number().optional(),
  nuevoTiempoEstimado: z.preprocess(
    (val) => (String(val).trim() === '' ? undefined : parseInt(String(val), 10)),
    z.number().int().nonnegative().optional()
  ),
  nuevoCostoEstimado: z.preprocess(
    (val) => (String(val).trim() === '' ? undefined : parseFloat(String(val))),
    z.number().nonnegative().optional()
  ),
});
const impactFormSchema = z.object({
  affectedActivities: z.array(impactActivitySchema),
});
type ImpactFormData = z.infer<typeof impactFormSchema>;


const ITEMS_PER_PAGE = 10;
type SortableAccionKeys = keyof Omit<Accion, 'historialDeCambios' | 'descripcion'> | 'elementoAsociado';
type SortDirection = 'ascending' | 'descending';

interface SortConfig {
  key: SortableAccionKeys;
  direction: SortDirection;
}

function formatCurrencyDisplay(amount?: number, currency?: Moneda) {
  if (amount === undefined || amount === null || !currency || isNaN(amount)) return "-";
  try {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: currency }).format(amount);
  } catch (e) {
    return `${amount.toFixed(2)} ${currency}`;
  }
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
  const { departamentos, isLoading: isLoadingDepartamentos } = useDepartamentos();
  const { puestos, isLoadingPuestos } = usePuestos();
  const { actividades, updateActividad: updateActividadContext, isLoadingActividades } = useActividades();
  const { procesos: capturedProcesses, isLoadingProcesos } = useProcesos();
  const { procedimientos, isLoadingProcedimientos } = useProcedimientos();
  
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

  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  const [isClient, setIsClient] = useState(false);
  
  const [isImpactDialogOpen, setIsImpactDialogOpen] = useState(false);
  const [actionToComplete, setActionToComplete] = useState<Accion | null>(null);
  const [affectedActivities, setAffectedActivities] = useState<Actividad[]>([]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const formatHistoryValue = useCallback((field: string, value: any, accion?: Accion | null): string => {
    if (value === undefined || value === null || value === 'No definido') return "-";

    const fieldLower = String(field).toLowerCase();
    
    if (fieldLower.includes('fecha')) {
        const dateString = String(value);
        if (!dateString) return "-";
        const date = parseISO(dateString);
        return isValid(date) ? format(date, 'PPP', { locale: es }) : dateString;
    }

    if (fieldLower.includes('costo') || fieldLower.includes('ahorroestimado')) {
        const numValue = Number(value);
        return isNaN(numValue) ? String(value) : formatCurrencyDisplay(numValue, accion?.monedaAhorro);
    }
    
    if (fieldLower.includes('ahorrotiempo')) {
        const numValue = Number(value);
        return isNaN(numValue) ? String(value) : formatMinutesToHours(numValue);
    }
    
    if (fieldLower === 'procesoid') return capturedProcesses.find(p => p.id === value)?.proceso || String(value).slice(0, 8) + '...';
    if (fieldLower === 'procedimientoid') return procedimientos.find(p => p.id === value)?.nombre || String(value).slice(0, 8) + '...';
    if (fieldLower === 'actividadid') return actividades.find(a => a.id === value)?.nombre || String(value).slice(0, 8) + '...';

    return String(value);
  }, [capturedProcesses, procedimientos, actividades]);


  const accionForm = useForm<AccionFormData>({
    resolver: zodResolver(accionFormSchema),
    defaultValues: {
      nombre: '',
      descripcion: '',
      responsable: '',
      area: undefined,
      departamento: undefined,
      puesto: undefined,
      procesoId: undefined,
      procedimientoId: undefined,
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

  const impactForm = useForm<ImpactFormData>({
    resolver: zodResolver(impactFormSchema),
  });
  
  const isReadOnly = useMemo(() => {
    if (!editingAccion) return false;
    return editingAccion.estado === 'Completada' || editingAccion.estado === 'Cancelada';
  }, [editingAccion]);

  const watchedArea = accionForm.watch('area');
  const watchedDepartamento = accionForm.watch('departamento');
  
  useEffect(() => {
    if (actionToComplete) {
      let activitiesFound: Actividad[] = [];
      if (actionToComplete.actividadId) {
        const act = actividades.find(a => a.id === actionToComplete.actividadId);
        if (act) activitiesFound.push(act);
      } else if (actionToComplete.procedimientoId) {
        const proc = procedimientos.find(p => p.id === actionToComplete.procedimientoId);
        if (proc && proc.activityOrder) {
          activitiesFound = proc.activityOrder.map(actId => actividades.find(a => a.id === actId)).filter((a): a is Actividad => !!a);
        }
      } else if (actionToComplete.procesoId) {
        const proc = capturedProcesses.find(p => p.id === actionToComplete.procesoId);
        if (proc && proc.procedimientoOrder) {
          const proceduresInProcess = proc.procedimientoOrder.map(procId => procedimientos.find(p => p.id === procId)).filter((p): p is Procedimiento => !!p);
          const activityIds = new Set(proceduresInProcess.flatMap(p => p.activityOrder || []));
          activitiesFound = Array.from(activityIds).map(actId => actividades.find(a => a.id === actId)).filter((a): a is Actividad => !!a);
        }
      }
      setAffectedActivities(activitiesFound);
      impactForm.reset({
        affectedActivities: activitiesFound.map(act => ({
          id: act.id,
          nombre: act.nombre,
          tiempoEstimadoActual: act.tiempoEstimado,
          costoEstimadoActual: act.costoEstimado,
          nuevoTiempoEstimado: act.tiempoEstimado,
          nuevoCostoEstimado: act.costoEstimado,
        }))
      });
      setIsImpactDialogOpen(true);
    }
  }, [actionToComplete, actividades, procedimientos, capturedProcesses, impactForm]);


  const availableDepartamentos = useMemo(() => {
    if (!watchedArea || isLoadingDepartamentos || isLoadingAreas) return [];
    const areaId = areas.find(a => a.nombre === watchedArea)?.id;
    if (!areaId) return [];
    return departamentos.filter(d => d.areaId === areaId);
  }, [watchedArea, areas, departamentos, isLoadingDepartamentos, isLoadingAreas]);

  const availablePuestos = useMemo(() => {
    if (!watchedArea || isLoadingPuestos || isLoadingAreas) return [];
    const areaId = areas.find(a => a.nombre === watchedArea)?.id;
    if (!areaId) return [];
    
    let puestosFiltrados = puestos.filter(p => p.areaId === areaId);
    if (watchedDepartamento && watchedDepartamento !== NO_DEPARTAMENTO_SELECTED) {
        const deptoId = departamentos.find(d => d.areaId === areaId && d.nombre === watchedDepartamento)?.id;
        if(deptoId) {
            puestosFiltrados = puestosFiltrados.filter(p => p.departamentoId === deptoId);
        } else {
            puestosFiltrados = [];
        }
    }
    return puestosFiltrados;
  }, [watchedArea, watchedDepartamento, areas, departamentos, puestos, isLoadingPuestos, isLoadingAreas]);


  const watchedProcesoId = accionForm.watch('procesoId');
  const watchedProcedimientoId = accionForm.watch('procedimientoId');
  const watchedActividadId = accionForm.watch('actividadId');

  useEffect(() => {
    if (watchedProcesoId && watchedProcesoId !== NO_ELEMENTO_SELECTED) {
        accionForm.setValue('procedimientoId', undefined);
        accionForm.setValue('actividadId', undefined);
        const process = capturedProcesses.find(p => p.id === watchedProcesoId);
        if (process) {
            accionForm.setValue('area', process.area);
            accionForm.setValue('departamento', process.departamento);
            accionForm.setValue('puesto', process.puesto);
        }
    }
  }, [watchedProcesoId, accionForm, capturedProcesses]);
  
  useEffect(() => {
    if (watchedProcedimientoId && watchedProcedimientoId !== NO_ELEMENTO_SELECTED) {
      accionForm.setValue('procesoId', undefined);
      accionForm.setValue('actividadId', undefined);
      const procedure = procedimientos.find(p => p.id === watchedProcedimientoId);
      if (procedure) {
        const parentProcess = capturedProcesses.find(p => p.id === procedure.procesoId);
        if (parentProcess) {
          accionForm.setValue('area', parentProcess.area);
          accionForm.setValue('departamento', parentProcess.departamento);
          accionForm.setValue('puesto', parentProcess.puesto);
        }
      }
    }
  }, [watchedProcedimientoId, accionForm, procedimientos, capturedProcesses]);

  useEffect(() => {
     if (watchedActividadId && watchedActividadId !== NO_ELEMENTO_SELECTED) {
        accionForm.setValue('procesoId', undefined);
        accionForm.setValue('procedimientoId', undefined);
     }
  }, [watchedActividadId, accionForm]);


  useEffect(() => {
    if (isAccionDialogOpen) {
      if (editingAccion) {
        accionForm.reset({
          ...editingAccion,
          area: editingAccion.area || undefined,
          departamento: editingAccion.departamento || undefined,
          puesto: editingAccion.puesto || undefined,
          procesoId: editingAccion.procesoId || undefined,
          procedimientoId: editingAccion.procedimientoId || undefined,
          actividadId: editingAccion.actividadId || undefined,
          fechaObjetivo: editingAccion.fechaObjetivo ? parseISO(editingAccion.fechaObjetivo) : undefined,
          fechaFinalizacion: editingAccion.fechaFinalizacion ? parseISO(editingAccion.fechaFinalizacion) : undefined,
        });
      } else {
        accionForm.reset();
      }
    }
  }, [editingAccion, isAccionDialogOpen, accionForm]);

  async function handleAccionSubmit(data: AccionFormData) {
    const isQuantitativeAction = data.procesoId || data.procedimientoId || data.actividadId;
    
    if (data.estado === 'Completada' && editingAccion && isQuantitativeAction) {
        setActionToComplete(editingAccion);
        setIsAccionDialogOpen(false);
        return;
    }

    const dataToSave = {
        ...data,
        area: data.area || undefined,
        departamento: data.departamento || undefined,
        puesto: data.puesto || undefined,
        procesoId: data.procesoId === NO_ELEMENTO_SELECTED ? undefined : data.procesoId,
        procedimientoId: data.procedimientoId === NO_ELEMENTO_SELECTED ? undefined : data.procedimientoId,
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
  
  const handleImpactSubmit = async (data: ImpactFormData) => {
    if (!actionToComplete) return;

    const historialImpacto: CambioHistorial[] = [];
    let totalAhorroTiempo = 0;
    let totalAhorroCosto = 0;
    
    for (const updatedAct of data.affectedActivities) {
        const originalAct = affectedActivities.find(a => a.id === updatedAct.id);
        if (!originalAct) continue;
        
        let changes: Partial<Actividad> = {};
        if (originalAct.tiempoEstimado !== updatedAct.nuevoTiempoEstimado && updatedAct.nuevoTiempoEstimado !== undefined) {
            changes.tiempoEstimado = updatedAct.nuevoTiempoEstimado;
            const ahorro = (originalAct.tiempoEstimado || 0) - (updatedAct.nuevoTiempoEstimado || 0);
            if(ahorro > 0) totalAhorroTiempo += ahorro;
        }

        if (originalAct.costoEstimado !== updatedAct.nuevoCostoEstimado && updatedAct.nuevoCostoEstimado !== undefined) {
            changes.costoEstimado = updatedAct.nuevoCostoEstimado;
            const ahorro = (originalAct.costoEstimado || 0) - (updatedAct.nuevoCostoEstimado || 0);
            if(ahorro > 0) totalAhorroCosto += ahorro;
        }

        if (Object.keys(changes).length > 0) {
            await updateActividadContext(updatedAct.id, changes);
        }
    }
    
    if (totalAhorroTiempo > 0) {
      historialImpacto.push({
        timestamp: new Date().toISOString(),
        field: 'Ahorro de Tiempo Calculado',
        before: 'N/A',
        after: `${totalAhorroTiempo}`,
      });
    }

    if (totalAhorroCosto > 0) {
      historialImpacto.push({
        timestamp: new Date().toISOString(),
        field: 'Ahorro de Costo Calculado',
        before: 'N/A',
        after: `${totalAhorroCosto}`,
      });
    }

    await updateAccion(actionToComplete.id, { estado: 'Completada', fechaFinalizacion: new Date().toISOString() }, historialImpacto);

    toast({ title: '¡Mejora Completada!', description: 'El impacto se ha registrado y la acción se marcó como completada.' });
    setIsImpactDialogOpen(false);
    setActionToComplete(null);
  };


  function handleEditAccion(accion: Accion) {
    if(accion.estado === 'Completada' || accion.estado === 'Cancelada'){
        toast({ title: 'Visualizando Acción', description: 'Las acciones completadas o canceladas solo se pueden visualizar.', variant: 'default' });
    }
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
                if (acc.procedimientoId) return `PC: ${procedimientos.find(pc => pc.id === acc.procedimientoId)?.nombre || ''}`;
                if (acc.actividadId) return `A: ${actividades.find(ac => ac.id === ac.actividadId)?.nombre || ''}`;
                if (acc.puesto) return `U: ${acc.puesto}`;
                if (acc.area) return `B: ${acc.area}`;
                return '';
            };
            valA = getElementName(a);
            valB = getElementName(b);
        } else {
            valA = a[sortConfig.key as keyof Accion];
            valB = b[sortConfig.key as keyof Accion];
        }

        if (['fechaObjetivo', 'updatedAt'].includes(sortConfig.key)) {
            valA = valA ? (isValid(parseISO(String(valA))) ? parseISO(String(valA)).getTime() : (typeof valA === 'number' ? valA : 0)) : 0;
            valB = valB ? (isValid(parseISO(String(valB))) ? parseISO(String(valB)).getTime() : (typeof valB === 'number' ? valB : 0)) : 0;
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
        filtered.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }
    return filtered;

  }, [acciones, searchTerm, statusFilter, sortConfig, capturedProcesses, procedimientos, actividades, areaFilter, puestoFilter]);
  
  const getSavings = (accion: Accion) => {
    if (accion.estado === 'Completada' && accion.historialDeCambios) {
      const ahorroTiempoReal = accion.historialDeCambios.find(h => h.field === 'Ahorro de Tiempo Calculado')?.after;
      const ahorroCostoReal = accion.historialDeCambios.find(h => h.field === 'Ahorro de Costo Calculado')?.after;
      
      const tiempo = ahorroTiempoReal ? Number(ahorroTiempoReal) : undefined;
      const costo = ahorroCostoReal ? Number(ahorroCostoReal) : undefined;
      
      return {
        tiempo,
        costo,
        moneda: costo !== undefined ? accion.monedaAhorro : undefined,
      };
    }
    return {
      tiempo: accion.ahorroTiempoEstimado,
      costo: accion.ahorroEstimado,
      moneda: accion.monedaAhorro,
    };
  };


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
      "Proceso Asociado", "Procedimiento Asociado", "Actividad Asociada",
      "Estado", "Fecha Objetivo", "Fecha Finalización", "Ahorro Anual (Calculado/Estimado)", "Moneda Ahorro", 
      "Ahorro Tiempo (Calculado/Estimado)", "Unidad Tiempo Ahorro",
      "Origen Mejora", "Fecha Creación", "Última Modificación"
    ];

    const csvRows = [
      headers.join(','),
      ...sortedAndFilteredAcciones.map(acc => {
        const procName = acc.procesoId ? capturedProcesses.find(p => p.id === acc.procesoId)?.proceso : '';
        const procManualName = acc.procedimientoId ? procedimientos.find(p => p.id === acc.procedimientoId)?.nombre : '';
        const actName = acc.actividadId ? actividades.find(a => a.id === acc.actividadId)?.nombre : '';
        const savings = getSavings(acc);

        return [
          escapeCsvCell(acc.id),
          escapeCsvCell(acc.nombre),
          escapeCsvCell(acc.descripcion),
          escapeCsvCell(acc.responsable),
          escapeCsvCell(acc.area),
          escapeCsvCell(acc.puesto),
          escapeCsvCell(procName),
          escapeCsvCell(procManualName),
          escapeCsvCell(actName),
          escapeCsvCell(acc.estado),
          escapeCsvCell(acc.fechaObjetivo && isValid(parseISO(acc.fechaObjetivo)) ? format(parseISO(acc.fechaObjetivo), 'yyyy-MM-dd') : ''),
          escapeCsvCell(acc.fechaFinalizacion && isValid(parseISO(acc.fechaFinalizacion)) ? format(parseISO(acc.fechaFinalizacion), 'yyyy-MM-dd') : ''),
          escapeCsvCell(savings.costo),
          escapeCsvCell(savings.moneda),
          escapeCsvCell(savings.tiempo),
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


  if (isLoadingAcciones || isLoadingProcesos || isLoadingActividades || isLoadingProcedimientos) {
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
                    <Button onClick={() => { setIsAccionDialogOpen(true); }} className="w-full">
                      <PlusCircle className="mr-2 h-4 w-4" /> Agregar
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-3xl">
                    <DialogHeader>
                      <DialogTitle>{isReadOnly ? 'Detalles de la Acción' : (editingAccion ? 'Editar Acción de Mejora' : 'Agregar Nueva Acción de Mejora')}</DialogTitle>
                      <DialogDescription>
                        {isReadOnly ? 'Visualizando los detalles de una acción finalizada.' : (editingAccion ? 'Modifica los detalles de la acción.' : 'Completa la información para registrar una nueva acción.')}
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
                              <FormControl><Input placeholder="Ej: Implementar nuevo CRM" {...field} disabled={isReadOnly} /></FormControl>
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
                              <FormControl><Textarea placeholder="Describe el objetivo, alcance y pasos clave de la acción." {...field} className="min-h-[100px]" disabled={isReadOnly} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                           <FormField
                            control={accionForm.control}
                            name="procesoId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Proceso Asociado</FormLabel>
                                <Combobox
                                  options={[
                                    { value: NO_ELEMENTO_SELECTED, label: "Ninguno" },
                                    ...capturedProcesses.filter(p => p.activo !== false).map(proc => ({ value: proc.id, label: proc.proceso }))
                                  ]}
                                  value={field.value}
                                  onChange={field.onChange}
                                  placeholder="Seleccione un proceso"
                                  searchPlaceholder="Buscar proceso..."
                                  disabled={isReadOnly || !!(watchedProcedimientoId && watchedProcedimientoId !== NO_ELEMENTO_SELECTED) || !!(watchedActividadId && watchedActividadId !== NO_ELEMENTO_SELECTED)}
                                />
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={accionForm.control}
                            name="procedimientoId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Procedimiento Asociado</FormLabel>
                                <Combobox
                                  options={[
                                    { value: NO_ELEMENTO_SELECTED, label: "Ninguno" },
                                    ...procedimientos.filter(p => p.activo).map(proc => ({ value: proc.id, label: `${proc.codigo} - ${proc.nombre}` }))
                                  ]}
                                  value={field.value}
                                  onChange={field.onChange}
                                  placeholder="Seleccione un procedimiento"
                                  searchPlaceholder="Buscar procedimiento..."
                                  disabled={isReadOnly || !!(watchedProcesoId && watchedProcesoId !== NO_ELEMENTO_SELECTED) || !!(watchedActividadId && watchedActividadId !== NO_ELEMENTO_SELECTED)}
                                />
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={accionForm.control}
                            name="actividadId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Actividad Asociada</FormLabel>
                                <Combobox
                                  options={[
                                    { value: NO_ELEMENTO_SELECTED, label: "Ninguna" },
                                    ...actividades.filter(a => a.activa).map(act => ({ value: act.id, label: act.nombre }))
                                  ]}
                                  value={field.value}
                                  onChange={field.onChange}
                                  placeholder="Seleccione una actividad"
                                  searchPlaceholder="Buscar actividad..."
                                  disabled={isReadOnly || !!(watchedProcesoId && watchedProcesoId !== NO_ELEMENTO_SELECTED) || !!(watchedProcedimientoId && watchedProcedimientoId !== NO_ELEMENTO_SELECTED)}
                                />
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormDescription className="text-xs text-center !mt-2 pt-1">
                          Opcional: La acción puede vincularse a un solo elemento (proceso, procedimiento o actividad).
                        </FormDescription>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={accionForm.control}
                            name="responsable"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Responsable</FormLabel>
                                <Combobox
                                  options={puestos.map(p => ({ value: p.nombre, label: p.nombre }))}
                                  value={field.value}
                                  onChange={field.onChange}
                                  placeholder="Seleccione un puesto responsable"
                                  searchPlaceholder="Buscar puesto..."
                                  disabled={isReadOnly}
                                />
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
                                <Select onValueChange={field.onChange} value={field.value} disabled={isReadOnly}>
                                  <FormControl><SelectTrigger><SelectValue placeholder="Seleccione un estado" /></SelectTrigger></FormControl>
                                  <SelectContent>
                                    {accionEstados.map(estado => (<SelectItem key={estado} value={estado} disabled={isReadOnly}>{estado}</SelectItem>))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <FormField
                            control={accionForm.control}
                            name="area"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Área (Opcional)</FormLabel>
                                <Select
                                  onValueChange={(value) => {
                                      field.onChange(value === NO_AREA_SELECTED ? undefined : value);
                                      accionForm.setValue('departamento', undefined);
                                      accionForm.setValue('puesto', undefined);
                                  }}
                                  value={field.value || NO_AREA_SELECTED}
                                  disabled={isLoadingAreas || isReadOnly}
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
                            name="departamento"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Departamento (Opcional)</FormLabel>
                                    <Select
                                        onValueChange={(value) => {
                                            field.onChange(value === NO_DEPARTAMENTO_SELECTED ? undefined : value);
                                            accionForm.setValue('puesto', undefined);
                                        }}
                                        value={field.value || NO_DEPARTAMENTO_SELECTED}
                                        disabled={isLoadingDepartamentos || isReadOnly || !watchedArea}
                                    >
                                        <FormControl><SelectTrigger><SelectValue placeholder={!watchedArea ? "Seleccione un área" : "Seleccione un depto"} /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value={NO_DEPARTAMENTO_SELECTED}>Ninguno</SelectItem>
                                            {availableDepartamentos.map(depto => (<SelectItem key={depto.id} value={depto.nombre}>{depto.nombre}</SelectItem>))}
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
                                  disabled={isLoadingPuestos || isReadOnly || !watchedArea}
                                >
                                  <FormControl><SelectTrigger><SelectValue placeholder={!watchedArea ? "Seleccione un área" : "Seleccione un puesto"} /></SelectTrigger></FormControl>
                                  <SelectContent>
                                      <SelectItem value={NO_PUESTO_SELECTED}>Ninguno</SelectItem>
                                      {availablePuestos.map(puesto => (<SelectItem key={puesto.id} value={puesto.nombre}>{puesto.nombre}</SelectItem>))}
                                  </SelectContent>
                                </Select>
                                <FormDescription className="text-xs">Puestos filtrados por área/depto.</FormDescription>
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
                                      <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")} disabled={isReadOnly}>
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
                                      <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")} disabled={isReadOnly}>
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
                                  <FormControl><Input type="number" placeholder="Ej: 5000" {...field} value={field.value ?? ''} className="pl-9" min="0" step="any" disabled={isReadOnly} /></FormControl>
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
                                <Select onValueChange={field.onChange} value={field.value} disabled={isReadOnly || !accionForm.watch('ahorroEstimado') || accionForm.watch('ahorroEstimado') === 0}>
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
                                  <FormControl><Input type="number" placeholder="Ej: 40" {...field} value={field.value ?? ''} className="pl-9" min="0" step="1" disabled={isReadOnly} /></FormControl>
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
                                <Select onValueChange={field.onChange} value={field.value} disabled={isReadOnly || !accionForm.watch('ahorroTiempoEstimado') || accionForm.watch('ahorroTiempoEstimado') === 0}>
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
                              <FormControl><Input placeholder="Ej: Análisis IA Q2, Sugerencia Cliente X" {...field} value={field.value ?? ''} disabled={isReadOnly} /></FormControl>
                              <FormDescription>Indique de dónde surgió esta acción de mejora.</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <DialogFooter>
                          <DialogClose asChild>
                            <Button type="button" variant="outline">{isReadOnly ? 'Cerrar' : 'Cancelar'}</Button>
                          </DialogClose>
                          {!isReadOnly && <Button type="submit">{editingAccion ? 'Guardar Cambios' : 'Agregar Acción'}</Button>}
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
                    const linkedProcedimiento = accion.procedimientoId ? procedimientos.find(p => p.id === accion.procedimientoId) : null;
                    const linkedActivity = accion.actividadId ? actividades.find(a => a.id === accion.actividadId) : null;
                    const isOverdue = 
                        isClient &&
                        (accion.estado === 'Pendiente' || accion.estado === 'En Progreso') && 
                        accion.fechaObjetivo &&
                        isValid(parseISO(accion.fechaObjetivo)) &&
                        parseISO(accion.fechaObjetivo) < new Date(new Date().setHours(0, 0, 0, 0));
                    
                    const isFromAudit = accion.origenMejora?.includes('Auditoría');
                    const canBeDeleted = !isFromAudit && accion.estado === 'En Revisión';
                    const isLockedForEditing = accion.estado === 'Completada' || accion.estado === 'Cancelada';
                    
                    const savings = getSavings(accion);

                    return (
                    <TableRow key={`${accion.id}-${index}`}>
                      <TableCell className="font-medium">{accion.nombre}</TableCell>
                       <TableCell className="text-xs">
                          {linkedProcess ? (
                              <Badge variant="outline" className="flex items-center gap-1.5"><WorkflowIcon className="h-3 w-3"/>P: {linkedProcess.proceso}</Badge>
                          ) : linkedProcedimiento ? (
                            <Badge variant="secondary" className="flex items-center gap-1.5"><ListChecks className="h-3 w-3"/>PC: {linkedProcedimiento.nombre}</Badge>
                          ) : linkedActivity ? (
                              <Badge variant="secondary" className="flex items-center gap-1.5"><ListChecks className="h-3 w-3"/>A: {linkedActivity.nombre}</Badge>
                          ) : accion.puesto ? (
                            <Badge variant="outline" className="flex items-center gap-1.5 bg-purple-100 dark:bg-purple-900/50 border-purple-300 dark:border-purple-700"><UsersIcon className="h-3 w-3"/>U: {accion.puesto}</Badge>
                          ) : accion.area ? (
                            <Badge variant="outline" className="flex items-center gap-1.5 bg-teal-100 dark:bg-teal-900/50 border-teal-300 dark:border-teal-700"><Building className="h-3 w-3"/>B: {accion.area}</Badge>
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
                      <TableCell className="text-right">{formatCurrencyDisplay(savings.costo, savings.moneda)}</TableCell>
                      <TableCell className="text-right">{formatMinutesToHours(savings.tiempo)}</TableCell>
                       <TableCell className="text-center text-xs text-muted-foreground">
                        {isValid(new Date(accion.updatedAt)) ? format(new Date(accion.updatedAt), 'dd/MM/yy HH:mm', { locale: es }) : '-'}
                      </TableCell>
                       <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleViewHistory(accion)} className="mr-1" disabled={!accion.historialDeCambios || accion.historialDeCambios.length === 0}>
                          <History className="h-4 w-4" />
                        </Button>
                        <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleEditAccion(accion)}
                                    className="mr-1"
                                  >
                                    {isLockedForEditing ? <Eye className="h-4 w-4" /> : <Edit2 className="h-4 w-4" />}
                                  </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                  <p>{isLockedForEditing ? 'Ver Detalles (Solo Lectura)' : 'Editar Acción'}</p>
                              </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
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
                                  {canBeDeleted ? <Trash2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
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

       <Dialog open={isImpactDialogOpen} onOpenChange={setIsImpactDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <Form {...impactForm}>
            <form onSubmit={impactForm.handleSubmit(handleImpactSubmit)}>
              <DialogHeader>
                <DialogTitle>Registrar Impacto de la Mejora</DialogTitle>
                <DialogDescription>
                  ¡Felicidades por completar la acción! Por favor, actualice los nuevos tiempos y/o costos para las actividades afectadas.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4 max-h-[60vh] overflow-y-auto pr-2">
                {affectedActivities.length > 0 ? (
                  <div className="space-y-4">
                    {impactForm.getValues('affectedActivities').map((field, index) => (
                      <Card key={field.id} className="p-4">
                        <p className="font-semibold mb-2">{field.nombre}</p>
                        <div className="grid grid-cols-2 gap-4">
                           <FormField
                            control={impactForm.control}
                            name={`affectedActivities.${index}.nuevoTiempoEstimado`}
                            render={({ field: formField }) => (
                                <FormItem>
                                    <FormLabel className="text-xs">Tiempo (min)</FormLabel>
                                    <div className="text-xs text-muted-foreground">
                                    Actual: {formatMinutesToHours(field.tiempoEstimadoActual) || 'N/A'}
                                    </div>
                                    <div className="relative">
                                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <FormControl>
                                        <Input type="number" placeholder="Nuevo Tiempo" {...formField} value={formField.value ?? ''} className="pl-9"/>
                                    </FormControl>
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                           />
                           <FormField
                            control={impactForm.control}
                            name={`affectedActivities.${index}.nuevoCostoEstimado`}
                            render={({ field: formField }) => (
                                <FormItem>
                                    <FormLabel className="text-xs">Costo / Ejecución</FormLabel>
                                    <div className="text-xs text-muted-foreground">
                                    Actual: {formatCurrencyDisplay(field.costoEstimadoActual, actividades.find(a => a.id === field.id)?.monedaCosto) || 'N/A'}
                                    </div>
                                    <div className="relative">
                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <FormControl>
                                        <Input type="number" placeholder="Nuevo Costo" {...formField} value={formField.value ?? ''} className="pl-9"/>
                                    </FormControl>
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                           />
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground p-6 bg-muted/20 rounded-lg">
                    No se encontraron actividades directamente vinculadas a esta acción para registrar impacto.
                  </div>
                )}
              </div>
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
                <Button type="submit"><Save className="mr-2 h-4 w-4"/>Guardar y Completar Acción</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Historial de Cambios para: {actionForHistory?.nombre}</DialogTitle>
            <DialogDescription>
              Registro de las mejoras aplicadas al completar esta acción. Mostrando los últimos 20 cambios.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 max-h-[60vh] overflow-y-auto">
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
                  {actionForHistory.historialDeCambios
                    .sort((a, b) => parseISO(b.timestamp).getTime() - parseISO(a.timestamp).getTime())
                    .slice(0, 20)
                    .map((cambio, index) => (
                    <TableRow key={index}>
                      <TableCell className="text-xs">{format(parseISO(cambio.timestamp), 'dd/MM/yy HH:mm', { locale: es })}</TableCell>
                      <TableCell>{cambio.field}</TableCell>
                      <TableCell className="text-right">{formatHistoryValue(cambio.field, cambio.before, actionForHistory)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatHistoryValue(cambio.field, cambio.after, actionForHistory)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-center">No hay historial de cambios registrado para esta acción.</p>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">Cerrar</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

