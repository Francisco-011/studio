
'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Factory, DollarSign, ListChecks, PackageX, Loader2, Layers, CopyCheck, CheckCircle2, TrendingUp, FileSearch2, Activity as ActivityIcon, CalendarIcon as CalendarIconLucide, Brain, AreaChart, UserSquare2, Filter as FilterIcon, Download } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig
} from "@/components/ui/chart";
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval, parseISO, eachMonthOfInterval, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from "@/hooks/use-toast";

import type { CapturedProcess } from '../procesos-y-flujos-registrados/page';
import { useActividades, type Actividad } from '@/contexts/ActividadesContext';
import { useSistemasCostos, type Sistema, type SistemaCosto, type TipoMoneda } from '@/contexts/SistemasCostosContext';
import { useAcciones, type Accion } from '@/contexts/AccionesContext';
import { useAreas, type Area as AreaType } from '@/contexts/AreasContext';
import { usePuestos, type Puesto as PuestoType } from '@/contexts/PuestosContext';
import { summarizeEntity, type SummarizeEntityOutput } from '@/ai/flows/summarize-entity-flow';


const CAPTURED_DATA_LOCAL_STORAGE_KEY = 'proceza-captured-data';


function formatDashboardCurrency(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
  } catch (e) {
    return `${amount.toFixed(0)} ${currency}`;
  }
}

interface CalculatedSystemCost {
    id: string;
    name: string;
    annualUsageCost: number;
    annualLicenseCost: number;
    totalAnnualCost: number;
    totalLicenses: number;
    currency: TipoMoneda | string;
}

function calculateAllSystemAnnualCosts(
  allSistemas: Sistema[],
  allCostos: SistemaCosto[]
): CalculatedSystemCost[] {
  if (!allSistemas || !allCostos) return [];

  return allSistemas.map(system => {
    const costsForSystem = allCostos.filter(cost => cost.sistemaId === system.id);
    let totalAnnualUsage = 0;
    let totalAnnualLicenseCost = 0;
    let systemCurrency: TipoMoneda | string = 'USD';
    let systemTotalLicenses = 0;

    if (costsForSystem.length > 0) {
      systemCurrency = costsForSystem[0].moneda;
      costsForSystem.forEach(cost => {
        if (cost.moneda === systemCurrency) { 
          let periodicUsage = 0;
          if (cost.tipoCosto.includes("Por Uso del Sistema") && cost.montoUso) {
            periodicUsage = cost.montoUso;
          }
          
          let periodicLicense = 0;
          if (cost.tipoCosto.includes("Por Licencias") && cost.numeroLicencias && cost.costoPorLicencia) {
            periodicLicense = cost.numeroLicencias * cost.costoPorLicencia;
            systemTotalLicenses += cost.numeroLicencias; 
          }

          if (cost.frecuencia === "Mensual") {
            totalAnnualUsage += periodicUsage * 12;
            totalAnnualLicenseCost += periodicLicense * 12;
          } else if (cost.frecuencia === "Anual") {
            totalAnnualUsage += periodicUsage;
            totalAnnualLicenseCost += periodicLicense;
          } else { 
            totalAnnualUsage += periodicUsage;
            totalAnnualLicenseCost += periodicLicense;
          }
        }
      });
    }
    return {
      id: system.id,
      name: system.nombre,
      annualUsageCost: totalAnnualUsage,
      annualLicenseCost: totalAnnualLicenseCost,
      totalAnnualCost: totalAnnualUsage + totalAnnualLicenseCost,
      totalLicenses: systemTotalLicenses,
      currency: systemCurrency,
    };
  });
}

interface MonthlyEvolutionData {
  month: string;
  procesosMapeados: number;
  accionesCompletadas: number;
}

