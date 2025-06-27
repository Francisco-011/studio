

'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Database, Search, Trash2, AlertTriangle, FileText, FileX, Edit2, RotateCcw, Filter, ChevronsUpDown, ArrowUp, ArrowDown, DollarSign, Clock, Info, ChevronRight, Save, ChevronDown, History } from "lucide-react";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

import type { CapturaFormData } from '../captura/page';
import { toast } from '@/hooks/use-toast';
import { cn, formatMinutesToHours } from '@/lib/utils';
import { useAreas } from '@/contexts/AreasContext';
import { useDepartamentos } from '@/contexts/DepartamentosContext';
import { usePuestos } from '@/contexts/PuestosContext';
import { useActividades, type Actividad } from '@/contexts/ActividadesContext';
import { useSistemasCostos } from '@/contexts/SistemasCostosContext';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useActivityLog } from '@/contexts/ActivityLogContext';


export interface CambioHistorial {
  timestamp: string;
  field: string;
  before: any;
  after: any;
}

export interface CapturedProcess extends CapturaFormData {
  id: string;
  capturedAt: string;
  updatedAt?: number;
  deletedAt?: string;
  activo?: boolean;
  historialDeCambios?: CambioHistorial[];
}

const CAPTURED_DATA_LOCAL_STORAGE_KEY = 'proceza-captured-data';
const SPECIAL_ENTRADA_OPTION = "Iniciador";
const SPECIAL_SALIDA_OPTION = "Finalizador";
const NO_DEPARTAMENTO_SELECTED = "__NO_DEPARTAMENTO__";


const frecuenciaOptions: readonly string[] = ["Diario", "Semanal", "Quincenal", "Mensual", "Bimestral", "Trimestral", "Semestral", "Anual", "A demanda", "Otro"];
const monedaOptions: readonly string[] = ["USD", "MXN", "EUR", "CAD", "GBP"];


const capturaFormSchema = z.object({
  area: z.string().min(1, "El área es requerida."),
  departamento: z.string().optional(),
  puesto: z.string().min(1, "El puesto es requerido."),
  proceso: z.string().min(3, "El nombre del proceso es requerido y debe tener al menos 3 caracteres."),
  descripcion: z.string().min(1, "La descripción del proceso es requerida."),
  frecuencia: z.enum(frecuenciaOptions as [string, ...string[]], { errorMap: () => ({ message: "Seleccione una frecuencia válida."}) }),
  tiempoEstimado: z.preprocess(
    (val) => (String(val).trim() === '' ? undefined : parseInt(String(val), 10)),
    z.number().int("El tiempo debe ser un número entero.").nonnegative("El tiempo estimado debe ser un número positivo o cero.").optional()
  ),
  tiempoIdeal: z.preprocess(
    (val) => (String(val).trim() === '' ? undefined : parseInt(String(val), 10)),
    z.number().int("El tiempo debe ser un número entero.").nonnegative("El tiempo ideal debe ser un número positivo o cero.").optional()
  ),
  costoEstimado: z.preprocess(
    (val) => (String(val).trim() === '' ? undefined : parseFloat(String(val))),
    z.number().nonnegative("El costo estimado debe ser un número positivo.").optional()
  ),
  costoIdeal: z.preprocess(
    (val) => (String(val).trim() === '' ? undefined : parseFloat(String(val))),
    z.number().nonnegative("El costo ideal debe ser un número positivo.").optional()
  ),
  monedaCosto: z.enum(monedaOptions as [string, ...string[]]).optional(),
  sistemas: z.array(z.string()).optional().default([]),
  informacionRecibe: z.string().min(1, "La descripción de la información que recibe es requerida."),
  procesosEntrada: z.array(z.string()).optional().default([]),
  informacionEntrega: z.string().min(1, "La descripción de la información que entrega es requerida."),
  procesosSalida: z.array(z.string()).optional().default([]),
  activityOrder: z.array(z.string()).optional().default([]),
}).refine(data => {
  if ((data.costoEstimado !== undefined || data.costoIdeal !== undefined) && !data.monedaCosto) {
    return false;
  }
  return true;
}, {
  message: "Debe seleccionar una moneda si especifica un costo.",
  path: ["monedaCosto"],
});


type ActivityCountFilterType = 'all' | 'none' | 'some';
type SortableProcessKeys = 'proceso' | 'area' | 'departamento' | 'puesto' | 'frecuencia' | 'tiempoEstimado' | 'costoEstimado' | 'updatedAt' | 'activo' | 'numActividades';
type SortDirection = 'ascending' | 'descending';

interface SortConfig {
  key: SortableProcessKeys;
  direction: SortDirection;
}

const ITEMS_PER_PAGE = 10;

const DetailDisplay = ({ title, value, isList = false, isTextarea = false }: { title: string, value?: string | string[] | number | null, isList?: boolean, isTextarea?: boolean }) => {
  if (value === undefined || value === null || (isList && Array.isArray(value) && value.length === 0) || (typeof value === 'string' && value.trim() === '' && !isTextarea && !isList)) {
    return null;
  }
  return (
    <div className="text-sm">
      <strong className="font-semibold text-foreground/90">{title}:</strong>
      {isList && Array.isArray(value) ? (
        <div className="flex flex-wrap gap-1 mt-1">
          {value.map((item, idx) => (
            <Badge key={idx} variant="secondary">{item}</Badge>
          ))}
        </div>
      ) : (
        <p className={cn("text-muted-foreground", isTextarea && "whitespace-pre-wrap mt-1")}>{typeof value === 'number' ? value.toString() : value}</p>
      )}
    </div>
  );
};


