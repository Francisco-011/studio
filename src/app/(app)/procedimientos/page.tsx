

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { format, isValid, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

import { useProcedimientos, type Procedimiento, type ProcedimientoCreationData } from '@/contexts/ProcedimientosContext';
import { useProcesos, type CapturedProcess, clasificacionOptions, auditFrequencyOptions } from '@/contexts/ProcesosContext';
import { useSistemasCostos } from '@/contexts/SistemasCostosContext';
import { useActividades, type Actividad, type CambioHistorial } from '@/contexts/ActividadesContext';
import { usePuestos } from '@/contexts/PuestosContext';
import { formatMinutesToHours } from '@/lib/utils';
import { usePoliticas, type Politica } from '@/contexts/PoliticasContext';

import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from '@/hooks/use-toast';
import { Workflow, Search, PlusCircle, Edit2, Trash2, AlertTriangle, Loader2, ChevronsUpDown, ArrowUp, ArrowDown, ListOrdered, History, CalendarCheck2, Calculator, FileText } from "lucide-react";
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import type { Moneda } from '@/contexts/AccionesContext';
import { Combobox } from '@/components/ui/combobox';
import { MultiSelect } from '@/components/ui/multi-select';


const procedimientoFormSchema = z.object({
  id: z.string().optional(),
  nombre: z.string().min(3, 'El nombre es requerido (mínimo 3 caracteres).').max(100, 'El nombre no puede exceder 100 caracteres.'),
  descripcion: z.string().optional().refine(val => !val || val.length <= 2000, { message: 'La descripción no puede exceder 2000 caracteres.' }),
  procesoId: z.string({ required_error: 'Debe seleccionar un proceso padre.' }),
  sistemasUtilizados: z.array(z.string()).optional().default([]),
  clasificacion: z.enum(clasificacionOptions).default('Privado'),
  activityOrder: z.array(z.string()).optional().default([]), 
  informacionRecibe: z.string().optional().refine(val => !val || val.length <= 1000, { message: 'No puede exceder 1000 caracteres.' }),
  procedimientosEntradaIds: z.array(z.string()).optional().default([]),
  informacionEntrega: z.string().optional().refine(val => !val || val.length <= 1000, { message: 'No puede exceder 1000 caracteres.' }),
  procedimientosSalidaIds: z.array(z.string()).optional().default([]),
  auditFrequencyInDays: z.preprocess(
    (val) => (String(val).trim() === '' || val === 'none' ? undefined : parseInt(String(val), 10)),
    z.number().int().optional()
  ),
  lastAuditedAt: z.string().optional(),
  politicasAsociadasIds: z.array(z.string()).optional().default([]),
});

type ProcedimientoFormData = z.infer<typeof procedimientoFormSchema>;

type SortableKeys = 'codigo' | 'nombre' | 'procesoPadre' | 'numActividades' | 'clasificacion' | 'updatedAt' | 'activo' | 'tiempoEstimado' | 'costoEstimado';
type SortDirection = 'ascending' | 'descending';

interface SortConfig {
  key: SortableKeys;
  direction: SortDirection;
}

const ITEMS_PER_PAGE = 10;
const PROCEDIMIENTO_INICIADOR = "__INICIADOR__";
const PROCEDIMIENTO_FINALIZADOR = "__FINALIZADOR__";

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


export default function ProcedimientosPage() {
  const router = useRouter();
  const { procedimientos, addProcedimiento, updateProcedimiento, deleteProcedimiento, toggleProcedimientoStatus, isLoadingProcedimientos } = useProcedimientos();
  const { procesos, updateProceso, isLoadingProcesos } = useProcesos();
  const { sistemas, isLoadingSistemasCostos } = useSistemasCostos();
  const { actividades, isLoadingActividades } = useActividades();
  const { puestos, isLoadingPuestos } = usePuestos();
  const { politicas, updatePolitica: updatePoliticaContext, isLoadingPoliticas } = usePoliticas();
  const searchParams = useSearchParams();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [procesoFilter, setProcesoFilter] = useState('all');
  const [clasificacionFilter, setClasificacionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProcedimiento, setEditingProcedimiento] = useState<Procedimiento | null>(null);

  const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] = useState(false);
  const [procedimientoToDelete, setProcedimientoToDelete] = useState<Procedimiento | null>(null);
  
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [procedimientoForHistory, setProcedimientoForHistory] = useState<Procedimiento | null>(null);
  const [isRecalculating, setIsRecalculating] = useState<string | null>(null);

  const [similarProcedimientoWarning, setSimilarProcedimientoWarning] = useState<string | null>(null);
  
  const procesosMap = useMemo(() => new Map(procesos.map(p => [p.id, p.proceso])), [procesos]);
  const politicasMap = useMemo(() => new Map(politicas.map(p => [p.id, p.codigo])), [politicas]);


  const form = useForm<ProcedimientoFormData>({
    resolver: zodResolver(procedimientoFormSchema),
    defaultValues: { nombre: '', descripcion: '', procesoId: undefined, sistemasUtilizados: [], clasificacion: 'Privado', auditFrequencyInDays: undefined, lastAuditedAt: undefined, politicasAsociadasIds: [] },
  });

  const watchedNombre = form.watch('nombre');

  useEffect(() => {
    if (isDialogOpen && watchedNombre && procedimientos.length > 0) {
        const trimmedLowerName = watchedNombre.trim().toLowerCase();
        if (!trimmedLowerName) {
            setSimilarProcedimientoWarning(null);
            return;
        }

        const existingProcedimiento = procedimientos.find(
            p => p.nombre.trim().toLowerCase() === trimmedLowerName && p.id !== editingProcedimiento?.id
        );

        if (existingProcedimiento) {
            const parentProcess = procesos.find(p => p.id === existingProcedimiento.procesoId);
            setSimilarProcedimientoWarning(`Advertencia: ya existe un procedimiento con este nombre en el proceso "${parentProcess?.proceso || 'otro proceso'}".`);
        } else {
            setSimilarProcedimientoWarning(null);
        }
    } else if (!isDialogOpen) {
        setSimilarProcedimientoWarning(null);
    }
  }, [watchedNombre, procedimientos, editingProcedimiento, isDialogOpen, procesos]);
  
  useEffect(() => {
    const processFromQuery = searchParams.get('proceso');
    if (processFromQuery) {
        setProcesoFilter(processFromQuery);
        form.setValue('procesoId', processFromQuery);
    }

    const searchFromQuery = searchParams.get('search');
    if (searchFromQuery) {
        setSearchTerm(searchFromQuery);
    }
  }, [searchParams, form]);

  useEffect(() => {
    if (isDialogOpen) {
      if (editingProcedimiento) {
        form.reset({
          ...editingProcedimiento,
          politicasAsociadasIds: editingProcedimiento.politicasAsociadasIds || [],
        });
      } else {
        const processFromQuery = searchParams.get('proceso');
        form.reset({ 
          nombre: '', 
          descripcion: '', 
          procesoId: processFromQuery || undefined, 
          sistemasUtilizados: [], 
          clasificacion: 'Privado',
          informacionRecibe: '',
          procedimientosEntradaIds: [],
          informacionEntrega: '',
          procedimientosSalidaIds: [],
          politicasAsociadasIds: [],
        });
      }
    }
  }, [editingProcedimiento, isDialogOpen, form, searchParams]);

  async function handleSubmit(data: ProcedimientoFormData) {
    const { id, ...formData } = data;
    const dataToSave: ProcedimientoCreationData = { ...formData } as ProcedimientoCreationData;

    const originalPolicyIds = editingProcedimiento ? new Set(editingProcedimiento.politicasAsociadasIds || []) : new Set<string>();
    const newPolicyIds = new Set(data.politicasAsociadasIds || []);

    if (editingProcedimiento && id) {
      await updateProcedimiento(id, dataToSave);
      
      const addedPolicies = [...newPolicyIds].filter(x => !originalPolicyIds.has(x));
      const removedPolicies = [...originalPolicyIds].filter(x => !newPolicyIds.has(x));

      for (const policyId of addedPolicies) {
        const policy = politicas.find(p => p.id === policyId);
        if (policy) {
          const updatedProcIds = [...(policy.procedimientosAsociadosIds || []), id];
          await updatePoliticaContext(policyId, { procedimientosAsociadosIds: updatedProcIds });
        }
      }
      for (const policyId of removedPolicies) {
        const policy = politicas.find(p => p.id === policyId);
        if (policy) {
          const updatedProcIds = (policy.procedimientosAsociadosIds || []).filter(procId => procId !== id);
          await updatePoliticaContext(policyId, { procedimientosAsociadosIds: updatedProcIds });
        }
      }

      toast({ title: 'Procedimiento Actualizado', description: 'El procedimiento y sus vínculos han sido actualizados.' });
      setIsDialogOpen(false);
    } else {
      const newProc = await addProcedimiento(dataToSave);
      if (newProc) {
        const parentProcess = procesos.find(p => p.id === newProc.procesoId);
        if (parentProcess) {
          const updatedOrder = [...(parentProcess.procedimientoOrder || []), newProc.id];
          await updateProceso(parentProcess.id, { procedimientoOrder: updatedOrder });
        }

        for (const policyId of newPolicyIds) {
          const policy = politicas.find(p => p.id === policyId);
          if (policy) {
            const updatedProcIds = [...(policy.procedimientosAsociadosIds || []), newProc.id];
            await updatePoliticaContext(policyId, { procedimientosAsociadosIds: updatedProcIds });
          }
        }
        
        toast({ title: 'Procedimiento Creado', description: 'Redirigiendo para gestionar sus actividades...' });
        router.push(`/actividades?procedimientoId=${newProc.id}`);
      } else {
        toast({ title: 'Error', description: 'No se pudo crear el procedimiento.', variant: 'destructive'});
        setIsDialogOpen(false);
      }
    }
  }

  function handleEdit(procedimiento: Procedimiento) {
    setEditingProcedimiento(procedimiento);
    setIsDialogOpen(true);
  }
  
  function handleViewHistory(procedimiento: Procedimiento) {
    setProcedimientoForHistory(procedimiento);
    setIsHistoryDialogOpen(true);
  }

  function promptDelete(procedimiento: Procedimiento) {
    const hasActivities = procedimiento.activityOrder && procedimiento.activityOrder.length > 0;
    if (hasActivities) {
        toast({
            title: "Eliminación Bloqueada",
            description: `El procedimiento "${procedimiento.nombre}" tiene ${procedimiento.activityOrder.length} actividad(es) asignada(s). Por favor, remuévalas primero desde el Panel Jerárquico.`,
            variant: "destructive",
            duration: 7000
        });
        return;
    }
    setProcedimientoToDelete(procedimiento);
    setIsConfirmDeleteDialogOpen(true);
  }

  async function executeDelete() {
    if (!procedimientoToDelete) return;
    
    await deleteProcedimiento(procedimientoToDelete.id);
    
    const parentProcess = procesos.find(p => p.id === procedimientoToDelete.procesoId);
    if (parentProcess) {
        const updatedOrder = (parentProcess.procedimientoOrder || []).filter(id => id !== procedimientoToDelete.id);
        await updateProceso(parentProcess.id, { procedimientoOrder: updatedOrder });
    }

    if (procedimientoToDelete.politicasAsociadasIds) {
      for (const policyId of procedimientoToDelete.politicasAsociadasIds) {
        const policy = politicas.find(p => p.id === policyId);
        if (policy) {
          const updatedProcIds = (policy.procedimientosAsociadosIds || []).filter(procId => procId !== procedimientoToDelete.id);
          await updatePoliticaContext(policyId, { procedimientosAsociadosIds: updatedProcIds });
        }
      }
    }

    setProcedimientoToDelete(null);
    setIsConfirmDeleteDialogOpen(false);
  }

  const sortedAndFilteredData = useMemo(() => {
    setCurrentPage(1);
    
    let filtered = procedimientos
      .map(p => ({ ...p, procesoPadre: procesosMap.get(p.procesoId) || 'N/A' }))
      .filter(p => 
        (p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || (p.codigo || '').toLowerCase().includes(searchTerm.toLowerCase()) || p.procesoPadre.toLowerCase().includes(searchTerm.toLowerCase())) &&
        (procesoFilter === 'all' || p.procesoId === procesoFilter) &&
        (clasificacionFilter === 'all' || p.clasificacion === clasificacionFilter) &&
        (statusFilter === 'all' || (statusFilter === 'active' && p.activo) || (statusFilter === 'inactive' && !p.activo))
      );

    if (sortConfig) {
      filtered.sort((a, b) => {
        let valA: any;
        let valB: any;
        
        if (sortConfig.key === 'numActividades') {
            valA = a.activityOrder?.length || 0;
            valB = b.activityOrder?.length || 0;
        } else if (sortConfig.key === 'activo') {
            valA = a.activo;
            valB = b.activo;
        } else if (sortConfig.key === 'updatedAt') {
            valA = a.updatedAt || 0;
            valB = b.updatedAt || 0;
        } else if (sortConfig.key === 'tiempoEstimado' || sortConfig.key === 'costoEstimado') {
            valA = a[sortConfig.key] ?? -1;
            valB = b[sortConfig.key] ?? -1;
        } else {
            valA = a[sortConfig.key as keyof Procedimiento];
            valB = b[sortConfig.key as keyof Procedimiento];
        }

        if (typeof valA === 'string' && typeof valB === 'string') {
          valA = valA.toLowerCase();
          valB = valB.toLowerCase();
        }

        if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    } else {
      filtered.sort((a, b) => (a.codigo || '').localeCompare(b.codigo || ''));
    }
    return filtered;
  }, [procedimientos, procesosMap, searchTerm, procesoFilter, clasificacionFilter, statusFilter, sortConfig]);

  const totalPages = Math.ceil(sortedAndFilteredData.length / ITEMS_PER_PAGE);
  const paginatedData = useMemo(() => sortedAndFilteredData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE), [sortedAndFilteredData, currentPage]);
  
  const requestSort = (key: SortableKeys) => {
    let direction: SortDirection = 'ascending';
    if (sortConfig?.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  const getSortIcon = (key: SortableKeys) => {
    if (!sortConfig || sortConfig.key !== key) return <ChevronsUpDown className="ml-1 h-3 w-3 opacity-40 group-hover:opacity-100" />;
    return sortConfig.direction === 'ascending' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />;
  };

  const isLoadingAll = isLoadingProcedimientos || isLoadingProcesos || isLoadingSistemasCostos || isLoadingActividades || isLoadingPuestos || isLoadingPoliticas;

  const handleRecalculateTotalsForProcedure = async (proc: Procedimiento) => {
    setIsRecalculating(proc.id);
    try {
        const activitiesInProcedure = (proc.activityOrder || [])
            .map(actId => actividades.find(a => a.id === actId))
            .filter((act): act is Actividad => !!act && act.activa);

        let totalTiempoProcedimiento = 0;
        const costosPorMoneda = new Map<Moneda, number>();
        const getMonthlyMultiplier = (frequency?: string): number => {
            switch (frequency) {
                case 'Diario': return 22;
                case 'Semanal': return 4.33;
                case 'Quincenal': return 2;
                case 'Mensual': return 1;
                case 'Bimestral': return 1 / 2;
                case 'Trimestral': return 1 / 3;
                case 'Semestral': return 1 / 6;
                case 'Anual': return 1 / 12;
                case 'A demanda': return 1;
                default: return 0;
            }
        }

        activitiesInProcedure.forEach(activity => {
            const monthlyMultiplier = getMonthlyMultiplier(activity.frecuencia);
            const monthlyExecutions = monthlyMultiplier * (activity.ejecucionesPorPeriodo || 1);
            
            totalTiempoProcedimiento += (activity.tiempoEstimado || 0) * monthlyExecutions;
            
            if (activity.puestoId && activity.tiempoEstimado) {
                const puesto = puestos.find(p => p.id === activity.puestoId);
                if (puesto && puesto.costoHora) {
                    const costoPorMinuto = puesto.costoHora / 60;
                    const costoActividad = activity.tiempoEstimado * costoPorMinuto;
                    const costoMensualActividad = costoActividad * monthlyExecutions;
                    const moneda = puesto.monedaCosto || 'MXN';
                    
                    costosPorMoneda.set(moneda, (costosPorMoneda.get(moneda) || 0) + costoMensualActividad);
                }
            }
        });

        let totalCostoProcedimiento = 0;
        let monedaFinal: Moneda | undefined = undefined;

        if (costosPorMoneda.size > 0) {
            monedaFinal = Array.from(costosPorMoneda.keys())[0];
            totalCostoProcedimiento = costosPorMoneda.get(monedaFinal) || 0;
            if (costosPorMoneda.size > 1) {
                toast({
                    title: "Advertencia de Múltiples Monedas",
                    description: `El procedimiento "${proc.nombre}" tiene actividades con costos en diferentes monedas. El total solo refleja la suma para ${monedaFinal}.`,
                    variant: "default",
                    duration: 8000
                });
            }
        }

        await updateProcedimiento(proc.id, {
            tiempoEstimado: totalTiempoProcedimiento,
            costoEstimado: totalCostoProcedimiento,
            monedaCosto: monedaFinal,
        });
        
        toast({ title: "Cálculo Completado", description: `Los totales mensuales para "${proc.nombre}" han sido actualizados.` });

    } catch (error) {
       console.error("Error recalculating totals:", error);
       toast({ title: "Error", description: "No se pudo completar el recálculo.", variant: "destructive" });
    } finally {
        setIsRecalculating(null);
    }
  }

  const handleExport = () => {
    if (sortedAndFilteredData.length === 0) {
      toast({ title: "Nada que exportar", description: "No hay procedimientos que coincidan con los filtros actuales.", variant: "default" });
      return;
    }

    const headers = [
      "ID", "Código", "Nombre del Procedimiento", "Proceso Padre", "Clasificación", "Estado", "Nº Actividades",
      "Tiempo Estimado (Mes)", "Costo Estimado (Mes)", "Moneda", "Sistemas Utilizados", "Fecha Creación", "Última Modificación"
    ];

    const csvRows = [
      headers.join(','),
      ...sortedAndFilteredData.map(proc => {
        return [
          escapeCsvCell(proc.id),
          escapeCsvCell(proc.codigo),
          escapeCsvCell(proc.nombre),
          escapeCsvCell(proc.procesoPadre),
          escapeCsvCell(proc.clasificacion),
          escapeCsvCell(proc.activo ? 'Activo' : 'Inactivo'),
          escapeCsvCell(proc.activityOrder?.length || 0),
          escapeCsvCell(proc.tiempoEstimado),
          escapeCsvCell(proc.costoEstimado),
          escapeCsvCell(proc.monedaCosto),
          escapeCsvCell(proc.sistemasUtilizados),
          escapeCsvCell(proc.createdAt && isValid(new Date(proc.createdAt)) ? format(new Date(proc.createdAt), 'yyyy-MM-dd HH:mm:ss') : 'N/A'),
          escapeCsvCell(proc.updatedAt && isValid(new Date(proc.updatedAt)) ? format(new Date(proc.updatedAt), 'yyyy-MM-dd HH:mm:ss') : 'N/A')
        ].join(',');
      })
    ];

    const csvString = csvRows.join('\n');
    const blob = new Blob(["\uFEFF" + csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `procedimientos_${new Date().toISOString().split('T')[0]}.csv`);
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


  if (isLoadingAll) return <div className="container mx-auto py-8 flex justify-center"><Loader2 className="h-16 w-16 animate-spin" /></div>;

  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-2 mb-1"><Workflow className="h-6 w-6 text-primary" /><CardTitle className="text-2xl font-headline">Gestión de Procedimientos</CardTitle></div>
          <CardDescription>Catálogo centralizado para crear, editar y administrar todos los procedimientos del sistema.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
            <div className="relative w-full sm:max-w-xs"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" /><Input placeholder="Buscar por nombre, código..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10" /></div>
            <div className="flex gap-2 w-full sm:w-auto flex-wrap justify-end">
              <Select value={procesoFilter} onValueChange={setProcesoFilter}><SelectTrigger className="flex-1 min-w-[150px]"><SelectValue placeholder="Filtrar por proceso..."/></SelectTrigger><SelectContent><SelectItem value="all">Todos los Procesos</SelectItem>{procesos.filter(p => !p.deletedAt).map(p => <SelectItem key={p.id} value={p.id}>{p.proceso}</SelectItem>)}</SelectContent></Select>
              <Select value={clasificacionFilter} onValueChange={setClasificacionFilter}><SelectTrigger className="flex-1 min-w-[120px]"><SelectValue placeholder="Clasificación..."/></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem>{clasificacionOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select>
              <Select value={statusFilter} onValueChange={setStatusFilter as any}><SelectTrigger className="flex-1 min-w-[120px]"><SelectValue placeholder="Estado..."/></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="active">Activos</SelectItem><SelectItem value="inactive">Inactivos</SelectItem></SelectContent></Select>
              <Button onClick={handleExport} variant="outline"><FileText className="mr-2 h-4 w-4"/>Exportar</Button>
              <Button onClick={() => { setEditingProcedimiento(null); setIsDialogOpen(true); }}><PlusCircle className="mr-2 h-4 w-4" /> Agregar</Button>
            </div>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="w-[120px] cursor-pointer" onClick={() => requestSort('codigo')}>Código {getSortIcon('codigo')}</TableHead>
                <TableHead className="cursor-pointer" onClick={() => requestSort('nombre')}>Nombre Procedimiento {getSortIcon('nombre')}</TableHead>
                <TableHead className="cursor-pointer" onClick={() => requestSort('procesoPadre')}>Proceso Padre {getSortIcon('procesoPadre')}</TableHead>
                <TableHead className="cursor-pointer text-center" onClick={() => requestSort('numActividades')}>Nº Act. {getSortIcon('numActividades')}</TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => requestSort('tiempoEstimado')}>T. Est. (Mes) {getSortIcon('tiempoEstimado')}</TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => requestSort('costoEstimado')}>C. Est. (Mes) {getSortIcon('costoEstimado')}</TableHead>
                <TableHead className="cursor-pointer" onClick={() => requestSort('activo')}>Estado {getSortIcon('activo')}</TableHead>
                <TableHead className="text-right w-[180px]">Acciones</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {paginatedData.map(proc => (
                  <TableRow key={proc.id}>
                    <TableCell className="font-mono text-xs">{proc.codigo}</TableCell>
                    <TableCell className="font-medium">{proc.nombre}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{proc.procesoPadre}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="font-mono">{proc.activityOrder?.length || 0}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs">{proc.tiempoEstimado !== undefined ? formatMinutesToHours(proc.tiempoEstimado) : '-'}</TableCell>
                    <TableCell className="text-right text-xs">{proc.costoEstimado !== undefined ? `${proc.costoEstimado.toFixed(2)} ${proc.monedaCosto || ''}` : '-'}</TableCell>
                    <TableCell>
                       <Badge className={cn(
                            "text-white border-transparent",
                            proc.activo 
                            ? "bg-green-600 hover:bg-green-700"
                            : "bg-amber-600 hover:bg-amber-700"
                        )}>
                            {proc.activo ? 'Activo' : 'Inactivo'}
                        </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => handleRecalculateTotalsForProcedure(proc)} disabled={isRecalculating === proc.id} title="Recalcular totales mensuales">
                        {isRecalculating === proc.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
                      </Button>
                      <Switch checked={proc.activo} onCheckedChange={() => toggleProcedimientoStatus(proc)} aria-label="Cambiar estado" className="mr-2"/>
                      <Button variant="ghost" size="icon" onClick={() => handleViewHistory(proc)} disabled={!proc.historialDeCambios || proc.historialDeCambios.length === 0} title="Ver historial"><History className="h-4 w-4"/></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(proc)}><Edit2 className="h-4 w-4"/></Button>
                      <Button variant="ghost" size="icon" onClick={() => promptDelete(proc)} className="text-destructive"><Trash2 className="h-4 w-4"/></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between space-x-2 py-4"><span className="text-sm text-muted-foreground">Página {currentPage} de {totalPages} ({sortedAndFilteredData.length} total)</span><div className="space-x-2"><Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Anterior</Button><Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>Siguiente</Button></div></div>
        </CardContent>
      </Card>
      
      <Dialog open={isDialogOpen} onOpenChange={(isOpen) => { setIsDialogOpen(isOpen); if (!isOpen) setEditingProcedimiento(null); }}>
        <DialogContent className="sm:max-w-2xl">
            <DialogHeader><DialogTitle>{editingProcedimiento ? 'Editar' : 'Agregar'} Procedimiento</DialogTitle></DialogHeader>
            <Form {...form}><form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-4 max-h-[75vh] overflow-y-auto pr-4">
              <FormField
                control={form.control}
                name="procesoId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Proceso Padre</FormLabel>
                    <FormControl>
                      <Combobox
                        value={field.value}
                        onChange={field.onChange}
                        options={procesos.filter(p => p.activo !== false && !p.deletedAt).map(p => ({ value: p.id, label: p.proceso }))}
                        placeholder="Seleccione un proceso..."
                        searchPlaceholder="Buscar proceso..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="nombre"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Nombre</FormLabel>
                        <FormControl>
                            <Input {...field} placeholder="Ej: Revisión de Facturas de Proveedores"/>
                        </FormControl>
                        {similarProcedimientoWarning && (
                            <FormDescription className="text-amber-600 flex items-start gap-1.5 pt-1">
                                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                                <span>{similarProcedimientoWarning}</span>
                            </FormDescription>
                        )}
                        <FormMessage />
                    </FormItem>
                )}
              />
              <FormField control={form.control} name="descripcion" render={({ field }) => (<FormItem><FormLabel>Descripción</FormLabel><FormControl><Textarea {...field} value={field.value ?? ''}/></FormControl><FormMessage/></FormItem>)}/>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="clasificacion" render={({ field }) => (<FormItem><FormLabel>Clasificación</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{clasificacionOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select><FormMessage/></FormItem>)}/>
                <FormField control={form.control} name="auditFrequencyInDays" render={({ field }) => (<FormItem><FormLabel>Frecuencia de Auditoría</FormLabel><Select onValueChange={(value) => field.onChange(value ? Number(value) : undefined)} value={field.value?.toString()}><FormControl><SelectTrigger><CalendarCheck2 className="mr-2 h-4 w-4" /><SelectValue placeholder="Opcional: Seleccione..."/></SelectTrigger></FormControl><SelectContent>{auditFrequencyOptions.map(opt => (<SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="sistemasUtilizados" render={({ field }) => (<FormItem><FormLabel>Sistemas Utilizados</FormLabel><MultiSelect options={sistemas.map(s => ({value: s.nombre, label: s.nombre}))} value={field.value} onChange={field.onChange} placeholder='Seleccione sistemas...'/><FormMessage/></FormItem>)}/>
                <FormField control={form.control} name="politicasAsociadasIds" render={({ field }) => (<FormItem><FormLabel>Políticas Vinculadas</FormLabel><MultiSelect options={politicas.filter(p => p.estado === 'Aprobada').map(p => ({value: p.id, label: `${p.codigo} - ${p.titulo}`}))} value={field.value} onChange={field.onChange} placeholder='Vincular políticas...'/><FormMessage /></FormItem>)} />
              </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <FormField
                      control={form.control}
                      name="procedimientosEntradaIds"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Procedimientos de Entrada</FormLabel>
                          <MultiSelect
                            value={field.value}
                            onChange={(newValues) => {
                              const justSelectedInitiator = newValues.includes(PROCEDIMIENTO_INICIADOR) && !field.value?.includes(PROCEDIMIENTO_INICIADOR);
                              if (justSelectedInitiator) {
                                field.onChange([PROCEDIMIENTO_INICIADOR]);
                              } else {
                                const nonInitiatorValues = newValues.filter(v => v !== PROCEDIMIENTO_INICIADOR);
                                field.onChange(nonInitiatorValues);
                              }
                            }}
                            options={[
                              { value: PROCEDIMIENTO_INICIADOR, label: '(Es un procedimiento iniciador)' },
                              ...procedimientos.filter(p => p.id !== editingProcedimiento?.id).map(p => ({ value: p.id, label: p.nombre }))
                            ]}
                            placeholder="Seleccione..."
                          />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                   <FormField control={form.control} name="informacionRecibe" render={({ field }) => (<FormItem><FormLabel>Información que Recibe</FormLabel><FormControl><Textarea placeholder="Ej: Factura del proveedor, Orden de compra aprobada..." {...field} value={field.value ?? ''}/></FormControl><FormMessage/></FormItem>)}/>
                    
                  <FormField
                    control={form.control}
                    name="procedimientosSalidaIds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Procedimientos de Salida</FormLabel>
                        <MultiSelect
                          value={field.value}
                          onChange={(newValues) => {
                            const justSelectedFinalizer = newValues.includes(PROCEDIMIENTO_FINALIZADOR) && !field.value?.includes(PROCEDIMIENTO_FINALIZADOR);
                            if (justSelectedFinalizer) {
                              field.onChange([PROCEDIMIENTO_FINALIZADOR]);
                            } else {
                              const nonFinalizerValues = newValues.filter(v => v !== PROCEDIMIENTO_FINALIZADOR);
                              field.onChange(nonFinalizerValues);
                            }
                          }}
                          options={[
                            { value: PROCEDIMIENTO_FINALIZADOR, label: '(Es un procedimiento finalizador)' },
                            ...procedimientos.filter(p => p.id !== editingProcedimiento?.id).map(p => ({ value: p.id, label: p.nombre }))
                          ]}
                          placeholder="Seleccione..."
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                   <FormField control={form.control} name="informacionEntrega" render={({ field }) => (<FormItem><FormLabel>Información que Entrega</FormLabel><FormControl><Textarea placeholder="Ej: Pago programado, Factura registrada en sistema..." {...field} value={field.value ?? ''}/></FormControl><FormMessage/></FormItem>)}/>
                </div>
              <DialogFooter><DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose><Button type="submit">Guardar</Button></DialogFooter>
            </form></Form>
      </DialogContent>
      </Dialog>
      
      <AlertDialog open={isConfirmDeleteDialogOpen} onOpenChange={setIsConfirmDeleteDialogOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle><AlertTriangle className="inline-block mr-2 text-destructive"/>Confirmar Eliminación</AlertDialogTitle><AlertDialogDescription>¿Seguro que desea eliminar el procedimiento "{procedimientoToDelete?.nombre}"? Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel onClick={()=>setProcedimientoToDelete(null)}>Cancelar</AlertDialogCancel><AlertDialogAction onClick={executeDelete} className={buttonVariants({variant: "destructive"})}>Eliminar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    
      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Historial de Cambios para: {procedimientoForHistory?.nombre}</DialogTitle>
          </DialogHeader>
          <div className="py-4 max-h-[60vh] overflow-y-auto">
            {procedimientoForHistory?.historialDeCambios && procedimientoForHistory.historialDeCambios.length > 0 ? (
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
                  {procedimientoForHistory.historialDeCambios
                    .sort((a,b) => parseISO(b.timestamp).getTime() - parseISO(a.timestamp).getTime())
                    .map((cambio, index) => {
                        let beforeText: string | number | React.ReactNode = String(cambio.before ?? 'N/A');
                        let afterText: string | number | React.ReactNode = String(cambio.after ?? 'N/A');

                        if (cambio.field === 'procesoId') {
                            beforeText = procesosMap.get(cambio.before) || beforeText;
                            afterText = procesosMap.get(cambio.after) || afterText;
                        } else if (cambio.field === 'politicasAsociadasIds') {
                            const beforeIds = Array.isArray(cambio.before) ? cambio.before : [];
                            const afterIds = Array.isArray(cambio.after) ? cambio.after : [];
                            beforeText = beforeIds.map((id: string) => politicasMap.get(id) || id).join(', ') || 'Ninguna';
                            afterText = afterIds.map((id: string) => politicasMap.get(id) || id).join(', ') || 'Ninguna';
                        }
                        
                        return (
                        <TableRow key={index}>
                          <TableCell className="text-xs">{format(parseISO(cambio.timestamp), 'dd/MM/yy HH:mm', { locale: es })}</TableCell>
                          <TableCell className="text-sm capitalize">{cambio.field.replace(/([A-Z])/g, ' $1').trim()}</TableCell>
                          <TableCell className="text-xs">{beforeText}</TableCell>
                          <TableCell className="text-xs font-semibold">{afterText}</TableCell>
                        </TableRow>
                        )
                    })}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-center">No hay historial de cambios registrado.</p>
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
