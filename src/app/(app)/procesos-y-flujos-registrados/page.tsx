
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Switch } from "@/components/ui/switch";
import { Database, Search, Eye, Trash2, AlertTriangle, FileText, FileX, Edit2, RotateCcw, CheckSquare, XSquare, ListTree, Clock, Repeat, LayersIcon, ArrowRightLeft, Info, CalendarClock, Filter, ArrowUpZA, ArrowDownAZ, ChevronsUpDown, ArrowDown, ArrowUp } from "lucide-react";
import type { CapturaFormData } from '../captura/page';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useAreas } from '@/contexts/AreasContext';
import { usePuestos } from '@/contexts/PuestosContext';
import type { Actividad } from '@/contexts/ActividadesContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";


export interface CapturedProcess extends CapturaFormData {
  id: string;
  capturedAt: string;
  updatedAt?: number;
  deletedAt?: string;
  activo?: boolean;
  // activityOrder is already in CapturaFormData schema if optional
}

const CAPTURED_DATA_LOCAL_STORAGE_KEY = 'proceza-captured-data';
const ACTIVIDADES_LOCAL_STORAGE_KEY = 'proceza-actividades';

type ActivityCountFilterType = 'all' | 'none' | 'some';
type SortableProcessKeys = keyof CapturedProcess | 'numActividades';
type SortDirection = 'ascending' | 'descending';

interface SortConfig {
  key: SortableProcessKeys;
  direction: SortDirection;
}


const DetailSection = ({ title, value, isList = false, isTextarea = false }: { title: string, value?: string | string[] | number, isList?: boolean, isTextarea?: boolean }) => {

  if (value === undefined || (Array.isArray(value) && value.length === 0) || (typeof value === 'string' && value.trim() === '' && !isTextarea)) {
    return (
      <div>
        <h4 className="font-semibold text-sm">{title}:</h4>
        <p className="text-sm text-muted-foreground">No especificado.</p>
      </div>
    );
  }

  if (isList && Array.isArray(value)) {
    return (
      <div>
        <h4 className="font-semibold text-sm">{title}:</h4>
        <div className="flex flex-wrap gap-1 mt-1">
          {value.map((item, idx) => (
            <Badge key={idx} variant="secondary">{item}</Badge>
          ))}
        </div>
      </div>
    );
  }

  const displayValue = Array.isArray(value) ? value.join(', ') : value;

  return (
    <div>
      <h4 className="font-semibold text-sm">{title}:</h4>
      <p className={cn("text-sm text-muted-foreground", isTextarea && "whitespace-pre-wrap")}>
        {typeof displayValue === 'number' ? displayValue.toString() : displayValue}
      </p>
    </div>
  );
};