export default function ProcesosYFlujosRegistradosPage() {
  const router = useRouter();
  const { areas, isLoading: isLoadingAreas } = useAreas();
  const { departamentos, isLoading: isLoadingDepartamentos } = useDepartamentos();
  const { puestos, isLoadingPuestos } = usePuestos();
  const { actividades: allActivities, isLoadingActividades } = useActividades();
  const { sistemas: allConfiguredSistemas, isLoadingSistemasCostos } = useSistemasCostos();
  const { addLogEntry } = useActivityLog();
  
  const [allCapturedData, setAllCapturedData] = useState<CapturedProcess[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAreaFilter, setSelectedAreaFilter] = useState('all');
  const [selectedDeptoFilter, setSelectedDeptoFilter] = useState('all');
  const [selectedPuestoFilter, setSelectedPuestoFilter] = useState('all');
  const [processStatusFilter, setProcessStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [activityCountFilter, setActivityCountFilter] = useState<ActivityCountFilterType>('all');
  const [activityStatusFilter, setActivityStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [isLoading, setIsLoading] = useState(true);
  
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingProcess, setEditingProcess] = useState<CapturedProcess | null>(null);

  const [processToDelete, setProcessToDelete] = useState<CapturedProcess | null>(null);
  const [isConfirmDeleteProcessOpen, setIsConfirmDeleteProcessOpen] = useState(false);
  const [isRecoveryDialogOpen, setIsRecoveryDialogOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [processForHistory, setProcessForHistory] = useState<CapturedProcess | null>(null);

  const handleEditActivity = (activityName: string) => {
    router.push(`/actividades?search=${encodeURIComponent(activityName)}`);
  };

  const editForm = useForm<CapturaFormData>({
    resolver: zodResolver(capturaFormSchema),
  });

  const { watch: watchEditForm, setValue: setEditValue } = editForm;
  const watchedEditAreaName = watchEditForm('area');
  const watchedEditDepartamentoName = watchEditForm('departamento');

  const filteredEditDepartamentos = useMemo(() => {
    if (!watchedEditAreaName || isLoadingDepartamentos || isLoadingAreas) return [];
    const areaId = areas.find(a => a.nombre === watchedEditAreaName)?.id;
    if (!areaId) return [];
    return departamentos.filter(d => d.areaId === areaId);
  }, [watchedEditAreaName, areas, departamentos, isLoadingDepartamentos, isLoadingAreas]);

  const filteredEditPuestos = useMemo(() => {
    if (!watchedEditAreaName || isLoadingPuestos || isLoadingAreas) return [];
    const areaId = areas.find(a => a.nombre === watchedEditAreaName)?.id;
    if (!areaId) return [];
    const puestosInArea = puestos.filter(p => p.areaId === areaId);
    if (watchedEditDepartamentoName && watchedEditDepartamentoName !== NO_DEPARTAMENTO_SELECTED) {
      const deptoId = departamentos.find(d => d.nombre === watchedEditDepartamentoName && d.areaId === areaId)?.id;
      if (deptoId) return puestosInArea.filter(p => p.departamentoId === deptoId);
    }
    if (watchedEditDepartamentoName === NO_DEPARTAMENTO_SELECTED) {
       return puestosInArea.filter(p => !p.departamentoId);
    }
    return puestosInArea;
  }, [watchedEditAreaName, watchedEditDepartamentoName, areas, departamentos, puestos, isLoadingPuestos, isLoadingAreas, isLoadingDepartamentos]);

  const availableEditSistemas = useMemo(() => {
    if (isLoadingSistemasCostos || isLoadingAreas || isLoadingPuestos || isLoadingDepartamentos) return [];
    const selectedAreaObj = areas.find(a => a.nombre === watchedEditAreaName);
    const selectedDeptoObj = departamentos.find(d => d.nombre === watchedEditDepartamentoName && d.areaId === selectedAreaObj?.id);
    const selectedPuestoObj = puestos.find(p => p.nombre === editForm.getValues('puesto') && p.areaId === selectedAreaObj?.id);
    return allConfiguredSistemas.filter(sistema => {
      if (sistema.scope === "Empresa") return true;
      if (sistema.scope === "Área" && selectedAreaObj && sistema.scopeId === selectedAreaObj.id) return true;
      if (sistema.scope === "Departamento" && selectedDeptoObj && sistema.scopeId === selectedDeptoObj.id) return true;
      if (sistema.scope === "Puesto" && selectedPuestoObj && sistema.scopeId === selectedPuestoObj.id) return true;
      return false;
    });
  }, [allConfiguredSistemas, watchedEditAreaName, watchedEditDepartamentoName, editForm, areas, departamentos, puestos, isLoadingSistemasCostos, isLoadingAreas, isLoadingPuestos, isLoadingDepartamentos]);

  useEffect(() => {
    if (editingProcess) {
      editForm.reset({
        ...editingProcess,
        departamento: editingProcess.departamento || NO_DEPARTAMENTO_SELECTED
      });
    }
  }, [editingProcess, editForm]);


  useEffect(() => {
    setIsLoading(true);
    try {
      const storedData = localStorage.getItem(CAPTURED_DATA_LOCAL_STORAGE_KEY);
      if (storedData) {
        const parsedData: any[] = JSON.parse(storedData);
        const migratedData: CapturedProcess[] = parsedData.map(p => {
          const newP: any = {
            ...p,
            activo: p.activo === undefined ? true : p.activo,
            activityOrder: p.activityOrder || [],
            updatedAt: p.updatedAt || (p.capturedAt ? parseISO(p.capturedAt).getTime() : Date.now()),
            historialDeCambios: p.historialDeCambios || [],
          };
          if (!newP.procesosEntrada && p.formatosRecibe) { newP.procesosEntrada = Array.isArray(p.formatosRecibe) ? p.formatosRecibe : [p.formatosRecibe]; }
          delete newP.formatosRecibe;
          if (!newP.procesosSalida && p.formatosEntrega) { newP.procesosSalida = Array.isArray(p.formatosEntrega) ? p.formatosEntrega : [p.formatosEntrega]; }
          delete newP.formatosEntrega;
          return newP as CapturedProcess;
        });
        setAllCapturedData(migratedData);
      } else {
        setAllCapturedData([]);
      }
    } catch (error) {
      console.error("Error loading data from localStorage:", error);
      toast({ title: "Error al cargar datos", variant: "destructive" });
      setAllCapturedData([]);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  useEffect(() => {
    if (!isLoading) {
      try {
        localStorage.setItem(CAPTURED_DATA_LOCAL_STORAGE_KEY, JSON.stringify(allCapturedData));
      } catch (error) {
        console.error("Error saving captured data:", error);
        toast({ title: "Error al guardar", variant: "destructive" });
      }
    }
  }, [allCapturedData, isLoading]);
  
  const toggleRow = (id: string) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const availableDepartamentos = useMemo(() => {
    if (isLoadingDepartamentos || selectedAreaFilter === 'all') return departamentos;
    const area = areas.find(a => a.nombre === selectedAreaFilter);
    return area ? departamentos.filter(d => d.areaId === area.id) : [];
  }, [selectedAreaFilter, areas, departamentos, isLoadingDepartamentos]);

  const availablePuestosForFilter = useMemo(() => {
    if (isLoadingPuestos || selectedAreaFilter === 'all') return puestos;

    const areaId = areas.find(a => a.nombre === selectedAreaFilter)?.id;
    if (!areaId) return [];
    
    let areaPuestos = puestos.filter(p => p.areaId === areaId);

    if (selectedDeptoFilter !== 'all') {
      const deptoId = departamentos.find(d => d.nombre === selectedDeptoFilter && d.areaId === areaId)?.id;
      if (deptoId) {
        return areaPuestos.filter(p => p.departamentoId === deptoId);
      }
      return []; 
    }
    
    return areaPuestos;
  }, [puestos, areas, departamentos, selectedAreaFilter, selectedDeptoFilter, isLoadingPuestos]);


  const sortedAndFilteredData = useMemo(() => {
    setCurrentPage(1);
    let dataToFilter = allCapturedData.filter(proc => !proc.deletedAt);

    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      dataToFilter = dataToFilter.filter(proc =>
        proc.proceso.toLowerCase().includes(lowerSearchTerm) ||
        (proc.area && proc.area.toLowerCase().includes(lowerSearchTerm)) ||
        (proc.departamento && proc.departamento.toLowerCase().includes(lowerSearchTerm)) ||
        (proc.puesto && proc.puesto.toLowerCase().includes(lowerSearchTerm)) ||
        proc.descripcion.toLowerCase().includes(lowerSearchTerm)
      );
    }

    if (selectedAreaFilter !== 'all') dataToFilter = dataToFilter.filter(proc => proc.area === selectedAreaFilter);
    if (selectedDeptoFilter !== 'all') dataToFilter = dataToFilter.filter(proc => proc.departamento === selectedDeptoFilter);
    if (selectedPuestoFilter !== 'all') dataToFilter = dataToFilter.filter(proc => proc.puesto === selectedPuestoFilter);
    if (processStatusFilter !== 'all') dataToFilter = dataToFilter.filter(proc => (processStatusFilter === 'active' ? proc.activo !== false : proc.activo === false));
    if (activityCountFilter !== 'all') dataToFilter = dataToFilter.filter(proc => (activityCountFilter === 'none' ? (proc.activityOrder?.length || 0) === 0 : (proc.activityOrder?.length || 0) > 0));
    
    if (sortConfig !== null) {
      dataToFilter.sort((a, b) => {
        let valA: any;
        let valB: any;

        if (sortConfig.key === 'numActividades') { valA = a.activityOrder?.length || 0; valB = b.activityOrder?.length || 0; }
        else if (sortConfig.key === 'updatedAt') { valA = a.updatedAt || 0; valB = b.updatedAt || 0; }
        else if (sortConfig.key === 'activo') { valA = a.activo !== false; valB = b.activo !== false; }
        else { valA = a[sortConfig.key as keyof CapturedProcess]; valB = b[sortConfig.key as keyof CapturedProcess]; }
        
        if (typeof valA === 'string' && typeof valB === 'string') { valA = valA.toLowerCase(); valB = valB.toLowerCase(); }
        if (valA === undefined || valA === null) valA = sortConfig.direction === 'ascending' ? Infinity : -Infinity;
        if (valB === undefined || valB === null) valB = sortConfig.direction === 'ascending' ? Infinity : -Infinity;
        if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    } else {
       dataToFilter.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }
    return dataToFilter;
  }, [allCapturedData, searchTerm, selectedAreaFilter, selectedDeptoFilter, selectedPuestoFilter, processStatusFilter, activityCountFilter, sortConfig]);

  const totalPages = Math.ceil(sortedAndFilteredData.length / ITEMS_PER_PAGE);
  const paginatedData = useMemo(() => sortedAndFilteredData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE), [sortedAndFilteredData, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) setCurrentPage(totalPages);
    else if (currentPage !== 1 && totalPages === 0 && sortedAndFilteredData.length > 0) setCurrentPage(1);
  }, [currentPage, totalPages, sortedAndFilteredData.length]);

  const requestSort = (key: SortableProcessKeys) => {
    let direction: SortDirection = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') direction = 'descending';
    setSortConfig({ key, direction });
  };
  const getSortIcon = (key: SortableProcessKeys) => {
    if (!sortConfig || sortConfig.key !== key) return <ChevronsUpDown className="ml-1 h-3 w-3 opacity-40 group-hover:opacity-100" />;
    return sortConfig.direction === 'ascending' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />;
  };

  const recoverableProcesses = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return allCapturedData.filter(proc => proc.deletedAt && new Date(proc.deletedAt) > thirtyDaysAgo).sort((a,b) => new Date(b.deletedAt!).getTime() - new Date(a.deletedAt!).getTime());
  }, [allCapturedData]);

  const promptDeleteProcess = (proc: CapturedProcess) => { setProcessToDelete(proc); setIsConfirmDeleteProcessOpen(true); };
  
  const executeDeleteProcess = () => {
    if (!processToDelete) return;
    try {
      const updatedData = allCapturedData.map(p => p.id === processToDelete.id ? { ...p, deletedAt: new Date().toISOString(), updatedAt: Date.now() } : p);
      setAllCapturedData(updatedData);
      toast({ title: "Proceso Eliminado", variant: 'destructive' });
      addLogEntry({ action: 'delete', entityType: 'Proceso', entityName: processToDelete.proceso, details: `Proceso "${processToDelete.proceso}" movido a la papelera.`});
    } catch (error) {
      toast({ title: "Error", description: "No se pudo eliminar el proceso.", variant: "destructive"});
    }
    setProcessToDelete(null);
    setIsConfirmDeleteProcessOpen(false);
  };
  const handleRestoreProcess = (id: string) => {
    try {
      let restoredProcessName = '';
      const updatedData = allCapturedData.map(p => {
        if (p.id === id) {
          restoredProcessName = p.proceso;
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { deletedAt, ...restoredProc } = p;
          return { ...restoredProc, activo: true, updatedAt: Date.now() };
        }
        return p;
      });
      setAllCapturedData(updatedData);
      toast({ title: "Proceso Restaurado" });
      addLogEntry({ action: 'restore', entityType: 'Proceso', entityName: restoredProcessName, details: `Se restauró el proceso "${restoredProcessName}".`});
    } catch (error) {
      toast({ title: "Error al Restaurar", variant: "destructive"});
    }
  };

  const handleToggleProcessStatus = (processId: string) => {
    const processToToggle = allCapturedData.find(p => p.id === processId);
    if (!processToToggle) return;
    const targetStatus = !(processToToggle.activo !== false);
    if (targetStatus === false) {
      const linkedActiveActivities = allActivities.filter(act => act.activa && act.procesosAsociadosIds?.includes(processId));
      if (linkedActiveActivities.length > 0) {
        toast({ title: "Inactivación Bloqueada", description: `El proceso no puede inactivarse porque está asociado a ${linkedActiveActivities.length} actividad(es) activa(s).`, variant: "destructive", duration: 7000, });
        return;
      }
    }
    const updatedData = allCapturedData.map(p => p.id === processId ? { ...p, activo: targetStatus, updatedAt: Date.now() } : p);
    setAllCapturedData(updatedData);
    toast({ title: `Proceso ${targetStatus ? 'Activado' : 'Inactivado'}` });
    addLogEntry({ action: 'status_change', entityType: 'Proceso', entityName: processToToggle.proceso, details: `El estado del proceso "${processToToggle.proceso}" cambió a ${targetStatus ? 'Activo' : 'Inactivo'}.`});
  };

  const handleOpenEditDialog = (proc: CapturedProcess) => {
    setEditingProcess(proc);
    setIsEditDialogOpen(true);
  };
  
  function handleViewHistory(proc: CapturedProcess) {
    setProcessForHistory(proc);
    setIsHistoryDialogOpen(true);
  }

  function handleEditSubmit(values: CapturaFormData) {
    if (!editingProcess) return;

    const originalProcess = allCapturedData.find(p => p.id === editingProcess.id);
    if (!originalProcess) {
      toast({ title: "Error", description: "No se encontró el proceso original para comparar cambios.", variant: "destructive" });
      return;
    }
    
    let updatedData = [...allCapturedData];
    const hasNameChanged = originalProcess.proceso !== values.proceso;

    const changes: CambioHistorial[] = [];
    const fieldsToCompare: (keyof CapturaFormData)[] = [
      'proceso', 'area', 'puesto', 'departamento', 'descripcion', 'frecuencia', 
      'tiempoEstimado', 'tiempoIdeal', 'costoEstimado', 'costoIdeal', 'monedaCosto',
      'informacionRecibe', 'informacionEntrega'
    ];

    fieldsToCompare.forEach(key => {
      const originalValue = originalProcess[key as keyof CapturedProcess] ?? '';
      const newValue = values[key as keyof CapturedProcess] ?? '';
      if (originalValue !== newValue) {
        changes.push({
          timestamp: new Date().toISOString(),
          field: key,
          before: originalProcess[key as keyof CapturedProcess] ?? 'No especificado',
          after: values[key as keyof CapturedProcess] ?? 'No especificado'
        });
      }
    });

    const arrayFields: (keyof CapturaFormData)[] = ['sistemas', 'procesosEntrada', 'procesosSalida'];
    arrayFields.forEach(key => {
        const originalValue = JSON.stringify((originalProcess[key as keyof CapturedProcess] as string[] | undefined)?.sort() || []);
        const newValue = JSON.stringify((values[key as keyof CapturedProcess] as string[] | undefined)?.sort() || []);
        if (originalValue !== newValue) {
             changes.push({
                timestamp: new Date().toISOString(),
                field: key,
                before: (originalProcess[key as keyof CapturedProcess] as string[] | undefined)?.join(', ') || 'Ninguno',
                after: (values[key as keyof CapturedProcess] as string[] | undefined)?.join(', ') || 'Ninguno'
             });
        }
    });
    
    // First, update the process being edited.
    let dataWithChanges = allCapturedData.map(p =>
        p.id === editingProcess.id ? {
          ...editingProcess,
          ...values,
          departamento: values.departamento === NO_DEPARTAMENTO_SELECTED ? undefined : values.departamento,
          updatedAt: Date.now(),
          historialDeCambios: [...(p.historialDeCambios || []), ...changes]
        } : p
    );
    
    // Then, if the name changed, cascade the update.
    if (hasNameChanged) {
        const oldName = originalProcess.proceso;
        const newName = values.proceso;
        dataWithChanges = dataWithChanges.map(p => {
            if (p.id === editingProcess.id) return p; // Skip the just-updated process
            
            const newProcesosEntrada = p.procesosEntrada?.map(entrada => entrada === oldName ? newName : entrada);
            const newProcesosSalida = p.procesosSalida?.map(salida => salida === oldName ? newName : salida);
            
            // Check if there are actual changes to avoid unnecessary updates
            if (JSON.stringify(p.procesosEntrada) !== JSON.stringify(newProcesosEntrada) || JSON.stringify(p.procesosSalida) !== JSON.stringify(newProcesosSalida)) {
              return {
                ...p,
                procesosEntrada: newProcesosEntrada,
                procesosSalida: newProcesosSalida,
              };
            }
            return p;
        });
    }

    if (changes.length > 0) {
      setAllCapturedData(dataWithChanges);
      toast({ title: "Proceso Actualizado", description: `${changes.length} campo(s) fueron modificados.` });
      addLogEntry({ action: 'update', entityType: 'Proceso', entityName: values.proceso, details: `Se actualizó el proceso "${values.proceso}".`});
    } else {
       toast({ title: "Sin Cambios", description: "No se detectaron modificaciones para guardar." });
    }

    setIsEditDialogOpen(false);
    setEditingProcess(null);
  }

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

  const handleExport = () => {
    if (sortedAndFilteredData.length === 0) {
      toast({ title: "Nada que exportar", description: "No hay datos que coincidan con los filtros actuales.", variant: "default" });
      return;
    }

    const headers = [
      "ID", "Proceso", "Area", "Departamento", "Puesto", "Estado", "Descripción",
      "Frecuencia", "Tiempo Estimado (min)", "Tiempo Ideal (min)", "Costo Estimado", "Costo Ideal", "Moneda",
      "Sistemas", "Información Recibe", "Procesos de Entrada",
      "Información Entrega", "Procesos de Salida",
      "Fecha Captura", "Última Modificación"
    ];
    
    const csvRows = [
      headers.join(','),
      ...sortedAndFilteredData.map(proc => [
        escapeCsvCell(proc.id),
        escapeCsvCell(proc.proceso),
        escapeCsvCell(proc.area),
        escapeCsvCell(proc.departamento),
        escapeCsvCell(proc.puesto),
        escapeCsvCell(proc.activo !== false ? 'Activo' : 'Inactivo'),
        escapeCsvCell(proc.descripcion),
        escapeCsvCell(proc.frecuencia),
        escapeCsvCell(proc.tiempoEstimado),
        escapeCsvCell(proc.tiempoIdeal),
        escapeCsvCell(proc.costoEstimado),
        escapeCsvCell(proc.costoIdeal),
        escapeCsvCell(proc.monedaCosto),
        escapeCsvCell(proc.sistemas),
        escapeCsvCell(proc.informacionRecibe),
        escapeCsvCell(proc.procesosEntrada),
        escapeCsvCell(proc.informacionEntrega),
        escapeCsvCell(proc.procesosSalida),
        escapeCsvCell(proc.capturedAt ? format(new Date(proc.capturedAt), 'yyyy-MM-dd HH:mm:ss') : 'N/A'),
        escapeCsvCell(proc.updatedAt ? format(new Date(proc.updatedAt), 'yyyy-MM-dd HH:mm:ss') : 'N/A')
      ].join(','))
    ];

    const csvString = csvRows.join('\n');
    const blob = new Blob(["\uFEFF" + csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `procesos_registrados_${new Date().toISOString().split('T')[0]}.csv`);
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

  const getEffectiveCost = (proc: CapturedProcess) => {
    if (proc.costoEstimado !== undefined && proc.costoEstimado !== null) return { value: proc.costoEstimado, isDerived: false };
    return { value: 0, isDerived: false }; // Activities no longer have cost
  };
  const clearFilters = () => { setSearchTerm(''); setSelectedAreaFilter('all'); setSelectedDeptoFilter('all'); setSelectedPuestoFilter('all'); setProcessStatusFilter('all'); setActivityCountFilter('all'); };

  const availableProcessesForSelection = useMemo(() => {
    return allCapturedData
      .filter(p => !p.deletedAt && p.id !== editingProcess?.id)
      .map(p => ({ id: p.id, nombre: p.proceso }));
  }, [allCapturedData, editingProcess]);

  const renderMultiSelectDropdown = (
    field: any, 
    label: string,
    placeholder: string,
    options: { id: string; nombre: string }[],
    isLoading: boolean,
    specialOption?: string
  ) => {
    const currentSelectionNames = (field.value || [])
      .map((val: string) => {
        if (specialOption && val === specialOption) return specialOption;
        return options.find(opt => opt.nombre === val)?.nombre || val;
      })
      .filter(Boolean);

    return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <FormControl>
          <Button variant="outline" className="w-full justify-between text-left font-normal h-auto min-h-10">
            {currentSelectionNames.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {currentSelectionNames.map((itemName: string) => (
                  <Badge key={itemName} variant="secondary" className="font-normal">
                    {itemName}
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="text-muted-foreground">{isLoading ? "Cargando opciones..." : placeholder}</span>
            )}
            <ChevronDown className="ml-auto h-4 w-4 opacity-50 shrink-0" />
          </Button>
        </FormControl>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]" align="start">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isLoading ? (
           <div className="px-2 py-1.5 text-sm text-muted-foreground">Cargando...</div>
        ) : (
          <>
            {specialOption && (
              <DropdownMenuCheckboxItem
                key={specialOption}
                checked={field.value?.includes(specialOption)}
                onCheckedChange={(checked) => {
                  const currentSelected = field.value || [];
                  if (checked) {
                    field.onChange([...currentSelected, specialOption]);
                  } else {
                    field.onChange(currentSelected.filter((s: string) => s !== specialOption));
                  }
                }}
              >
                {specialOption}
              </DropdownMenuCheckboxItem>
            )}
            {options.length === 0 && !specialOption ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                No hay elementos configurados.
              </div>
            ) : (
              options.map((option) => (
                <DropdownMenuCheckboxItem
                  key={option.id}
                  checked={field.value?.includes(option.nombre)}
                  onCheckedChange={(checked) => {
                    const currentSelected = field.value || [];
                    if (checked) {
                      field.onChange([...currentSelected, option.nombre]);
                    } else {
                      field.onChange(currentSelected.filter((s: string) => s !== option.nombre));
                    }
                  }}
                >
                  {option.nombre}
                </DropdownMenuCheckboxItem>
              ))
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )};

  if (isLoading || isLoadingActividades || isLoadingAreas || isLoadingPuestos) return <div className="container mx-auto py-8"><div className="flex items-center justify-center min-h-[400px]"><Database className="h-16 w-16 text-muted-foreground animate-pulse" /><p className="ml-4 text-lg text-muted-foreground">Cargando...</p></div></div>;

  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader><div className="flex items-center gap-2 mb-1"><Database className="h-6 w-6 text-primary" /><CardTitle className="text-2xl font-headline">Procesos y Flujos Registrados</CardTitle></div><CardDescription>Visualiza, busca, filtra y gestiona todos los procesos y flujos de información registrados en el sistema.</CardDescription></CardHeader>
        <CardContent>
          <div className="mb-4 p-4 border rounded-lg bg-muted/30">
            <div className="flex items-center gap-2 mb-3"><Filter className="h-5 w-5 text-primary"/><h4 className="text-md font-semibold">Filtros de Búsqueda</h4></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 items-end">
              <div className="relative xl:col-span-2 md:col-span-full sm:col-span-full"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" /><Input type="search" placeholder="Buscar palabra clave..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10"/></div>
              <div className="w-full"><Label htmlFor="area-filter" className="text-xs font-medium text-muted-foreground ml-1">Área</Label><Select value={selectedAreaFilter} onValueChange={(v) => { setSelectedAreaFilter(v); setSelectedDeptoFilter('all'); setSelectedPuestoFilter('all'); }} disabled={isLoadingAreas}><SelectTrigger id="area-filter"><SelectValue placeholder={isLoadingAreas ? "Cargando..." : "Todas"} /></SelectTrigger><SelectContent><SelectItem value="all">Todas las Áreas</SelectItem>{areas.map(area => <SelectItem key={area.id} value={area.nombre}>{area.nombre}</SelectItem>)}</SelectContent></Select></div>
              <div className="w-full"><Label htmlFor="depto-filter" className="text-xs font-medium text-muted-foreground ml-1">Departamento</Label><Select value={selectedDeptoFilter} onValueChange={(v) => { setSelectedDeptoFilter(v); setSelectedPuestoFilter('all'); }} disabled={isLoadingDepartamentos || selectedAreaFilter === 'all'}><SelectTrigger id="depto-filter"><SelectValue placeholder={selectedAreaFilter === 'all' ? "Seleccione un área" : (isLoadingDepartamentos ? "Cargando..." : "Todos")} /></SelectTrigger><SelectContent><SelectItem value="all">Todos los Deptos.</SelectItem>{availableDepartamentos.map(depto => <SelectItem key={depto.id} value={depto.nombre}>{depto.nombre}</SelectItem>)}</SelectContent></Select></div>
              <div className="w-full">
                <Label htmlFor="puesto-filter" className="text-xs font-medium text-muted-foreground ml-1">Puesto</Label>
                <Select value={selectedPuestoFilter} onValueChange={setSelectedPuestoFilter} disabled={isLoadingPuestos || selectedAreaFilter === 'all'}>
                  <SelectTrigger id="puesto-filter">
                    <SelectValue placeholder={selectedAreaFilter === 'all' ? "Seleccione un área" : (isLoadingPuestos ? "Cargando..." : "Todos")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los Puestos</SelectItem>
                    {availablePuestosForFilter.map(puesto => <SelectItem key={puesto.id} value={puesto.nombre}>{puesto.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 mt-4 items-end">
               <div className="w-full"><Label htmlFor="status-filter" className="text-xs font-medium text-muted-foreground ml-1">Estado del Proceso</Label><Select value={processStatusFilter} onValueChange={(v: 'all' | 'active' | 'inactive') => setProcessStatusFilter(v)}><SelectTrigger id="status-filter"><SelectValue placeholder="Todos"/></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="active">Activos</SelectItem><SelectItem value="inactive">Inactivos</SelectItem></SelectContent></Select></div>
                <div className="w-full"><Label htmlFor="activity-filter" className="text-xs font-medium text-muted-foreground ml-1">Conteo Actividades</Label><Select value={activityCountFilter} onValueChange={(v: ActivityCountFilterType) => setActivityCountFilter(v)}><SelectTrigger id="activity-filter"><SelectValue placeholder="Todos"/></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="some">Con Actividades</SelectItem><SelectItem value="none">Sin Actividades</SelectItem></SelectContent></Select></div>
                <div className="w-full"><Label htmlFor="activity-status-filter" className="text-xs font-medium text-muted-foreground ml-1">Estado de Actividades</Label><Select value={activityStatusFilter} onValueChange={(v) => setActivityStatusFilter(v as any)}><SelectTrigger id="activity-status-filter"><SelectValue placeholder="Todas"/></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem><SelectItem value="active">Solo Activas</SelectItem><SelectItem value="inactive">Solo Inactivas</SelectItem></SelectContent></Select></div>
                <Button onClick={clearFilters} variant="link" className="mt-3 px-0 text-sm self-end col-start-auto">Limpiar Todos los Filtros</Button>
            </div>
          </div>
          <div className="mb-6 flex flex-col sm:flex-row sm:justify-end sm:items-center gap-2">
            <Button onClick={handleExport} variant="outline" className="w-full sm:w-auto"><FileText className="mr-2 h-4 w-4" /> Exportar CSV ({sortedAndFilteredData.length})</Button>
            <Dialog open={isRecoveryDialogOpen} onOpenChange={setIsRecoveryDialogOpen}><DialogTrigger asChild><Button variant="outline" className="w-full sm:w-auto" disabled={recoverableProcesses.length === 0}><RotateCcw className="mr-2 h-4 w-4" /> Recuperar ({recoverableProcesses.length})</Button></DialogTrigger><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>Recuperar Procesos Eliminados</DialogTitle><DialogDescription>Procesos eliminados en los últimos 30 días que pueden ser restaurados.</DialogDescription></DialogHeader>{recoverableProcesses.length > 0 ? (<div className="max-h-[60vh] overflow-y-auto py-4"><Table><TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Eliminado el</TableHead><TableHead className="text-right">Acción</TableHead></TableRow></TableHeader><TableBody>{recoverableProcesses.map(proc => (<TableRow key={proc.id}><TableCell>{proc.proceso}</TableCell><TableCell>{proc.deletedAt ? format(new Date(proc.deletedAt), 'dd/MM/yyyy HH:mm', { locale: es }) : 'N/A'}</TableCell><TableCell className="text-right"><Button size="sm" onClick={() => handleRestoreProcess(proc.id)}><RotateCcw className="mr-2 h-3 w-3" /> Restaurar</Button></TableCell></TableRow>))}</TableBody></Table></div>) : (<p className="py-4 text-muted-foreground">No hay procesos para recuperar.</p>)}<DialogFooter><DialogClose asChild><Button type="button" variant="outline">Cerrar</Button></DialogClose></DialogFooter></DialogContent></Dialog>
          </div>
          {paginatedData.length > 0 ? (
            <><div className="rounded-md border overflow-x-auto"><Table><TableHeader><TableRow>
              <TableHead className="w-[40px]"></TableHead>
              <TableHead className="min-w-[200px] cursor-pointer hover:bg-muted/50 group" onClick={() => requestSort('proceso')}><div className="flex items-center">Proceso {getSortIcon('proceso')}</div></TableHead>
              <TableHead className="w-[120px] cursor-pointer hover:bg-muted/50 group" onClick={() => requestSort('area')}><div className="flex items-center">Área {getSortIcon('area')}</div></TableHead>
              <TableHead className="w-[120px] cursor-pointer hover:bg-muted/50 group" onClick={() => requestSort('departamento')}><div className="flex items-center">Departamento {getSortIcon('departamento')}</div></TableHead>
              <TableHead className="w-[120px] cursor-pointer hover:bg-muted/50 group" onClick={() => requestSort('puesto')}><div className="flex items-center">Puesto {getSortIcon('puesto')}</div></TableHead>
              <TableHead className="text-center w-[80px] cursor-pointer hover:bg-muted/50 group" onClick={() => requestSort('activo')}><div className="flex items-center justify-center">Estado {getSortIcon('activo')}</div></TableHead>
              <TableHead className="text-center w-[120px] cursor-pointer hover:bg-muted/50 group" onClick={() => requestSort('tiempoEstimado')}><div className="flex items-center justify-center">Tiempo Est./Ideal {getSortIcon('tiempoEstimado')}</div></TableHead>
              <TableHead className="text-center w-[120px] cursor-pointer hover:bg-muted/50 group" onClick={() => requestSort('costoEstimado')}><div className="flex items-center justify-center">Costo Est./Ideal {getSortIcon('costoEstimado')}</div></TableHead>
              <TableHead className="text-center w-[80px] cursor-pointer hover:bg-muted/50 group" onClick={() => requestSort('numActividades')}><div className="flex items-center justify-center">Activ. {getSortIcon('numActividades')}</div></TableHead>
              <TableHead className="w-[140px] cursor-pointer hover:bg-muted/50 group" onClick={() => requestSort('updatedAt')}><div className="flex items-center">Últ. Modif. {getSortIcon('updatedAt')}</div></TableHead>
              <TableHead className="text-right w-[140px]">Acciones</TableHead>
            </TableRow></TableHeader><TableBody>{paginatedData.map((proc) => {
                const isExpanded = expandedRows[proc.id];
                const { value: effectiveCost, isDerived } = getEffectiveCost(proc);

                const activitiesToShow = (proc.activityOrder || [])
                    .map(actId => allActivities.find(a => a.id === actId))
                    .filter((act): act is Actividad => !!act)
                    .filter(act => {
                        if (activityStatusFilter === 'all') return true;
                        if (activityStatusFilter === 'active') return act.activa;
                        if (activityStatusFilter === 'inactive') return !act.activa;
                        return true;
                    });

                return (
                <React.Fragment key={proc.id}>
                <TableRow className={cn(proc.activo === false && "bg-muted/40", isExpanded && "border-b-0")}>
                    <TableCell className="p-1"><Button variant="ghost" size="icon" onClick={() => toggleRow(proc.id)}><ChevronRight className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-90")} /></Button></TableCell>
                    <TableCell className="font-medium">{proc.proceso}</TableCell>
                    <TableCell>{proc.area}</TableCell>
                    <TableCell>{proc.departamento || '-'}</TableCell>
                    <TableCell>{proc.puesto}</TableCell>
                    <TableCell className="text-center"><Badge variant={proc.activo !== false ? 'default' : 'outline'} className={cn(proc.activo === false && "border-destructive text-destructive", proc.activo !== false && 'bg-green-500 hover:bg-green-600')}>{proc.activo !== false ? 'Activo' : 'Inactivo'}</Badge></TableCell>
                    <TableCell className="text-center text-xs">
                        {proc.tiempoEstimado !== undefined ? formatMinutesToHours(proc.tiempoEstimado) : '-'} / {proc.tiempoIdeal !== undefined ? formatMinutesToHours(proc.tiempoIdeal) : '-'}
                    </TableCell>
                    <TableCell className="text-center text-xs">
                        <TooltipProvider><Tooltip><TooltipTrigger asChild>
                            <span>
                                {effectiveCost.toFixed(2)} / {proc.costoIdeal?.toFixed(2) ?? '-'} {proc.monedaCosto || ''}
                                {isDerived && <Info className="h-3 w-3 inline ml-1 text-muted-foreground" />}
                            </span>
                        </TooltipTrigger>{isDerived && <TooltipContent><p>Costo derivado de la suma de actividades.</p></TooltipContent>}</Tooltip></TooltipProvider>
                    </TableCell>
                    <TableCell className="text-center"><Badge variant="outline" className="cursor-default">{proc.activityOrder?.length || 0}</Badge></TableCell>
                    <TableCell className="text-xs">{proc.updatedAt && isValid(new Date(proc.updatedAt)) ? format(new Date(proc.updatedAt), 'dd/MM/yy HH:mm', { locale: es }) : '-'}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Switch checked={proc.activo !== false} onCheckedChange={() => handleToggleProcessStatus(proc.id)} className="mr-1" />
                      <Button variant="ghost" size="icon" onClick={() => handleViewHistory(proc)} disabled={!proc.historialDeCambios || proc.historialDeCambios.length === 0}><History className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleOpenEditDialog(proc)}><Edit2 className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => promptDeleteProcess(proc)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                </TableRow>
                {isExpanded && (
                  <TableRow className={cn(proc.activo === false && "bg-muted/40")}>
                    <TableCell colSpan={11} className="p-0">
                      <div className="p-4 bg-muted/50 space-y-4">
                        <Card>
                          <CardHeader><CardTitle className="text-lg">Detalles del Proceso</CardTitle></CardHeader>
                          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              <DetailDisplay title="Descripción" value={proc.descripcion} isTextarea />
                              <DetailDisplay title="Frecuencia" value={proc.frecuencia} />
                              <DetailDisplay title="Sistemas" value={proc.sistemas} isList />
                              <DetailDisplay title="Entradas" value={proc.informacionRecibe} isTextarea />
                              <DetailDisplay title="Salidas" value={proc.informacionEntrega} isTextarea />
                              <DetailDisplay title="Procesos de Entrada" value={proc.procesosEntrada} isList />
                              <DetailDisplay title="Procesos de Salida" value={proc.procesosSalida} isList />
                          </CardContent>
                        </Card>
                        <div>
                          <h4 className="font-semibold text-lg mb-2">Actividades en Orden</h4>
                           {(proc.activityOrder && proc.activityOrder.length > 0) ? (
                                activitiesToShow.length > 0 ? (
                                    <div className="space-y-3">
                                        {activitiesToShow.map((act, index) => (
                                        <Card key={`${proc.id}-act-${act.id}-${index}`} className="bg-background">
                                            <CardHeader className="flex-row items-center justify-between gap-4 space-y-0 p-4">
                                                <div className="flex items-center gap-4">
                                                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">{index + 1}</span>
                                                    <CardTitle className="text-base flex items-center gap-2">
                                                        {act.nombre}
                                                        {!act.activa && <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-50">Inactiva</Badge>}
                                                    </CardTitle>
                                                </div>
                                                <Button variant="ghost" size="icon" onClick={() => handleEditActivity(act.nombre)} title={`Editar actividad: ${act.nombre}`}>
                                                    <Edit2 className="h-4 w-4 text-muted-foreground" />
                                                </Button>
                                            </CardHeader>
                                            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4 pt-0 pl-16">
                                                <DetailDisplay title="Descripción" value={act.descripcionBreve} isTextarea />
                                                <DetailDisplay title="Sistema Utilizado" value={act.sistemaUtilizado} />
                                            </CardContent>
                                        </Card>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground italic">Ninguna actividad coincide con el filtro de estado actual.</p>
                                )
                           ) : (
                             <p className="text-sm text-muted-foreground italic">Este proceso no tiene actividades definidas en orden.</p>
                           )}
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                </React.Fragment>
                );
            })}</TableBody></Table></div>
            <div className="flex items-center justify-between space-x-2 py-4"><span className="text-sm text-muted-foreground">Página {currentPage} de {totalPages} ({sortedAndFilteredData.length} total)</span><div className="space-x-2"><Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Anterior</Button><Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0}>Siguiente</Button></div></div></>
          ) : (<div className="mt-6 p-8 border-dashed rounded-lg flex flex-col items-center justify-center min-h-[300px] bg-muted/20"><FileX className="h-16 w-16 text-muted-foreground mb-4" /><p className="text-lg font-semibold">{allCapturedData.filter(p => !p.deletedAt).length === 0 ? "No hay datos capturados activos" : "No se encontraron resultados"}</p><p className="text-sm text-muted-foreground">{allCapturedData.filter(p => !p.deletedAt).length === 0 ? 'Comience registrando procesos en "Captura".' : 'Intente ajustar su búsqueda o filtros.'}</p></div>)}
        </CardContent>
      </Card>
      
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Editar Proceso: {editingProcess?.proceso}</DialogTitle>
            <DialogDescription>
              Modifique los detalles del proceso. Los cambios se guardarán directamente.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-6 py-4 max-h-[75vh] overflow-y-auto pr-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField control={editForm.control} name="area" render={({ field }) => (<FormItem><FormLabel>Área</FormLabel><Select onValueChange={(v) => { field.onChange(v); setEditValue('departamento', undefined); setEditValue('puesto', undefined); }} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{areas.map(a => <SelectItem key={a.id} value={a.nombre}>{a.nombre}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={editForm.control} name="departamento" render={({ field }) => (<FormItem><FormLabel>Departamento</FormLabel><Select onValueChange={(v) => { field.onChange(v); setEditValue('puesto', undefined); }} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Opcional"/></SelectTrigger></FormControl><SelectContent><SelectItem value={NO_DEPARTAMENTO_SELECTED}>Sin Departamento</SelectItem>{filteredEditDepartamentos.map(d => <SelectItem key={d.id} value={d.nombre}>{d.nombre}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={editForm.control} name="puesto" render={({ field }) => (<FormItem><FormLabel>Puesto</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{filteredEditPuestos.map(p => <SelectItem key={p.id} value={p.nombre}>{p.nombre}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
              </div>
              <FormField control={editForm.control} name="proceso" render={({ field }) => (<FormItem><FormLabel>Nombre Proceso</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={editForm.control} name="descripcion" render={({ field }) => (<FormItem><FormLabel>Descripción</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={editForm.control} name="frecuencia" render={({ field }) => (<FormItem><FormLabel>Frecuencia</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{(frecuenciaOptions as string[]).map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={editForm.control} name="monedaCosto" render={({ field }) => (<FormItem><FormLabel>Moneda</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{(monedaOptions as string[]).map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 <FormField control={editForm.control} name="tiempoEstimado" render={({ field }) => (<FormItem><FormLabel>Tiempo Est. (min)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''}/></FormControl><FormMessage /></FormItem>)} />
                 <FormField control={editForm.control} name="tiempoIdeal" render={({ field }) => (<FormItem><FormLabel>Tiempo Ideal (min)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                 <FormField control={editForm.control} name="costoEstimado" render={({ field }) => (<FormItem><FormLabel>Costo Est.</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                 <FormField control={editForm.control} name="costoIdeal" render={({ field }) => (<FormItem><FormLabel>Costo Ideal</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <FormField control={editForm.control} name="sistemas" render={({ field }) => (<FormItem><FormLabel>Sistemas</FormLabel>{renderMultiSelectDropdown(field, "Sistemas", "Seleccionar...", availableEditSistemas, isLoadingSistemasCostos)}<FormMessage /></FormItem>)} />
              <FormField control={editForm.control} name="informacionRecibe" render={({ field }) => (<FormItem><FormLabel>Info. Recibida</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={editForm.control} name="procesosEntrada" render={({ field }) => (<FormItem><FormLabel>Procesos Entrada</FormLabel>{renderMultiSelectDropdown(field, "Procesos", "Seleccionar...", availableProcessesForSelection, isLoading, SPECIAL_ENTRADA_OPTION)}<FormMessage /></FormItem>)} />
              <FormField control={editForm.control} name="informacionEntrega" render={({ field }) => (<FormItem><FormLabel>Info. Entregada</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={editForm.control} name="procesosSalida" render={({ field }) => (<FormItem><FormLabel>Procesos Salida</FormLabel>{renderMultiSelectDropdown(field, "Procesos", "Seleccionar...", availableProcessesForSelection, isLoading, SPECIAL_SALIDA_OPTION)}<FormMessage /></FormItem>)} />
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
                <Button type="submit"><Save className="mr-2 h-4 w-4" />Guardar Cambios</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={isConfirmDeleteProcessOpen} onOpenChange={setIsConfirmDeleteProcessOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle><div className="flex items-center"><AlertTriangle className="h-5 w-5 mr-2 text-destructive" />Confirmar Eliminación</div></AlertDialogTitle><AlertDialogDescription>¿Está seguro de eliminar el proceso "{processToDelete?.proceso}"? La acción lo moverá a la papelera.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel onClick={() => setProcessToDelete(null)}>Cancelar</AlertDialogCancel><AlertDialogAction onClick={executeDeleteProcess} className={buttonVariants({variant: "destructive"})}>Eliminar Proceso</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    
      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Historial de Cambios para: {processForHistory?.proceso}</DialogTitle>
            <DialogDescription>
              Registro de las modificaciones realizadas a este proceso.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 max-h-[60vh] overflow-y-auto">
            {processForHistory?.historialDeCambios && processForHistory.historialDeCambios.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Campo Modificado</TableHead>
                    <TableHead>Valor Anterior</TableHead>
                    <TableHead>Valor Nuevo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processForHistory.historialDeCambios
                    .sort((a,b) => parseISO(b.timestamp).getTime() - parseISO(a.timestamp).getTime())
                    .map((cambio, index) => (
                    <TableRow key={index}>
                      <TableCell className="text-xs">{format(parseISO(cambio.timestamp), 'dd/MM/yy HH:mm', { locale: es })}</TableCell>
                      <TableCell className="text-sm capitalize">{cambio.field.replace(/([A-Z])/g, ' $1').trim()}</TableCell>
                      <TableCell className="text-xs">{String(cambio.before)}</TableCell>
                      <TableCell className="text-xs font-semibold">{String(cambio.after)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-center">No hay historial de cambios registrado para este proceso.</p>
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
