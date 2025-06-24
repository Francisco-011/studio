
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
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
import { Database, Search, Eye, Trash2, AlertTriangle, FileText, FileX, Edit2, RotateCcw, Filter, ChevronsUpDown, ArrowUp, ArrowDown, DollarSign, Clock, Info, CalendarClock, ChevronRight } from "lucide-react";
import type { CapturaFormData } from '../captura/page';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useAreas } from '@/contexts/AreasContext';
import { usePuestos } from '@/contexts/PuestosContext';
import { useActividades, type Actividad } from '@/contexts/ActividadesContext';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";


export interface CapturedProcess extends CapturaFormData {
  id: string;
  capturedAt: string;
  updatedAt?: number;
  deletedAt?: string;
  activo?: boolean;
}

const CAPTURED_DATA_LOCAL_STORAGE_KEY = 'proceza-captured-data';

type ActivityCountFilterType = 'all' | 'none' | 'some';
type SortableProcessKeys = 'proceso' | 'area' | 'puesto' | 'frecuencia' | 'tiempoEstimado' | 'costoEstimado' | 'updatedAt' | 'activo' | 'numActividades';
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
  const searchParams = useSearchParams();
  const { areas, isLoading: isLoadingAreas } = useAreas();
  const { puestos, isLoadingPuestos } = usePuestos();
  const { actividades: allActivities, isLoadingActividades } = useActividades();
  
  const [allCapturedData, setAllCapturedData] = useState<CapturedProcess[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAreaFilter, setSelectedAreaFilter] = useState('all');
  const [selectedPuestoFilter, setSelectedPuestoFilter] = useState('all');
  const [processStatusFilter, setProcessStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [activityCountFilter, setActivityCountFilter] = useState<ActivityCountFilterType>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [processToDelete, setProcessToDelete] = useState<CapturedProcess | null>(null);
  const [isConfirmDeleteProcessOpen, setIsConfirmDeleteProcessOpen] = useState(false);
  const [isRecoveryDialogOpen, setIsRecoveryDialogOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});


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
            updatedAt: p.updatedAt || (p.capturedAt ? parseISO(p.capturedAt).getTime() : Date.now())
          };
          // Old data migration
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
    const searchQuery = searchParams.get('search');
    if (searchQuery) setSearchTerm(searchQuery);
  }, [searchParams]);

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
  }, [allCapturedData, searchTerm, selectedAreaFilter, selectedPuestoFilter, processStatusFilter, activityCountFilter, sortConfig]);

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
    } catch (error) {
      toast({ title: "Error", description: "No se pudo eliminar el proceso.", variant: "destructive"});
    }
    setProcessToDelete(null);
    setIsConfirmDeleteProcessOpen(false);
  };
  const handleRestoreProcess = (processId: string) => {
    try {
      const updatedData = allCapturedData.map(p => {
        if (p.id === processId) {
          const { deletedAt, ...restoredProc } = p;
          return { ...restoredProc, activo: true, updatedAt: Date.now() };
        }
        return p;
      });
      setAllCapturedData(updatedData);
      toast({ title: "Proceso Restaurado" });
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
  };

  const handleEditProcess = (proc: CapturedProcess) => router.push(`/captura?editId=${proc.id}`);
  const handleExport = () => { /* ... (export logic remains same) */ };

  const getEffectiveCost = (proc: CapturedProcess) => {
    if (proc.costoEstimado !== undefined && proc.costoEstimado !== null) return { value: proc.costoEstimado, isDerived: false };
    const derivedCost = (proc.activityOrder || []).reduce((sum, actId) => sum + (allActivities.find(a => a.id === actId)?.costoEstimadoActividad || 0), 0);
    return { value: derivedCost, isDerived: true };
  };
  const clearFilters = () => { setSearchTerm(''); setSelectedAreaFilter('all'); setSelectedPuestoFilter('all'); setProcessStatusFilter('all'); setActivityCountFilter('all'); };

  if (isLoading || isLoadingActividades || isLoadingAreas || isLoadingPuestos) return <div className="container mx-auto py-8"><div className="flex items-center justify-center min-h-[400px]"><Database className="h-16 w-16 text-muted-foreground animate-pulse" /><p className="ml-4 text-lg text-muted-foreground">Cargando...</p></div></div>;

  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader><div className="flex items-center gap-2 mb-1"><Database className="h-6 w-6 text-primary" /><CardTitle className="text-2xl font-headline">Procesos y Flujos Registrados</CardTitle></div><CardDescription>Visualiza, busca, filtra y gestiona todos los procesos y flujos de información registrados en el sistema.</CardDescription></CardHeader>
        <CardContent>
          <div className="mb-4 p-4 border rounded-lg bg-muted/30">
            <div className="flex items-center gap-2 mb-3"><Filter className="h-5 w-5 text-primary"/><h4 className="text-md font-semibold">Filtros de Búsqueda</h4></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-5 gap-4 items-end">
              <div className="relative xl:col-span-2 md:col-span-full sm:col-span-full"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" /><Input type="search" placeholder="Buscar palabra clave..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10"/></div>
              <div className="w-full"><Label htmlFor="area-filter" className="text-xs font-medium text-muted-foreground ml-1">Área</Label><Select value={selectedAreaFilter} onValueChange={(v) => { setSelectedAreaFilter(v); setSelectedPuestoFilter('all'); }} disabled={isLoadingAreas}><SelectTrigger id="area-filter"><SelectValue placeholder={isLoadingAreas ? "Cargando..." : "Todas"} /></SelectTrigger><SelectContent><SelectItem value="all">Todas las Áreas</SelectItem>{areas.map(area => <SelectItem key={area.id} value={area.nombre}>{area.nombre}</SelectItem>)}</SelectContent></Select></div>
              <div className="w-full"><Label htmlFor="puesto-filter" className="text-xs font-medium text-muted-foreground ml-1">Puesto</Label><Select value={selectedPuestoFilter} onValueChange={setSelectedPuestoFilter} disabled={isLoadingPuestos}><SelectTrigger id="puesto-filter"><SelectValue placeholder={isLoadingPuestos ? "Cargando..." : "Todos"} /></SelectTrigger><SelectContent><SelectItem value="all">Todos los Puestos</SelectItem>{puestos.map(puesto => <SelectItem key={puesto.id} value={puesto.nombre}>{puesto.nombre}</SelectItem>)}</SelectContent></Select></div>
            </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-4 items-end">
               <div className="w-full"><Label htmlFor="status-filter" className="text-xs font-medium text-muted-foreground ml-1">Estado</Label><Select value={processStatusFilter} onValueChange={(v: 'all' | 'active' | 'inactive') => setProcessStatusFilter(v)}><SelectTrigger id="status-filter"><SelectValue placeholder="Todos"/></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="active">Activos</SelectItem><SelectItem value="inactive">Inactivos</SelectItem></SelectContent></Select></div>
                <div className="w-full"><Label htmlFor="activity-filter" className="text-xs font-medium text-muted-foreground ml-1">Actividades</Label><Select value={activityCountFilter} onValueChange={(v: ActivityCountFilterType) => setActivityCountFilter(v)}><SelectTrigger id="activity-filter"><SelectValue placeholder="Todos"/></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="some">Con Actividades</SelectItem><SelectItem value="none">Sin Actividades</SelectItem></SelectContent></Select></div>
                <Button onClick={clearFilters} variant="link" className="mt-3 px-0 text-sm self-end">Limpiar Todos los Filtros</Button>
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

                return (
                <React.Fragment key={proc.id}>
                <TableRow className={cn(proc.activo === false && "bg-muted/40", isExpanded && "border-b-0")}>
                    <TableCell className="p-1"><Button variant="ghost" size="icon" onClick={() => toggleRow(proc.id)}><ChevronRight className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-90")} /></Button></TableCell>
                    <TableCell className="font-medium">{proc.proceso}</TableCell>
                    <TableCell>{proc.area}</TableCell>
                    <TableCell>{proc.puesto}</TableCell>
                    <TableCell className="text-center"><Badge variant={proc.activo !== false ? 'default' : 'outline'} className={cn(proc.activo === false && "border-destructive text-destructive", proc.activo !== false && 'bg-green-500 hover:bg-green-600')}>{proc.activo !== false ? 'Activo' : 'Inactivo'}</Badge></TableCell>
                    <TableCell className="text-center text-xs">{proc.tiempoEstimado ?? '-'} / {proc.tiempoIdeal ?? '-'}</TableCell>
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
                    <TableCell className="text-right space-x-1"><Switch checked={proc.activo !== false} onCheckedChange={() => handleToggleProcessStatus(proc.id)} className="mr-1" /><Button variant="ghost" size="icon" onClick={() => handleEditProcess(proc)}><Edit2 className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => promptDeleteProcess(proc)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button></TableCell>
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
                              <div className="space-y-3">
                                {proc.activityOrder.map((actId, index) => {
                                  const act = allActivities.find(a => a.id === actId);
                                  if (!act) return <div key={`${proc.id}-act-${actId}`} className="p-2 border rounded text-sm text-destructive">Actividad con ID {actId} no encontrada.</div>;
                                  return (
                                    <Card key={`${proc.id}-act-${act.id}-${index}`} className="bg-background">
                                      <CardHeader className="flex-row items-center gap-4 space-y-0 p-4">
                                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">{index + 1}</span>
                                        <CardTitle className="text-base">{act.nombre}</CardTitle>
                                      </CardHeader>
                                      <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4 pt-0 pl-16">
                                        <DetailDisplay title="Descripción" value={act.descripcionBreve} isTextarea />
                                        <DetailDisplay title="Tiempo Estimado" value={act.tiempoEstimadoActividad !== undefined ? `${act.tiempoEstimadoActividad} min` : null} />
                                        <DetailDisplay title="Costo Estimado" value={act.costoEstimadoActividad !== undefined ? `${act.costoEstimadoActividad} ${act.monedaCostoActividad || ''}` : null} />
                                        <DetailDisplay title="Sistema Utilizado" value={act.sistemaUtilizado} />
                                        <DetailDisplay title="Frecuencia" value={act.frecuenciaActividad} />
                                      </CardContent>
                                    </Card>
                                  );
                                })}
                              </div>
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
          ) : (<div className="mt-6 p-8 border-dashed rounded-lg flex flex-col items-center justify-center min-h-[300px] bg-muted/20"><FileX className="h-16 w-16 text-muted-foreground mb-4" /><p className="text-lg font-semibold">{allCapturedData.filter(p => !p.deletedAt).length === 0 ? "No hay datos capturados" : "No se encontraron resultados"}</p><p className="text-sm text-muted-foreground">{allCapturedData.filter(p => !p.deletedAt).length === 0 ? 'Comience registrando procesos en "Captura".' : 'Intente ajustar su búsqueda o filtros.'}</p></div>)}
        </CardContent>
      </Card>
      
      <AlertDialog open={isConfirmDeleteProcessOpen} onOpenChange={setIsConfirmDeleteProcessOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle><div className="flex items-center"><AlertTriangle className="h-5 w-5 mr-2 text-destructive" />Confirmar Eliminación</div></AlertDialogTitle><AlertDialogDescription>¿Está seguro de eliminar el proceso "{processToDelete?.proceso}"? La acción lo moverá a la papelera.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel onClick={() => setProcessToDelete(null)}>Cancelar</AlertDialogCancel><AlertDialogAction onClick={executeDeleteProcess} className={buttonVariants({variant: "destructive"})}>Eliminar Proceso</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}