export default function ProcesosYFlujosRegistradosPage() {
  const router = useRouter();
  const { areas, isLoading: isLoadingAreas } = useAreas();
  const { puestos, isLoadingPuestos } = usePuestos();

  const [allCapturedData, setAllCapturedData] = useState<CapturedProcess[]>([]);
  const [allActivities, setAllActivities] = useState<Actividad[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAreaFilter, setSelectedAreaFilter] = useState('all');
  const [selectedPuestoFilter, setSelectedPuestoFilter] = useState('all');
  const [processStatusFilter, setProcessStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [activityCountFilter, setActivityCountFilter] = useState<ActivityCountFilterType>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProcess, setSelectedProcess] = useState<CapturedProcess | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [processToDelete, setProcessToDelete] = useState<CapturedProcess | null>(null);
  const [isConfirmDeleteProcessOpen, setIsConfirmDeleteProcessOpen] = useState(false);
  const [isRecoveryDialogOpen, setIsRecoveryDialogOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);


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

          if (!newP.procesosEntrada) {
            if (typeof p.formatosRecibe === 'string') {
              newP.procesosEntrada = [p.formatosRecibe];
            } else if (Array.isArray(p.formatosRecibe)) {
              newP.procesosEntrada = p.formatosRecibe;
            } else {
              newP.procesosEntrada = [];
            }
          }
          delete newP.formatosRecibe;

          if (!newP.procesosSalida) {
            if (typeof p.formatosEntrega === 'string') {
              newP.procesosSalida = [p.formatosEntrega];
            } else if (Array.isArray(p.formatosEntrega)) {
              newP.procesosSalida = p.formatosEntrega;
            } else {
              newP.procesosSalida = [];
            }
          }
          delete newP.formatosEntrega;

          return newP as CapturedProcess;
        });
        setAllCapturedData(migratedData);
      } else {
        setAllCapturedData([]);
      }

      const storedActivities = localStorage.getItem(ACTIVIDADES_LOCAL_STORAGE_KEY);
      if (storedActivities) {
        setAllActivities(JSON.parse(storedActivities));
      } else {
        setAllActivities([]);
      }

    } catch (error) {
      console.error("Error loading data from localStorage:", error);
      toast({ title: "Error al cargar datos", description: "No se pudieron cargar los procesos y flujos registrados.", variant: "destructive" });
      setAllCapturedData([]);
      setAllActivities([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoading) {
        try {
            localStorage.setItem(CAPTURED_DATA_LOCAL_STORAGE_KEY, JSON.stringify(allCapturedData));
        } catch (error) {
            console.error("Error saving captured data to localStorage:", error);
            toast({ title: "Error al guardar", description: "No se pudieron guardar los cambios en los procesos.", variant: "destructive" });
        }
    }
  }, [allCapturedData, isLoading]);

  const sortedAndFilteredData = useMemo(() => {
    let dataToFilter = allCapturedData.filter(proc => !proc.deletedAt);

    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      dataToFilter = dataToFilter.filter(
        (proc) =>
          proc.proceso.toLowerCase().includes(lowerSearchTerm) ||
          proc.area.toLowerCase().includes(lowerSearchTerm) ||
          proc.puesto.toLowerCase().includes(lowerSearchTerm) ||
          proc.descripcion.toLowerCase().includes(lowerSearchTerm)
      );
    }

    if (selectedAreaFilter !== 'all') {
      dataToFilter = dataToFilter.filter(proc => proc.area === selectedAreaFilter);
    }

    if (selectedPuestoFilter !== 'all') {
      dataToFilter = dataToFilter.filter(proc => proc.puesto === selectedPuestoFilter);
    }

    if (processStatusFilter !== 'all') {
      dataToFilter = dataToFilter.filter(proc =>
        processStatusFilter === 'active' ? proc.activo !== false : proc.activo === false
      );
    }

    if (activityCountFilter !== 'all') {
      dataToFilter = dataToFilter.filter(proc => {
        const numActivities = proc.activityOrder?.length || 0;
        if (activityCountFilter === 'none') return numActivities === 0;
        if (activityCountFilter === 'some') return numActivities > 0;
        return true;
      });
    }
    
    if (sortConfig !== null) {
      dataToFilter.sort((a, b) => {
        let valA: any = a[sortConfig.key as keyof CapturedProcess];
        let valB: any = b[sortConfig.key as keyof CapturedProcess];

        if (sortConfig.key === 'numActividades') {
          valA = a.activityOrder?.length || 0;
          valB = b.activityOrder?.length || 0;
        } else if (sortConfig.key === 'capturedAt' || sortConfig.key === 'updatedAt') {
          valA = valA ? (isValid(parseISO(valA as string)) ? parseISO(valA as string).getTime() : (typeof valA === 'number' ? valA : 0)) : 0;
          valB = valB ? (isValid(parseISO(valB as string)) ? parseISO(valB as string).getTime() : (typeof valB === 'number' ? valB : 0)) : 0;
        } else if (sortConfig.key === 'activo') {
            valA = a.activo !== false;
            valB = b.activo !== false;
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
       dataToFilter.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }


    return dataToFilter;
  }, [allCapturedData, searchTerm, selectedAreaFilter, selectedPuestoFilter, processStatusFilter, activityCountFilter, sortConfig]);

  const requestSort = (key: SortableProcessKeys) => {
    let direction: SortDirection = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: SortableProcessKeys) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ChevronsUpDown className="ml-2 h-3 w-3 opacity-40" />;
    }
    return sortConfig.direction === 'ascending' ? <ArrowUp className="ml-2 h-3 w-3" /> : <ArrowDown className="ml-2 h-3 w-3" />;
  };


  const recoverableProcesses = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return allCapturedData.filter(proc => proc.deletedAt && new Date(proc.deletedAt) > thirtyDaysAgo)
                          .sort((a,b) => new Date(b.deletedAt!).getTime() - new Date(a.deletedAt!).getTime());
  }, [allCapturedData]);

  const handleViewDetails = (proc: CapturedProcess) => {
    setSelectedProcess(proc);
    setIsDetailDialogOpen(true);
  };

  const promptDeleteProcess = (proc: CapturedProcess) => {
    setProcessToDelete(proc);
    setIsConfirmDeleteProcessOpen(true);
  };

  const executeDeleteProcess = () => {
    if (!processToDelete) return;
    try {
      const updatedData = allCapturedData.map(p =>
        p.id === processToDelete.id
          ? { ...p, deletedAt: new Date().toISOString(), updatedAt: Date.now() }
          : p
      );
      setAllCapturedData(updatedData);
      toast({ title: "Proceso Eliminado", description: `El proceso "${processToDelete.proceso}" ha sido movido a la papelera de recuperación.`, variant: 'destructive' });
    } catch (error) {
      console.error("Error soft deleting process from localStorage:", error);
      toast({ title: "Error", description: "No se pudo eliminar el proceso.", variant: "destructive"});
    }
    setProcessToDelete(null);
    setIsConfirmDeleteProcessOpen(false);
  };

  const handleRestoreProcess = (processId: string) => {
    try {
      const updatedData = allCapturedData.map(p => {
        if (p.id === processId) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { deletedAt, ...restoredProc } = p;
          return { ...restoredProc, activo: true, updatedAt: Date.now() };
        }
        return p;
      });
      setAllCapturedData(updatedData);
      const restoredProcess = updatedData.find(p => p.id === processId);
      toast({ title: "Proceso Restaurado", description: `El proceso "${restoredProcess?.proceso}" ha sido restaurado y activado.` });
    } catch (error) {
      console.error("Error restoring process:", error);
      toast({ title: "Error al Restaurar", description: "No se pudo restaurar el proceso.", variant: "destructive"});
    }
  };

  const handleToggleProcessStatus = (processId: string) => {
    const processToToggle = allCapturedData.find(p => p.id === processId);
    if (!processToToggle) return;

    const targetStatus = !(processToToggle.activo !== false);

    if (targetStatus === false) {
      const linkedActiveActivities = allActivities.filter(act =>
        act.activa && act.procesosAsociadosIds?.includes(processId)
      );

      if (linkedActiveActivities.length > 0) {
        toast({
          title: "Inactivación Bloqueada",
          description: `El proceso "${processToToggle.proceso}" no puede inactivarse porque está asociado a ${linkedActiveActivities.length} actividad(es) activa(s). Desactive o desvincule estas actividades primero.`,
          variant: "destructive",
          duration: 7000,
        });
        return;
      }
    }

    const updatedData = allCapturedData.map(p =>
      p.id === processId ? { ...p, activo: targetStatus, updatedAt: Date.now() } : p
    );
    setAllCapturedData(updatedData);
    toast({
      title: `Proceso ${targetStatus ? 'Activado' : 'Inactivado'}`,
      description: `El proceso "${processToToggle.proceso}" ha sido ${targetStatus ? 'activado' : 'inactivado'}.`,
    });
  };


  const handleEditProcess = (proc: CapturedProcess) => {
    router.push(`/captura?editId=${proc.id}`);
  };

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
      toast({ title: "Nada que exportar", description: "No hay procesos/flujos que coincidan con los filtros actuales.", variant: "default" });
      return;
    }

    const headers = [
      "ID", "Proceso", "Area", "Puesto", "Descripción",
      "Tiempo Estimado (min)", "Frecuencia", "Sistemas",
      "Información Recibe", "Procesos Entradas",
      "Información Entrega", "Procesos Salidas",
      "Fecha Captura", "Últ. Modif.", "Estado Activo", "Num. Actividades"
    ];

    const csvRows = [
      headers.join(','),
      ...sortedAndFilteredData.map(proc => [
        escapeCsvCell(proc.id),
        escapeCsvCell(proc.proceso),
        escapeCsvCell(proc.area),
        escapeCsvCell(proc.puesto),
        escapeCsvCell(proc.descripcion),
        escapeCsvCell(proc.tiempoEstimado),
        escapeCsvCell(proc.frecuencia),
        escapeCsvCell(proc.sistemas),
        escapeCsvCell(proc.informacionRecibe),
        escapeCsvCell(proc.procesosEntrada),
        escapeCsvCell(proc.informacionEntrega),
        escapeCsvCell(proc.procesosSalida),
        escapeCsvCell(format(new Date(proc.capturedAt), 'yyyy-MM-dd HH:mm:ss')),
        escapeCsvCell(proc.updatedAt ? format(new Date(proc.updatedAt), 'yyyy-MM-dd HH:mm:ss') : 'N/A'),
        escapeCsvCell(proc.activo !== false ? 'Activo' : 'Inactivo'),
        escapeCsvCell(proc.activityOrder?.length || 0)
      ].join(','))
    ];

    const csvString = csvRows.join('\n');
    const blob = new Blob(["\uFEFF" + csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `procesos_y_flujos_registrados_${new Date().toISOString().split('T')[0]}.csv`);
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

  const renderTruncatedText = (text: string | undefined, maxLength: number = 50) => {
    if (!text) return '-';
    if (text.length <= maxLength) return text;
    return (
      <span title={text}>
        {text.substring(0, maxLength)}...
      </span>
    );
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedAreaFilter('all');
    setSelectedPuestoFilter('all');
    setProcessStatusFilter('all');
    setActivityCountFilter('all');
  };


  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Database className="h-16 w-16 text-muted-foreground animate-pulse" />
          <p className="ml-4 text-lg text-muted-foreground">Cargando procesos y flujos registrados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-2 mb-1">
            <Database className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl font-headline">Procesos y Flujos Registrados</CardTitle>
          </div>
          <CardDescription>
            Visualiza, busca, filtra y gestiona todos los procesos y flujos de información registrados en el sistema. Active o inactive procesos según sea necesario.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 p-4 border rounded-lg bg-muted/30">
            <div className="flex items-center gap-2 mb-3">
                <Filter className="h-5 w-5 text-primary"/>
                <h4 className="text-md font-semibold">Filtros de Búsqueda</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 items-end">
                <div className="relative lg:col-span-1 md:col-span-full sm:col-span-full"> {/* Search full width on smaller, then shrinks */}
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                    type="search"
                    placeholder="Buscar palabra clave..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10"
                />
                </div>
                <div className="w-full">
                <Label htmlFor="area-filter" className="text-xs font-medium text-muted-foreground ml-1">Área</Label>
                <Select value={selectedAreaFilter} onValueChange={setSelectedAreaFilter} disabled={isLoadingAreas}>
                    <SelectTrigger id="area-filter">
                    <SelectValue placeholder={isLoadingAreas ? "Cargando..." : "Todas"} />
                    </SelectTrigger>
                    <SelectContent>
                    <SelectItem value="all">Todas las Áreas</SelectItem>
                    {isLoadingAreas ? <SelectItem value="loading-areas" disabled>Cargando...</SelectItem>
                    : areas.length === 0 ? <SelectItem value="no-areas" disabled>No hay áreas</SelectItem>
                    : areas.map(area => <SelectItem key={area.id} value={area.nombre}>{area.nombre}</SelectItem>)}
                    </SelectContent>
                </Select>
                </div>
                <div className="w-full">
                <Label htmlFor="puesto-filter" className="text-xs font-medium text-muted-foreground ml-1">Puesto</Label>
                <Select value={selectedPuestoFilter} onValueChange={setSelectedPuestoFilter} disabled={isLoadingPuestos}>
                    <SelectTrigger id="puesto-filter">
                    <SelectValue placeholder={isLoadingPuestos ? "Cargando..." : "Todos"} />
                    </SelectTrigger>
                    <SelectContent>
                    <SelectItem value="all">Todos los Puestos</SelectItem>
                   {isLoadingPuestos ? <SelectItem value="loading-puestos" disabled>Cargando...</SelectItem>
                   : puestos.length === 0 ? <SelectItem value="no-puestos" disabled>No hay puestos</SelectItem>
                   : puestos.map(puesto => <SelectItem key={puesto.id} value={puesto.nombre}>{puesto.nombre}</SelectItem>)}
                    </SelectContent>
                </Select>
                </div>
                <div className="w-full">
                <Label htmlFor="status-filter" className="text-xs font-medium text-muted-foreground ml-1">Estado Proceso</Label>
                <Select value={processStatusFilter} onValueChange={(v: 'all' | 'active' | 'inactive') => setProcessStatusFilter(v)}>
                    <SelectTrigger id="status-filter">
                    <SelectValue placeholder="Todos"/>
                    </SelectTrigger>
                    <SelectContent>
                    <SelectItem value="all">Todos los Estados</SelectItem>
                    <SelectItem value="active"><CheckSquare className="mr-2 h-4 w-4 inline-block text-green-500" /> Activos</SelectItem>
                    <SelectItem value="inactive"><XSquare className="mr-2 h-4 w-4 inline-block text-red-500" /> Inactivos</SelectItem>
                    </SelectContent>
                </Select>
                </div>
                <div className="w-full">
                <Label htmlFor="activity-count-filter" className="text-xs font-medium text-muted-foreground ml-1">Num. Actividades</Label>
                <Select value={activityCountFilter} onValueChange={(v: ActivityCountFilterType) => setActivityCountFilter(v)}>
                    <SelectTrigger id="activity-count-filter">
                    <SelectValue placeholder="Todas"/>
                    </SelectTrigger>
                    <SelectContent>
                    <SelectItem value="all">Todas (Num. Activ.)</SelectItem>
                    <SelectItem value="none">Sin Actividades</SelectItem>
                    <SelectItem value="some">Con Actividades</SelectItem>
                    </SelectContent>
                </Select>
                </div>
            </div>
            <Button onClick={clearFilters} variant="link" className="mt-3 px-0 text-sm">Limpiar Todos los Filtros</Button>
          </div>

           <div className="mb-6 flex flex-col sm:flex-row sm:justify-end sm:items-center gap-2">
            <Button onClick={handleExport} variant="outline" className="w-full sm:w-auto">
              <FileText className="mr-2 h-4 w-4" /> Exportar CSV ({sortedAndFilteredData.length})
            </Button>
            <Dialog open={isRecoveryDialogOpen} onOpenChange={setIsRecoveryDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto" disabled={recoverableProcesses.length === 0}>
                  <RotateCcw className="mr-2 h-4 w-4" /> Recuperar ({recoverableProcesses.length})
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                  <DialogTitle>Recuperar Procesos Eliminados</DialogTitle>
                  <DialogDescription>
                    Procesos eliminados en los últimos 30 días que pueden ser restaurados.
                  </DialogDescription>
                </DialogHeader>
                {recoverableProcesses.length > 0 ? (
                  <div className="max-h-[60vh] overflow-y-auto py-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nombre del Proceso</TableHead>
                          <TableHead>Eliminado el</TableHead>
                          <TableHead className="text-right">Acción</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recoverableProcesses.map(proc => (
                          <TableRow key={proc.id}>
                            <TableCell>{proc.proceso}</TableCell>
                            <TableCell>{proc.deletedAt ? format(new Date(proc.deletedAt), 'dd/MM/yyyy HH:mm', { locale: es }) : 'N/A'}</TableCell>
                            <TableCell className="text-right">
                              <Button size="sm" onClick={() => handleRestoreProcess(proc.id)}>
                                <RotateCcw className="mr-2 h-3 w-3" /> Restaurar
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="py-4 text-muted-foreground">No hay procesos para recuperar.</p>
                )}
                 <DialogFooter>
                    <DialogClose asChild>
                      <Button type="button" variant="outline">Cerrar</Button>
                    </DialogClose>
                  </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>


          {sortedAndFilteredData.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[150px] cursor-pointer hover:bg-muted/50 group" onClick={() => requestSort('proceso')}>
                      <div className="flex items-center">Proceso {getSortIcon('proceso')}</div>
                    </TableHead>
                    <TableHead className="w-[120px] cursor-pointer hover:bg-muted/50 group" onClick={() => requestSort('area')}>
                      <div className="flex items-center">Área {getSortIcon('area')}</div>
                    </TableHead>
                    <TableHead className="w-[120px] cursor-pointer hover:bg-muted/50 group" onClick={() => requestSort('puesto')}>
                      <div className="flex items-center">Puesto {getSortIcon('puesto')}</div>
                    </TableHead>
                    <TableHead className="text-center w-[80px] cursor-pointer hover:bg-muted/50 group" onClick={() => requestSort('activo')}>
                      <div className="flex items-center justify-center">Estado {getSortIcon('activo')}</div>
                    </TableHead>
                    <TableHead className="text-center w-[100px] cursor-pointer hover:bg-muted/50 group" onClick={() => requestSort('tiempoEstimado')} title="Tiempo Estimado (minutos)">
                        <div className="flex items-center justify-center"><Clock className="inline-block h-4 w-4 mr-1" />Tiempo {getSortIcon('tiempoEstimado')}</div>
                    </TableHead>
                    <TableHead className="text-center w-[100px] cursor-pointer hover:bg-muted/50 group" onClick={() => requestSort('frecuencia')} title="Frecuencia">
                        <div className="flex items-center justify-center"><Repeat className="inline-block h-4 w-4 mr-1" />Frec. {getSortIcon('frecuencia')}</div>
                    </TableHead>
                    <TableHead className="w-[120px]" title="Sistemas Utilizados"><div className="flex items-center"><LayersIcon className="inline-block h-4 w-4 mr-1" />Sistemas</div></TableHead>
                    <TableHead className="w-[120px]" title="Procesos de Entradas"><div className="flex items-center"><ArrowRightLeft className="inline-block h-4 w-4 mr-1 transform rotate-180" />Ent. Procesos</div></TableHead>
                    <TableHead className="min-w-[150px] max-w-[200px]" title="Información que Recibe"><div className="flex items-center"><Info className="inline-block h-4 w-4 mr-1" />Info. Recibe</div></TableHead>
                    <TableHead className="w-[120px]" title="Procesos de Salida"><div className="flex items-center"><ArrowRightLeft className="inline-block h-4 w-4 mr-1" />Sal. Procesos</div></TableHead>
                    <TableHead className="min-w-[150px] max-w-[200px]" title="Información que Entrega"><div className="flex items-center"><Info className="inline-block h-4 w-4 mr-1" />Info. Entrega</div></TableHead>
                    <TableHead className="text-center w-[80px] cursor-pointer hover:bg-muted/50 group" onClick={() => requestSort('numActividades')} title="Número de Actividades">
                        <div className="flex items-center justify-center"><ListTree className="inline-block h-4 w-4 mr-1" />Activ. {getSortIcon('numActividades')}</div>
                    </TableHead>
                    <TableHead className="w-[140px] cursor-pointer hover:bg-muted/50 group" onClick={() => requestSort('capturedAt')} title="Fecha de Captura">
                        <div className="flex items-center"><CalendarClock className="inline-block h-4 w-4 mr-1" />F. Captura {getSortIcon('capturedAt')}</div>
                    </TableHead>
                    <TableHead className="w-[140px] cursor-pointer hover:bg-muted/50 group" onClick={() => requestSort('updatedAt')} title="Última Modificación">
                        <div className="flex items-center"><CalendarClock className="inline-block h-4 w-4 mr-1" />Últ. Modif. {getSortIcon('updatedAt')}</div>
                    </TableHead>
                    <TableHead className="text-right w-[120px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedAndFilteredData.map((proc) => {
                    const associatedActivityNames = proc.activityOrder
                        ?.map(actId => allActivities.find(a => a.id === actId)?.nombre)
                        .filter(Boolean)
                        .join(', ') || "Ninguna actividad asociada";
                    return (
                    <TableRow key={proc.id} className={cn(proc.activo === false && "bg-muted/40")}>
                      <TableCell className="font-medium">{proc.proceso}</TableCell>
                      <TableCell>{proc.area}</TableCell>
                      <TableCell>{proc.puesto}</TableCell>
                      <TableCell className="text-center">
                         <Badge variant={proc.activo !== false ? 'default' : 'outline'}
                                className={cn(proc.activo === false && "border-destructive text-destructive")}>
                          {proc.activo !== false ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">{proc.tiempoEstimado ?? '-'}</TableCell>
                      <TableCell className="text-center">{proc.frecuencia}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {proc.sistemas && proc.sistemas.length > 0 ? (
                            proc.sistemas.map((sys, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">{sys}</Badge>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                         <div className="flex flex-wrap gap-1">
                          {proc.procesosEntrada && proc.procesosEntrada.length > 0 ? (
                            proc.procesosEntrada.map((pe, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">{pe}</Badge>
                            ))
                          ) : (
                             <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-pre-wrap max-w-[200px] overflow-hidden text-ellipsis">{renderTruncatedText(proc.informacionRecibe)}</TableCell>
                       <TableCell>
                         <div className="flex flex-wrap gap-1">
                          {proc.procesosSalida && proc.procesosSalida.length > 0 ? (
                            proc.procesosSalida.map((ps, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">{ps}</Badge>
                            ))
                          ) : (
                             <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-pre-wrap max-w-[200px] overflow-hidden text-ellipsis">{renderTruncatedText(proc.informacionEntrega)}</TableCell>
                      <TableCell className="text-center">
                         <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                               <Badge variant="outline" className="font-mono text-xs cursor-default hover:bg-muted">
                                {proc.activityOrder?.length || 0}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent side="top" align="center" className="max-w-xs break-words">
                              <p className="text-xs">{associatedActivityNames}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="text-xs">
                        {isValid(parseISO(proc.capturedAt)) ? format(parseISO(proc.capturedAt), 'dd/MM/yy HH:mm', { locale: es }) : 'Fecha inválida'}
                      </TableCell>
                       <TableCell className="text-xs">
                        {proc.updatedAt && isValid(new Date(proc.updatedAt)) ? format(new Date(proc.updatedAt), 'dd/MM/yy HH:mm', { locale: es }) : '-'}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Switch
                          checked={proc.activo !== false}
                          onCheckedChange={() => handleToggleProcessStatus(proc.id)}
                          aria-label={proc.activo !== false ? 'Inactivar proceso' : 'Activar proceso'}
                          className="mr-1"
                        />
                        <Button variant="ghost" size="icon" onClick={() => handleViewDetails(proc)} title="Ver detalles">
                          <Eye className="h-4 w-4" />
                        </Button>
                         <Button variant="ghost" size="icon" onClick={() => handleEditProcess(proc)} title="Editar proceso">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => promptDeleteProcess(proc)} className="text-destructive hover:text-destructive" title="Eliminar proceso">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )})}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="mt-6 p-8 border border-dashed border-border rounded-lg flex flex-col items-center justify-center min-h-[300px] bg-muted/20">
              <FileX className="h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-lg font-semibold text-foreground">
                {allCapturedData.filter(p => !p.deletedAt).length === 0 ? "No hay procesos/flujos activos registrados" : "No se encontraron resultados"}
              </p>
              <p className="text-sm text-muted-foreground text-center">
                {allCapturedData.filter(p => !p.deletedAt).length === 0
                  ? 'Comience registrando procesos y flujos en el módulo de "Captura" o revise la papelera de recuperación.'
                  : 'Intente ajustar su término de búsqueda o filtros.'
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalles del Proceso: {selectedProcess?.proceso}</DialogTitle>
            <DialogDescription>
              Información completa del proceso y flujo registrado el {selectedProcess && isValid(parseISO(selectedProcess.capturedAt)) ? format(parseISO(selectedProcess.capturedAt), 'dd MMMM yyyy, HH:mm', { locale: es }) : 'N/A'}.
              Última modificación: {selectedProcess?.updatedAt && isValid(new Date(selectedProcess.updatedAt)) ? format(new Date(selectedProcess.updatedAt), 'dd MMMM yyyy, HH:mm', { locale: es }) : 'N/A'}.
              Estado: {selectedProcess?.activo !== false ? 'Activo' : 'Inactivo'}.
              Actividades Asociadas: {selectedProcess?.activityOrder?.length || 0}.
            </DialogDescription>
          </DialogHeader>
          {selectedProcess && (
            <div className="py-4 space-y-3 max-h-[70vh] overflow-y-auto pr-2">
              <DetailSection title="Área" value={selectedProcess.area} />
              <DetailSection title="Puesto Principal" value={selectedProcess.puesto} />
              <DetailSection title="Descripción Detallada" value={selectedProcess.descripcion} isTextarea />
              <DetailSection title="Tiempo Estimado" value={selectedProcess.tiempoEstimado !== undefined ? `${selectedProcess.tiempoEstimado} minutos` : undefined} />
              <DetailSection title="Frecuencia" value={selectedProcess.frecuencia} />
              <DetailSection title="Sistemas Utilizados" value={selectedProcess.sistemas} isList />
              <DetailSection title="Información que Recibe (Descripción)" value={selectedProcess.informacionRecibe} isTextarea />
              <DetailSection title="Procesos de Entradas" value={selectedProcess.procesosEntrada} isList />
              <DetailSection title="Información que Entrega (Descripción)" value={selectedProcess.informacionEntrega} isTextarea />
              <DetailSection title="Procesos de Salida" value={selectedProcess.procesosSalida} isList />
            </div>
          )}
          <DialogClose asChild>
            <Button type="button" variant="outline" className="mt-4 w-full">Cerrar</Button>
          </DialogClose>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isConfirmDeleteProcessOpen} onOpenChange={setIsConfirmDeleteProcessOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <div className="flex items-center">
                <AlertTriangle className="h-5 w-5 mr-2 text-destructive" />
                Confirmar Eliminación de Proceso
              </div>
            </AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro de que desea eliminar el proceso "{processToDelete?.proceso}"? Esta acción lo moverá a la lista de recuperación por 30 días. Podrá restaurarlo desde el botón "Recuperar".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setProcessToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={executeDeleteProcess} className={buttonVariants({variant: "destructive"})}>Eliminar Proceso</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

