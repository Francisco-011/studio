
'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Factory, DollarSign, ListChecks, PackageX, Loader2, Layers, CopyCheck, CheckCircle2, TrendingUp, FileSearch2, Activity as ActivityIcon, CalendarIcon as CalendarIconLucide } from "lucide-react";
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

import type { CapturedProcess } from '../procesos-y-flujos-registrados/page';
import { useActividades, type Actividad } from '@/contexts/ActividadesContext';
import { useSistemasCostos, type Sistema, type SistemaCosto, type TipoMoneda } from '@/contexts/SistemasCostosContext';
import { useAcciones, type Accion } from '@/contexts/AccionesContext';


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
  
  const { actividades: allActividades, isLoadingActividades } = useActividades();
  const { sistemas, costosSistemas, isLoadingSistemasCostos } = useSistemasCostos();
  const { acciones: allAcciones, isLoadingAcciones } = useAcciones();

  const [calculatedSystemCosts, setCalculatedSystemCosts] = useState<CalculatedSystemCost[]>([]);
  const [evolutionChartData, setEvolutionChartData] = useState<MonthlyEvolutionData[]>([]);

  const [dashboardDateRange, setDashboardDateRange] = useState<{ from?: Date; to?: Date }>({
    from: startOfMonth(subMonths(new Date(), 5)), 
    to: endOfMonth(new Date()),
  });


  useEffect(() => {
    setIsLoadingProcessData(true);
    try {
      const storedProcesses = localStorage.getItem(CAPTURED_DATA_LOCAL_STORAGE_KEY);
      if (storedProcesses) {
        const parsedProcesses: CapturedProcess[] = JSON.parse(storedProcesses);
        setAllCapturedProcesses(parsedProcesses.filter(p => !p.deletedAt && p.activo !== false));
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

  const filteredCapturedProcesses = useMemo(() => {
    if (!dashboardDateRange.from || !dashboardDateRange.to) return allCapturedProcesses;
    return allCapturedProcesses.filter(proc => {
        if (!proc.capturedAt) return false;
        const capturedDate = parseISO(proc.capturedAt);
        return isValid(capturedDate) && isWithinInterval(capturedDate, { start: dashboardDateRange.from!, end: dashboardDateRange.to! });
    });
  }, [allCapturedProcesses, dashboardDateRange]);

  const filteredAcciones = useMemo(() => {
    if (!dashboardDateRange.from || !dashboardDateRange.to) return allAcciones;
    
    const rangeStart = dashboardDateRange.from;
    const rangeEnd = dashboardDateRange.to;

    return allAcciones.filter(accion => {
        if (accion.estado === 'Completada' && accion.fechaFinalizacion) {
            const finalizacionDate = parseISO(accion.fechaFinalizacion);
            return isValid(finalizacionDate) && isWithinInterval(finalizacionDate, { start: rangeStart, end: rangeEnd });
        }
        if ((accion.estado === 'En Revisión' || accion.estado === 'En Progreso') && accion.fechaCreacion) {
             const creacionDate = parseISO(accion.fechaCreacion);
             return isValid(creacionDate) && isWithinInterval(creacionDate, { start: rangeStart, end: rangeEnd });
        }
        return false; 
    });
  }, [allAcciones, dashboardDateRange]);

  const filteredActividades = useMemo(() => {
    if (!dashboardDateRange.from || !dashboardDateRange.to) return allActividades;
    return allActividades.filter(act => {
        if (!act.createdAt) return false;
        const createdAtDate = new Date(act.createdAt);
        return isValid(createdAtDate) && isWithinInterval(createdAtDate, { start: dashboardDateRange.from!, end: dashboardDateRange.to! });
    });
  }, [allActividades, dashboardDateRange]);


 useEffect(() => {
    if (!isLoadingProcessData && !isLoadingAcciones && dashboardDateRange.from && dashboardDateRange.to) {
      const monthlyData: MonthlyEvolutionData[] = [];
      const monthsInInterval = eachMonthOfInterval({
        start: dashboardDateRange.from,
        end: dashboardDateRange.to,
      });

      monthsInInterval.forEach(monthStart => {
        const monthEnd = endOfMonth(monthStart);
        const monthLabel = format(monthStart, "MMM yy", { locale: es });

        const procesosEsteMes = allCapturedProcesses.filter(proc => { // Use allCapturedProcesses for chart to show historical overall
          if (!proc.capturedAt) return false;
          const capturedDate = parseISO(proc.capturedAt);
          return isValid(capturedDate) && isWithinInterval(capturedDate, { start: monthStart, end: monthEnd });
        }).length;

        const accionesEsteMes = allAcciones.filter(accion => { // Use allAcciones for chart
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
  }, [allCapturedProcesses, allAcciones, isLoadingProcessData, isLoadingAcciones, dashboardDateRange]);


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
    
    // For "sin uso" and "duplicadas", it's more meaningful to check against all processes, not just filtered ones
    const actividadesSinUsoCount = activeFilteredActividades.filter(a => a.procesosAsociadosCount === 0).length;
    const actividadesDuplicadasCount = activeFilteredActividades.filter(act => (act.procesosAsociadosCount || 0) > 1).length;
    
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
  }, [filteredCapturedProcesses, filteredAcciones, filteredActividades, isLoadingProcessData, isLoadingActividades, isLoadingAcciones]);


  const isLoadingAllData = isLoadingProcessData || isLoadingActividades || isLoadingAcciones || isLoadingSistemasCostos;

  const renderMetric = (value: number | string, loading: boolean, icon?: React.ReactNode) => {
    if (loading) {
      return <Loader2 className={`h-5 w-5 animate-spin ${icon ? 'mr-2' : ''}`} />;
    }
    return <>{icon}{value}</>;
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
        <h1 className="text-3xl font-headline font-bold text-primary mb-2 sm:mb-0">Dashboard Ejecutivo</h1>
        <div className="flex flex-col sm:flex-row gap-2">
            <Popover>
                <PopoverTrigger asChild>
                <Button
                    variant={"outline"}
                    size="sm"
                    className={cn(
                    "w-full sm:w-[180px] justify-start text-left font-normal",
                    !dashboardDateRange.from && "text-muted-foreground"
                    )}
                >
                    <CalendarIconLucide className="mr-2 h-4 w-4" />
                    {dashboardDateRange.from ? format(dashboardDateRange.from, "dd MMM yy", {locale: es}) : <span>Desde</span>}
                </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                    mode="single"
                    selected={dashboardDateRange.from}
                    onSelect={(date) => setDashboardDateRange(prev => ({ ...prev, from: date ? startOfMonth(date) : undefined }))}
                    defaultMonth={dashboardDateRange.from}
                    captionLayout="dropdown-buttons"
                    fromYear={2020}
                    toYear={new Date().getFullYear() + 1}
                    disabled={(date) => dashboardDateRange.to ? date > dashboardDateRange.to : false}
                    initialFocus
                />
                </PopoverContent>
            </Popover>
            <Popover>
                <PopoverTrigger asChild>
                <Button
                    variant={"outline"}
                    size="sm"
                    className={cn(
                    "w-full sm:w-[180px] justify-start text-left font-normal",
                    !dashboardDateRange.to && "text-muted-foreground"
                    )}
                >
                    <CalendarIconLucide className="mr-2 h-4 w-4" />
                    {dashboardDateRange.to ? format(dashboardDateRange.to, "dd MMM yy", {locale: es}) : <span>Hasta</span>}
                </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                    mode="single"
                    selected={dashboardDateRange.to}
                    onSelect={(date) => setDashboardDateRange(prev => ({ ...prev, to: date ? endOfMonth(date) : undefined }))}
                    defaultMonth={dashboardDateRange.to}
                    captionLayout="dropdown-buttons"
                    fromYear={2020}
                    toYear={new Date().getFullYear() + 1}
                    disabled={(date) => dashboardDateRange.from ? date < dashboardDateRange.from : false}
                    initialFocus
                />
                </PopoverContent>
            </Popover>
        </div>
      </div>
      <p className="text-sm text-muted-foreground mb-8">Métricas clave basadas en el rango de fechas seleccionado (excepto Costos de Sistemas).</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Procesos Activos Mapeados</CardTitle>
            <Factory className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {renderMetric(dashboardMetrics.procesosMapeadosCount, isLoadingProcessData || isLoadingActividades)}
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
              {renderMetric(dashboardMetrics.procesosConVariacionesCount, isLoadingProcessData)}
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
              {renderMetric(dashboardMetrics.actividadesActivasCount, isLoadingActividades)}
            </div>
            <p className="text-xs text-muted-foreground">(Creadas en el periodo)</p>
          </CardContent>
        </Card>
        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Actividades Duplicadas</CardTitle>
            <CopyCheck className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
                 {renderMetric(dashboardMetrics.actividadesDuplicadasCount, isLoadingActividades)}
            </div>
            <p className="text-xs text-muted-foreground">Actividades (creadas en periodo) en &gt;1 proceso.</p>
          </CardContent>
        </Card>
        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Acciones Completadas</CardTitle>
            <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {renderMetric(dashboardMetrics.accionesCompletadasCount, isLoadingAcciones)}
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
              {renderMetric(dashboardMetrics.accionesEnRevisionCount, isLoadingAcciones)}
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
              {renderMetric(dashboardMetrics.accionesEnProgresoCount, isLoadingAcciones)}
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
               {renderMetric(dashboardMetrics.procesosSinActividadesCount, isLoadingProcessData)}
            </div>
            <p className="text-xs text-muted-foreground">Procesos (capturados en periodo) sin actividades detalladas.</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
            {isLoadingAllData ? (
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
            {isLoadingAllData ? (
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
    </div>
  );
}

