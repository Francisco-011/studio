

'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

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
import { Database, Search, Trash2, AlertTriangle, FileText, FileX, Edit2, RotateCcw, Filter, ChevronsUpDown, ArrowUp, ArrowDown, DollarSign, Clock, Info, ChevronRight, Save, ChevronDown, History, Workflow, Ban } from "lucide-react";
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

import { toast } from '@/hooks/use-toast';
import { cn, formatMinutesToHours } from '@/lib/utils';
import { useAreas } from '@/contexts/AreasContext';
import { useDepartamentos } from '@/contexts/DepartamentosContext';
import { usePuestos } from '@/contexts/PuestosContext';
import { useActividades, type Actividad } from '@/contexts/ActividadesContext';
import { useSistemasCostos } from '@/contexts/SistemasCostosContext';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useProcesos, type CapturedProcess, capturaFormSchema, type CapturaFormData, auditFrequencyOptions } from '@/contexts/ProcesosContext';
import { usePoliticas } from '@/contexts/PoliticasContext';
import { useProcedimientos, type Procedimiento } from '@/contexts/ProcedimientosContext';


const NO_DEPARTAMENTO_SELECTED = "__NO_DEPARTAMENTO__";

type ActivityCountFilterType = 'all' | 'none' | 'some';
type SortableProcessKeys = 'proceso' | 'area' | 'departamento' | 'puesto' | 'updatedAt' | 'activo' | 'numActividades';
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
  const { politicas: allPoliticas, isLoadingPoliticas } = usePoliticas();
  const { procedimientos: allProcedimientos, isLoadingProcedimientos } = useProcedimientos();
  
  const { 
    procesos: allCapturedData, 
    updateProceso, 
    softDeleteProceso, 
    restoreProceso, 
    toggleProcesoStatus, 
    isLoadingProcesos 
  } = useProcesos();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAreaFilter, setSelectedAreaFilter] = useState('all');
  const [selectedDeptoFilter, setSelectedDeptoFilter] = useState('all');
  const [selectedPuestoFilter, setSelectedPuestoFilter] = useState('all');
  const [processStatusFilter, setProcessStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [activityCountFilter, setActivityCountFilter] = useState<ActivityCountFilterType>('all');
  const [activityStatusFilter, setActivityStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  
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

  useEffect(() => {
    if (editingProcess) {
      editForm.reset({
        ...editingProcess,
        departamento: editingProcess.departamento || NO_DEPARTAMENTO_SELECTED
      });
    }
  }, [editingProcess, editForm]);
  
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
    if (activityCountFilter !== 'all') {
        dataToFilter = dataToFilter.filter(proc => {
            const procedureIds = proc.procedimientoOrder || [];
            const hasActivities = allProcedimientos
                .filter(p => procedureIds.includes(p.id))
                .some(p => p.activityOrder && p.activityOrder.length > 0);
            return activityCountFilter === 'some' ? hasActivities : !hasActivities;
        });
    }
    
    if (sortConfig !== null) {
      dataToFilter.sort((a, b) => {
        let valA: any;
        let valB: any;
        
        const getTotalActivities = (proc: CapturedProcess) => {
            const procedureIds = proc.procedimientoOrder || [];
            return allProcedimientos
                .filter(p => procedureIds.includes(p.id))
                .reduce((sum, p) => sum + (p.activityOrder?.length || 0), 0);
        }

        if (sortConfig.key === 'numActividades') { valA = getTotalActivities(a); valB = getTotalActivities(b); }
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
       dataToFilter.sort((a, b) => (a.codigo || '').localeCompare(b.codigo || ''));
    }
    return dataToFilter;
  }, [allCapturedData, searchTerm, selectedAreaFilter, selectedDeptoFilter, selectedPuestoFilter, processStatusFilter, activityCountFilter, sortConfig, allProcedimientos]);

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
    softDeleteProceso(processToDelete.id);
    setProcessToDelete(null);
    setIsConfirmDeleteProcessOpen(false);
  };
  const handleRestoreProcess = (id: string) => {
    restoreProceso(id);
  };

  const handleToggleProcessStatus = (processId: string) => {
    toggleProcesoStatus(processId);
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
    const dataToUpdate: Partial<Omit<CapturedProcess, 'id'>> = {
      ...values,
      departamento: values.departamento === NO_DEPARTAMENTO_SELECTED ? undefined : values.departamento,
    };
    updateProceso(editingProcess.id, dataToUpdate);
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
      "ID", "Proceso", "Area", "Departamento", "Puesto", "Estado", "Objetivo",
      "Tiempo Estimado (min)", "Tiempo Ideal (min)", "Costo Estimado", "Costo Ideal", "Moneda",
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
        escapeCsvCell(proc.tiempoEstimado),
        escapeCsvCell(proc.tiempoIdeal),
        escapeCsvCell(proc.costoEstimado),
        escapeCsvCell(proc.costoIdeal),
        escapeCsvCell(proc.monedaCosto),
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

  const clearFilters = () => { setSearchTerm(''); setSelectedAreaFilter('all'); setSelectedDeptoFilter('all'); setSelectedPuestoFilter('all'); setProcessStatusFilter('all'); setActivityCountFilter('all'); };

  const availableProcessesForSelection = useMemo(() => {
    return allCapturedData
      .filter(p => !p.deletedAt && p.id !== editingProcess?.id)
      .map(p => ({ id: p.id, nombre: p.proceso }));
  }, [allCapturedData, editingProcess]);

  if (isLoadingProcesos || isLoadingActividades || isLoadingAreas || isLoadingPuestos || isLoadingProcedimientos) return <div className="container mx-auto py-8"><div className="flex items-center justify-center min-h-[400px]"><Database className="h-16 w-16 text-muted-foreground animate-pulse" /><p className="ml-4 text-lg text-muted-foreground">Cargando...</p></div></div>;

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
              <TableHead className="text-center w-[120px]"><TooltipProvider><Tooltip><TooltipTrigger>Tiempo Est.</TooltipTrigger><TooltipContent>Calculado de actividades</TooltipContent></Tooltip></TooltipProvider></TableHead>
              <TableHead className="text-center w-[120px]"><TooltipProvider><Tooltip><TooltipTrigger>Costo Est.</TooltipTrigger><TooltipContent>Calculado de actividades</TooltipContent></Tooltip></TooltipProvider></TableHead>
              <TableHead className="text-center w-[80px] cursor-pointer hover:bg-muted/50 group" onClick={() => requestSort('numActividades')}><div className="flex items-center justify-center">Activ. {getSortIcon('numActividades')}</div></TableHead>
              <TableHead className="w-[140px] cursor-pointer hover:bg-muted/50 group" onClick={() => requestSort('updatedAt')}><div className="flex items-center">Últ. Modif. {getSortIcon('updatedAt')}</div></TableHead>
              <TableHead className="text-right w-[140px]">Acciones</TableHead>
            </TableRow></TableHeader><TableBody>{paginatedData.map((proc) => {
                const isExpanded = expandedRows[proc.id];
                const proceduresForProcess = (proc.procedimientoOrder || [])
                    .map(procId => allProcedimientos.find(p => p.id === procId))
                    .filter((p): p is Procedimiento => !!p);
                
                const totalActivitiesCount = proceduresForProcess.reduce((sum, currentProc) => sum + (currentProc.activityOrder?.length || 0), 0);

                const linkedPolicies = proc.politicasAsociadas
                  ?.map(link => {
                    const policy = allPoliticas.find(p => p.id === link.policyId)
                    return policy ? { ...policy, linkType: link.linkType } : null
                  })
                  .filter(Boolean);

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
                        {proc.tiempoEstimado !== undefined ? formatMinutesToHours(proc.tiempoEstimado) : '-'}
                    </TableCell>
                    <TableCell className="text-center text-xs">
                        {proc.costoEstimado?.toFixed(2) ?? '-'}
                    </TableCell>
                    <TableCell className="text-center"><Badge variant="outline" className="cursor-default">{totalActivitiesCount}</Badge></TableCell>
                    <TableCell className="text-xs">{proc.updatedAt && isValid(new Date(proc.updatedAt)) ? format(new Date(proc.updatedAt), 'dd/MM/yy HH:mm', { locale: es }) : '-'}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Switch checked={proc.activo !== false} onCheckedChange={() => handleToggleProcessStatus(proc.id)} className="mr-1" />
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => router.push(`/procedimientos?proceso=${proc.id}`)}><Workflow className="h-4 w-4"/></Button>
                          </TooltipTrigger>
                          <TooltipContent><p>Gestionar Procedimientos</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
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
                              <DetailDisplay title="Objetivo" value={proc.descripcion} isTextarea />
                              <DetailDisplay 
                                title="Políticas Vinculadas"
                                value={linkedPolicies?.map(p => `${p!.titulo} (${p!.linkType})`)}
                                isList
                              />
                          </CardContent>
                        </Card>
                        <div>
                          <h4 className="font-semibold text-lg mb-2">Procedimientos y Actividades</h4>
                           {proceduresForProcess.length > 0 ? (
                                <Accordion type="multiple" className="w-full space-y-2">
                                  {proceduresForProcess.map((procedure, procIndex) => {
                                      const isInactive = procedure.activo === false;
                                      const activitiesToShow = (procedure.activityOrder || [])
                                        .map(actId => allActivities.find(a => a.id === actId))
                                        .filter((act): act is Actividad => !!act)
                                        .filter(act => {
                                            if (activityStatusFilter === 'all') return true;
                                            if (activityStatusFilter === 'active') return act.activa;
                                            if (activityStatusFilter === 'inactive') return !act.activa;
                                            return true;
                                        });

                                      return (
                                          <AccordionItem value={procedure.id} key={procedure.id} className="bg-background rounded-md border">
                                              <AccordionTrigger className="p-4 hover:no-underline">
                                                  <div className="flex items-center gap-4 text-left">
                                                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-secondary-foreground font-bold">{procIndex + 1}</span>
                                                      <span className={cn("text-base font-medium flex items-center gap-2", isInactive && "italic text-muted-foreground")}>{procedure.nombre} <Badge variant="outline">{procedure.clasificacion}</Badge> {isInactive && <Badge variant="destructive">Inactivo</Badge>}</span>
                                                  </div>
                                              </AccordionTrigger>
                                              <AccordionContent className="p-4 pt-0 pl-16 space-y-3">
                                                  <DetailDisplay title="Descripción del Procedimiento" value={procedure.descripcion} isTextarea />
                                                   {activitiesToShow.length > 0 ? (
                                                      <div className="space-y-2">
                                                          {activitiesToShow.map((act, actIndex) => (
                                                            <Card key={act.id} className="bg-background/50">
                                                              <CardHeader className="flex-row items-center justify-between gap-4 space-y-0 p-3">
                                                                <div className="flex items-center gap-3">
                                                                  <span className="text-sm font-semibold">{procIndex + 1}.{actIndex + 1}</span>
                                                                  <p className="font-medium text-sm">{act.nombre}</p>
                                                                  {!act.activa && <Badge variant="outline" className="text-xs">Inactiva</Badge>}
                                                                </div>
                                                                <Button variant="ghost" size="sm" onClick={() => handleEditActivity(act.nombre)}>Editar</Button>
                                                              </CardHeader>
                                                            </Card>
                                                          ))}
                                                      </div>
                                                   ) : (
                                                      <p className="text-sm text-muted-foreground italic">Este procedimiento no tiene actividades o no coinciden con el filtro.</p>
                                                   )}
                                              </AccordionContent>
                                          </AccordionItem>
                                      )
                                  })}
                                </Accordion>
                           ) : (
                             <p className="text-sm text-muted-foreground italic flex items-center gap-2"><Workflow className="h-4 w-4"/> Este proceso no tiene procedimientos definidos.</p>
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
              <FormField control={editForm.control} name="descripcion" render={({ field }) => (<FormItem><FormLabel>Objetivo</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={editForm.control} name="auditFrequencyInDays" render={({ field }) => (<FormItem><FormLabel>Frecuencia de Auditoría</FormLabel><Select onValueChange={(value) => field.onChange(value === 'none' ? undefined : Number(value))} value={field.value?.toString() || 'none'}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione..."/></SelectTrigger></FormControl><SelectContent><SelectItem value="none">No requiere</SelectItem>{auditFrequencyOptions.map(opt => (<SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>))}</SelectContent></Select><FormMessage/></FormItem>)}/>
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
            <DialogClose asChild><Button type="button" variant="outline">Cerrar</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