const chartConfig = {
  procesosMapeados: {
    label: "Procesos Mapeados",
    color: "hsl(var(--chart-1))",
  },
  accionesCompletadas: {
    label: "Acciones Completadas",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig;


export default function DashboardPage() {
  const [allCapturedProcesses, setAllCapturedProcesses] = useState<CapturedProcess[]>([]);
  const [isLoadingProcessData, setIsLoadingProcessData] = useState(true);
  
  const { actividades: globalActividades, isLoadingActividades } = useActividades();
  const { sistemas, costosSistemas, isLoadingSistemasCostos } = useSistemasCostos();
  const { acciones: globalAcciones, isLoadingAcciones } = useAcciones();
  const { areas, isLoading: isLoadingAreas } = useAreas();
  const { puestos, isLoadingPuestos } = usePuestos();

  const [calculatedSystemCosts, setCalculatedSystemCosts] = useState<CalculatedSystemCost[]>([]);
  const [evolutionChartData, setEvolutionChartData] = useState<MonthlyEvolutionData[]>([]);

  const [dashboardDateRange, setDashboardDateRange] = useState<{ from?: Date; to?: Date }>({
    from: startOfMonth(subMonths(new Date(), 5)), 
    to: endOfMonth(new Date()),
  });
  const [selectedArea, setSelectedArea] = useState<string>('all');
  const [selectedPuesto, setSelectedPuesto] = useState<string>('all');


  // State for AI Entity Summarization
  const [selectedEntityType, setSelectedEntityType] = useState<'area' | 'puesto' | 'none'>('none');
  const [selectedEntityName, setSelectedEntityName] = useState<string>('');
  const [generatedSummary, setGeneratedSummary] = useState<string>('');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState<boolean>(false);
  const [entityList, setEntityList] = useState<{id: string, name: string}[]>([]);


  useEffect(() => {
    setIsLoadingProcessData(true);
    try {
      const storedProcesses = localStorage.getItem(CAPTURED_DATA_LOCAL_STORAGE_KEY);
      if (storedProcesses) {
        const parsedProcesses: CapturedProcess[] = JSON.parse(storedProcesses);
        setAllCapturedProcesses(parsedProcesses); // Keep all for now, filter later
      }
    } catch (error) {
      console.error("Error loading process data from localStorage:", error);
    } finally {
      setIsLoadingProcessData(false);
    }
  }, []);
  
  useEffect(() => {
    if (!isLoadingSistemasCostos && sistemas && costosSistemas) {
        setCalculatedSystemCosts(calculateAllSystemAnnualCosts(sistemas, costosSistemas));
    }
  }, [sistemas, costosSistemas, isLoadingSistemasCostos]);

  useEffect(() => {
    if (selectedEntityType === 'area' && !isLoadingAreas) {
      setEntityList(areas.map(a => ({ id: a.id, name: a.nombre })).sort((a,b) => a.name.localeCompare(b.name)));
      setSelectedEntityName('');
    } else if (selectedEntityType === 'puesto' && !isLoadingPuestos) {
      setEntityList(puestos.map(p => ({ id: p.id, name: p.nombre })).sort((a,b) => a.name.localeCompare(b.name)));
      setSelectedEntityName('');
    } else {
      setEntityList([]);
      setSelectedEntityName('');
    }
  }, [selectedEntityType, areas, puestos, isLoadingAreas, isLoadingPuestos]);


  const processesFilteredByAreaPuesto = useMemo(() => {
    let processes = allCapturedProcesses.filter(p => p.activo !== false && !p.deletedAt);
    if (selectedArea !== 'all') {
      processes = processes.filter(proc => proc.area === selectedArea);
    }
    if (selectedPuesto !== 'all') {
      processes = processes.filter(proc => proc.puesto === selectedPuesto);
    }
    return processes;
  }, [allCapturedProcesses, selectedArea, selectedPuesto]);

  const filteredCapturedProcesses = useMemo(() => {
    if (!dashboardDateRange.from || !dashboardDateRange.to) return processesFilteredByAreaPuesto;
    return processesFilteredByAreaPuesto.filter(proc => {
        if (!proc.capturedAt) return false;
        const capturedDate = parseISO(proc.capturedAt);
        return isValid(capturedDate) && isWithinInterval(capturedDate, { start: dashboardDateRange.from!, end: dashboardDateRange.to! });
    });
  }, [processesFilteredByAreaPuesto, dashboardDateRange]);

  const filteredAcciones = useMemo(() => {
    // Acciones are not filtered by Area/Puesto for now
    if (!dashboardDateRange.from || !dashboardDateRange.to) return globalAcciones;
    
    const rangeStart = dashboardDateRange.from;
    const rangeEnd = dashboardDateRange.to;

    return globalAcciones.filter(accion => {
        if (accion.estado === 'Completada' && accion.fechaFinalizacion) {
            const finalizacionDate = parseISO(accion.fechaFinalizacion);
            return isValid(finalizacionDate) && isWithinInterval(finalizacionDate, { start: rangeStart, end: rangeEnd });
        }
        if ((accion.estado === 'En Progreso' || accion.estado === 'En Revisión') && accion.fechaCreacion) {
            const creacionDate = parseISO(accion.fechaCreacion);
            return isValid(creacionDate) && isWithinInterval(creacionDate, { start: rangeStart, end: rangeEnd });
        }
        return false; 
    });
  }, [globalAcciones, dashboardDateRange]);

  const filteredActividades = useMemo(() => {
    const relevantProcessIds = new Set(filteredCapturedProcesses.map(p => p.id));
    return globalActividades.filter(act => {
        if (!act.createdAt) return false;
        const createdAtDate = new Date(act.createdAt);
        if (!isValid(createdAtDate)) return false;
        
        let dateMatch = true;
        if (dashboardDateRange.from && dashboardDateRange.to) {
          dateMatch = isWithinInterval(createdAtDate, { start: dashboardDateRange.from!, end: dashboardDateRange.to! });
        }
        if (!dateMatch) return false;

        if (selectedArea !== 'all' || selectedPuesto !== 'all') {
          if (!act.procesosAsociadosIds || act.procesosAsociadosIds.length === 0) return false;
          return act.procesosAsociadosIds.some(procId => relevantProcessIds.has(procId));
        }
        return true;
    });
  }, [globalActividades, dashboardDateRange, filteredCapturedProcesses, selectedArea, selectedPuesto]);


 useEffect(() => {
    if (!isLoadingProcessData && !isLoadingAcciones && dashboardDateRange.from && dashboardDateRange.to) {
      const monthlyData: MonthlyEvolutionData[] = [];
      const monthsInInterval = eachMonthOfInterval({
        start: dashboardDateRange.from,
        end: dashboardDateRange.to,
      });

      // Use processes already filtered by area/puesto for chart calculations
      const baseProcessesForChart = processesFilteredByAreaPuesto;
      // Actions are globally filtered by date for the chart
      const baseActionsForChart = globalAcciones;


      monthsInInterval.forEach(monthStart => {
        const monthEnd = endOfMonth(monthStart);
        const monthLabel = format(monthStart, "MMM yy", { locale: es });

        const procesosEsteMes = baseProcessesForChart.filter(proc => { 
          if (!proc.capturedAt) return false;
          const capturedDate = parseISO(proc.capturedAt);
          return isValid(capturedDate) && isWithinInterval(capturedDate, { start: monthStart, end: monthEnd });
        }).length;

        const accionesEsteMes = baseActionsForChart.filter(accion => { 
          if (accion.estado === 'Completada' && accion.fechaFinalizacion) {
            const finalizacionDate = parseISO(accion.fechaFinalizacion);
            return isValid(finalizacionDate) && isWithinInterval(finalizacionDate, { start: monthStart, end: monthEnd });
          }
          return false;
        }).length;
        
        monthlyData.push({
          month: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
          procesosMapeados: procesosEsteMes,
          accionesCompletadas: accionesEsteMes,
        });
      });
      setEvolutionChartData(monthlyData);
    }
  }, [processesFilteredByAreaPuesto, globalAcciones, isLoadingProcessData, isLoadingAcciones, dashboardDateRange]);


  const dashboardMetrics = useMemo(() => {
    if (isLoadingProcessData || isLoadingActividades || isLoadingAcciones) {
      return {
        procesosMapeadosCount: 0,
        actividadesActivasCount: 0,
        actividadesSinUsoCount: 0,
        accionesCompletadasCount: 0,
        accionesEnRevisionCount: 0,
        accionesEnProgresoCount: 0,
        procesosConVariacionesCount: 0,
        actividadesDuplicadasCount: 0,
        procesosSinActividadesCount: 0,
      };
    }

    const procesosMapeadosCount = filteredCapturedProcesses.length;
    const activeFilteredActividades = filteredActividades.filter(a => a.activa);
    const actividadesActivasCount = activeFilteredActividades.length;
    
    const actividadesSinUsoCount = activeFilteredActividades.filter(a => {
      const globalActivity = globalActividades.find(ga => ga.id === a.id);
      return globalActivity?.procesosAsociadosCount === 0;
    }).length;
    
    const actividadesDuplicadasCount = activeFilteredActividades.filter(act => {
       const globalActivity = globalActividades.find(ga => ga.id === act.id);
       return (globalActivity?.procesosAsociadosCount || 0) > 1;
    }).length;
    
    const accionesCompletadasCount = filteredAcciones.filter(acc => acc.estado === 'Completada').length;
    const accionesEnRevisionCount = filteredAcciones.filter(acc => acc.estado === 'En Revisión').length;
    const accionesEnProgresoCount = filteredAcciones.filter(acc => acc.estado === 'En Progreso').length;

    const processContexts = new Map<string, Set<string>>();
    filteredCapturedProcesses.forEach(proc => {
        if (!processContexts.has(proc.proceso)) {
            processContexts.set(proc.proceso, new Set());
        }
        processContexts.get(proc.proceso)!.add(`${proc.area}|${proc.puesto}`);
    });
    let procesosConVariacionesCount = 0;
    processContexts.forEach(contexts => {
        if (contexts.size > 1) {
            procesosConVariacionesCount++;
        }
    });
    const procesosSinActividadesCount = filteredCapturedProcesses.filter(proc => !proc.activityOrder || proc.activityOrder.length === 0).length;


    return {
      procesosMapeadosCount,
      actividadesActivasCount,
      actividadesSinUsoCount,
      accionesCompletadasCount,
      accionesEnRevisionCount,
      accionesEnProgresoCount,
      procesosConVariacionesCount,
      actividadesDuplicadasCount,
      procesosSinActividadesCount,
    };
  }, [filteredCapturedProcesses, filteredAcciones, filteredActividades, globalActividades, isLoadingProcessData, isLoadingActividades, isLoadingAcciones]);


  const isLoadingAll = isLoadingProcessData || isLoadingActividades || isLoadingAcciones || isLoadingSistemasCostos || isLoadingAreas || isLoadingPuestos;

  const renderMetric = (value: number | string, loading: boolean, icon?: React.ReactNode) => {
    if (loading) {
      return <Loader2 className={`h-5 w-5 animate-spin ${icon ? 'mr-2' : ''}`} />;
    }
    return <>{icon}{value}</>;
  }

  const handleGenerateSummary = async () => {
    if (selectedEntityType === 'none' || !selectedEntityName) {
      toast({ title: "Selección Incompleta", description: "Por favor, seleccione un tipo de entidad y un nombre.", variant: "default" });
      return;
    }
    setIsGeneratingSummary(true);
    setGeneratedSummary('');

    try {
      let relevantProcesses: CapturedProcess[];
      if (selectedEntityType === 'area') {
        relevantProcesses = allCapturedProcesses.filter(p => !p.deletedAt && p.area === selectedEntityName);
      } else { // puesto
        relevantProcesses = allCapturedProcesses.filter(p => !p.deletedAt && p.puesto === selectedEntityName);
      }

      if (relevantProcesses.length === 0) {
        setGeneratedSummary(`No se encontraron procesos capturados para ${selectedEntityType === 'area' ? 'el área' : 'el puesto'} "${selectedEntityName}".`);
        setIsGeneratingSummary(false);
        return;
      }

      const processDataString = relevantProcesses.map(proc => {
        const activitiesString = (proc.activityOrder || [])
          .map(actId => globalActividades.find(a => a.id === actId)?.nombre)
          .filter(Boolean)
          .join(', ');
        
        return `Proceso: ${proc.proceso}\n` +
               `Descripción: ${proc.descripcion}\n` +
               (activitiesString ? `Actividades Clave: ${activitiesString}\n` : '') +
               (proc.sistemas && proc.sistemas.length > 0 ? `Sistemas Utilizados: ${proc.sistemas.join(', ')}\n` : '');
      }).join('\n---\n');

      const result: SummarizeEntityOutput = await summarizeEntity({
        entityType: selectedEntityType,
        entityName: selectedEntityName,
        processData: processDataString,
      });
      setGeneratedSummary(result.summary);

    } catch (error) {
      console.error("Error generating summary:", error);
      toast({ title: "Error al generar resumen", description: "No se pudo contactar al servicio de IA.", variant: "destructive" });
      setGeneratedSummary("Error al generar el resumen. Intente nuevamente.");
    } finally {
      setIsGeneratingSummary(false);
    }
  };
  
  const handleExportPdf = () => {
    toast({
      title: "Función en Desarrollo",
      description: "La exportación a PDF ejecutivo es una característica planificada y se implementará en futuras actualizaciones.",
      duration: 5000,
    });
  };


  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
          <h1 className="text-3xl font-headline font-bold text-primary mb-2 sm:mb-0">Dashboard Ejecutivo</h1>
        </div>
        <div className="p-4 border rounded-lg bg-muted/30">
            <div className="flex items-center gap-2 mb-3">
                <FilterIcon className="h-5 w-5 text-primary"/>
                <h4 className="text-md font-semibold">Filtros del Dashboard</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 items-end">
                <div>
                    <Label htmlFor="dateFrom" className="text-xs">Desde</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                        <Button id="dateFrom" variant={"outline"} size="sm" className={cn("w-full justify-start text-left font-normal", !dashboardDateRange.from && "text-muted-foreground")}>
                            <CalendarIconLucide className="mr-2 h-4 w-4" />
                            {dashboardDateRange.from ? format(dashboardDateRange.from, "dd MMM yy", {locale: es}) : <span>Seleccione</span>}
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={dashboardDateRange.from} onSelect={(date) => setDashboardDateRange(prev => ({ ...prev, from: date ? startOfMonth(date) : undefined }))} defaultMonth={dashboardDateRange.from} captionLayout="dropdown-buttons" fromYear={2020} toYear={new Date().getFullYear() + 1} disabled={(date) => dashboardDateRange.to ? date > dashboardDateRange.to : false} initialFocus />
                        </PopoverContent>
                    </Popover>
                </div>
                <div>
                    <Label htmlFor="dateTo" className="text-xs">Hasta</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                        <Button id="dateTo" variant={"outline"} size="sm" className={cn("w-full justify-start text-left font-normal", !dashboardDateRange.to && "text-muted-foreground")}>
                            <CalendarIconLucide className="mr-2 h-4 w-4" />
                            {dashboardDateRange.to ? format(dashboardDateRange.to, "dd MMM yy", {locale: es}) : <span>Seleccione</span>}
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={dashboardDateRange.to} onSelect={(date) => setDashboardDateRange(prev => ({ ...prev, to: date ? endOfMonth(date) : undefined }))} defaultMonth={dashboardDateRange.to} captionLayout="dropdown-buttons" fromYear={2020} toYear={new Date().getFullYear() + 1} disabled={(date) => dashboardDateRange.from ? date < dashboardDateRange.from : false} initialFocus />
                        </PopoverContent>
                    </Popover>
                </div>
                <div>
                    <Label htmlFor="areaFilter" className="text-xs">Área</Label>
                    <Select value={selectedArea} onValueChange={setSelectedArea} disabled={isLoadingAreas}>
                        <SelectTrigger id="areaFilter" className="h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                        <SelectItem value="all">Todas las Áreas</SelectItem>
                        {areas.map(area => <SelectItem key={area.id} value={area.nombre}>{area.nombre}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label htmlFor="puestoFilter" className="text-xs">Puesto</Label>
                    <Select value={selectedPuesto} onValueChange={setSelectedPuesto} disabled={isLoadingPuestos}>
                        <SelectTrigger id="puestoFilter" className="h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                        <SelectItem value="all">Todos los Puestos</SelectItem>
                        {puestos.map(puesto => <SelectItem key={puesto.id} value={puesto.nombre}>{puesto.nombre}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <Button onClick={handleExportPdf} variant="outline" size="sm" className="w-full self-end">
                    <Download className="mr-2 h-4 w-4" /> Exportar PDF (Conceptual)
                </Button>
            </div>
        </div>
      </div>
      <p className="text-sm text-muted-foreground mb-8">Métricas clave basadas en el rango de fechas y filtros seleccionados (excepto Costos de Sistemas y Análisis de Entidad IA).</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Procesos Activos Mapeados</CardTitle>
            <Factory className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {renderMetric(dashboardMetrics.procesosMapeadosCount, isLoadingAll)}
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Procesos con Variaciones</CardTitle>
            <Layers className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {renderMetric(dashboardMetrics.procesosConVariacionesCount, isLoadingAll)}
            </div>
             <p className="text-xs text-muted-foreground">Mismo nombre de proceso en &gt;1 Área/Puesto.</p>
          </CardContent>
        </Card>
         <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Actividades Activas</CardTitle>
            <ListChecks className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {renderMetric(dashboardMetrics.actividadesActivasCount, isLoadingAll)}
            </div>
            <p className="text-xs text-muted-foreground">(Creadas en el periodo, según filtros)</p>
          </CardContent>
        </Card>
        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Actividades Duplicadas</CardTitle>
            <CopyCheck className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
                 {renderMetric(dashboardMetrics.actividadesDuplicadasCount, isLoadingAll)}
            </div>
            <p className="text-xs text-muted-foreground">Actividades (creadas en periodo, según filtros) en &gt;1 proceso.</p>
          </CardContent>
        </Card>
        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Acciones Completadas</CardTitle>
            <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {renderMetric(dashboardMetrics.accionesCompletadasCount, isLoadingAll)}
            </div>
             <p className="text-xs text-muted-foreground">(Finalizadas en el periodo)</p>
          </CardContent>
        </Card>
         <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Acciones en Revisión</CardTitle>
            <FileSearch2 className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {renderMetric(dashboardMetrics.accionesEnRevisionCount, isLoadingAll)}
            </div>
             <p className="text-xs text-muted-foreground">(Creadas en el periodo)</p>
          </CardContent>
        </Card>
        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Acciones en Progreso</CardTitle>
            <ActivityIcon className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {renderMetric(dashboardMetrics.accionesEnProgresoCount, isLoadingAll)}
            </div>
             <p className="text-xs text-muted-foreground">(Creadas en el periodo)</p>
          </CardContent>
        </Card>
        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Procesos Sin Actividades</CardTitle>
            <PackageX className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
               {renderMetric(dashboardMetrics.procesosSinActividadesCount, isLoadingAll)}
            </div>
            <p className="text-xs text-muted-foreground">Procesos (capturados en periodo, según filtros) sin actividades detalladas.</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <Card className="lg:col-span-2 shadow-lg">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <CardTitle>Evolución de Optimización de Procesos</CardTitle>
                    <CardDescription>Seguimiento mensual de procesos mapeados vs. acciones completadas (general).</CardDescription>
                </div>
            </div>
          </CardHeader>
          <CardContent className="h-[350px] pt-4">
            {isLoadingAll ? (
                <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" /> Cargando datos del gráfico...
                </div>
            ) : evolutionChartData.length > 0 ? (
              <ChartContainer config={chartConfig} className="w-full h-full">
                <BarChart data={evolutionChartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(value) => value.slice(0, 3)}
                  />
                  <YAxis tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false} />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent indicator="dot" />}
                  />
                  <Legend contentStyle={{fontSize: '0.8rem'}} iconSize={10} />
                  <Bar dataKey="procesosMapeados" fill="var(--color-procesosMapeados)" radius={4} />
                  <Bar dataKey="accionesCompletadas" fill="var(--color-accionesCompletadas)" radius={4} />
                </BarChart>
              </ChartContainer>
            ) : (
                 <div className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground">No hay suficientes datos para mostrar la evolución en el rango seleccionado.</p>
                </div>
            )}
          </CardContent>
        </Card>
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center gap-2">
             <DollarSign className="h-5 w-5 text-primary" />
            <CardTitle>Costos de Sistemas</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="mb-4">Resumen de costos anuales estimados por uso y licencias, y número total de licencias (no afectado por filtro de fecha).</CardDescription>
            {isLoadingAll ? (
                <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" /> Cargando costos...
                </div>
            ) : calculatedSystemCosts.length === 0 ? (
                <p className="text-muted-foreground text-sm">No hay datos de costos de sistemas configurados.</p>
            ) : (
                <div className="max-h-[300px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                        <TableRow>
                        <TableHead className="w-[30%]">Sistema</TableHead>
                        <TableHead className="text-right">Uso Anual</TableHead>
                        <TableHead className="text-right">Lic. Anual</TableHead>
                        <TableHead className="text-right">Total Lic.</TableHead>
                        <TableHead className="text-right">Total Anual</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {calculatedSystemCosts.map((cost) => (
                        <TableRow key={cost.id}>
                            <TableCell className="font-medium text-xs">{cost.name}</TableCell>
                            <TableCell className="text-right text-xs">{formatDashboardCurrency(cost.annualUsageCost, cost.currency)}</TableCell>
                            <TableCell className="text-right text-xs">{formatDashboardCurrency(cost.annualLicenseCost, cost.currency)}</TableCell>
                            <TableCell className="text-right text-xs">{cost.totalLicenses > 0 ? cost.totalLicenses : '-'}</TableCell>
                            <TableCell className="text-right font-semibold text-xs">{formatDashboardCurrency(cost.totalAnnualCost, cost.currency)}</TableCell>
                        </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI Entity Summarization Card */}
      <Card className="shadow-lg mt-8">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            <CardTitle className="text-xl font-headline">Análisis de Entidad por IA</CardTitle>
          </div>
          <CardDescription>
            Seleccione un área o puesto para obtener un resumen de sus funciones, actividades y procesos principales.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 items-end">
            <div>
              <label htmlFor="entityTypeSelect" className="text-sm font-medium">Tipo de Entidad</label>
              <Select
                value={selectedEntityType}
                onValueChange={(value: 'area' | 'puesto' | 'none') => {
                  setSelectedEntityType(value);
                  setSelectedEntityName(''); // Reset name on type change
                  setGeneratedSummary('');
                }}
              >
                <SelectTrigger id="entityTypeSelect">
                  <SelectValue placeholder="Seleccione tipo..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" disabled>Seleccione tipo...</SelectItem>
                  <SelectItem value="area"><AreaChart className="inline-block h-4 w-4 mr-2 text-muted-foreground" />Área</SelectItem>
                  <SelectItem value="puesto"><UserSquare2 className="inline-block h-4 w-4 mr-2 text-muted-foreground" />Puesto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label htmlFor="entityNameSelect" className="text-sm font-medium">Nombre de la Entidad</label>
              <Select
                value={selectedEntityName}
                onValueChange={setSelectedEntityName}
                disabled={selectedEntityType === 'none' || isLoadingAreas || isLoadingPuestos || entityList.length === 0}
              >
                <SelectTrigger id="entityNameSelect">
                  <SelectValue placeholder={
                    selectedEntityType === 'none' ? "Primero seleccione tipo" :
                    (isLoadingAreas || isLoadingPuestos) ? "Cargando..." :
                    entityList.length === 0 ? "No hay entidades" :
                    "Seleccione nombre..."} />
                </SelectTrigger>
                <SelectContent>
                  {entityList.length > 0 ? entityList.map(entity => (
                    <SelectItem key={entity.id} value={entity.name}>{entity.name}</SelectItem>
                  )) : <SelectItem value="no-entities" disabled>No hay entidades disponibles</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleGenerateSummary} disabled={isGeneratingSummary || selectedEntityType === 'none' || !selectedEntityName}>
              {isGeneratingSummary ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Brain className="mr-2 h-4 w-4" />}
              Generar Resumen
            </Button>
          </div>
          {isGeneratingSummary && (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Generando resumen con IA...</p>
            </div>
          )}
          {generatedSummary && !isGeneratingSummary && (
            <div>
              <h4 className="font-semibold mb-2">Resumen Generado:</h4>
              <Textarea
                value={generatedSummary}
                readOnly
                className="min-h-[150px] bg-muted/50 border-border text-sm"
                rows={8}
              />
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}

