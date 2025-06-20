
'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Factory, DollarSign, ListChecks, PackageX, Loader2, Layers, CopyCheck, CheckCircle2, TrendingUp, FileSearch2, Activity as ActivityIcon } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig
} from "@/components/ui/chart";
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

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
        if (cost.moneda === systemCurrency) { // Simple assumption: sum costs of the same currency
          let periodicUsage = 0;
          if (cost.tipoCosto.includes("Por Uso del Sistema") && cost.montoUso) {
            periodicUsage = cost.montoUso;
          }
          
          let periodicLicense = 0;
          if (cost.tipoCosto.includes("Por Licencias") && cost.numeroLicencias && cost.costoPorLicencia) {
            periodicLicense = cost.numeroLicencias * cost.costoPorLicencia;
            systemTotalLicenses += cost.numeroLicencias; // Sum up licenses
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
  const [capturedProcesses, setCapturedProcesses] = useState<CapturedProcess[]>([]);
  const [isLoadingProcessData, setIsLoadingProcessData] = useState(true);
  
  const { actividades, isLoadingActividades } = useActividades();
  const { sistemas, costosSistemas, isLoadingSistemasCostos } = useSistemasCostos();
  const { acciones, isLoadingAcciones } = useAcciones();

  const [calculatedSystemCosts, setCalculatedSystemCosts] = useState<CalculatedSystemCost[]>([]);
  const [evolutionChartData, setEvolutionChartData] = useState<MonthlyEvolutionData[]>([]);

  useEffect(() => {
    setIsLoadingProcessData(true);
    try {
      const storedProcesses = localStorage.getItem(CAPTURED_DATA_LOCAL_STORAGE_KEY);
      if (storedProcesses) {
        const parsedProcesses: CapturedProcess[] = JSON.parse(storedProcesses);
        setCapturedProcesses(parsedProcesses.filter(p => !p.deletedAt && p.activo !== false));
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
    if (!isLoadingProcessData && !isLoadingAcciones) {
      const now = new Date();
      const monthlyData: MonthlyEvolutionData[] = [];

      for (let i = 5; i >= 0; i--) {
        const targetMonthDate = subMonths(now, i);
        const monthStart = startOfMonth(targetMonthDate);
        const monthEnd = endOfMonth(targetMonthDate);
        
        const monthLabel = format(monthStart, "MMM yy", { locale: es });

        const procesosEsteMes = capturedProcesses.filter(proc => {
          const capturedDate = parseISO(proc.capturedAt);
          return isWithinInterval(capturedDate, { start: monthStart, end: monthEnd });
        }).length;

        const accionesEsteMes = acciones.filter(accion => {
          if (accion.estado === 'Completada' && accion.fechaFinalizacion) {
            const finalizacionDate = parseISO(accion.fechaFinalizacion);
            return isWithinInterval(finalizacionDate, { start: monthStart, end: monthEnd });
          }
          return false;
        }).length;
        
        monthlyData.push({
          month: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1), // Capitalize month
          procesosMapeados: procesosEsteMes,
          accionesCompletadas: accionesEsteMes,
        });
      }
      setEvolutionChartData(monthlyData);
    }
  }, [capturedProcesses, acciones, isLoadingProcessData, isLoadingAcciones]);


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
      };
    }

    const activeProcesses = capturedProcesses.filter(p => !p.deletedAt && p.activo !== false);
    const procesosMapeadosCount = activeProcesses.length;

    const actividadesActivasCount = actividades.filter(a => a.activa).length;
    const actividadesSinUsoCount = actividades.filter(a => a.activa && a.procesosAsociadosCount === 0).length;
    
    const accionesCompletadasCount = acciones.filter(acc => acc.estado === 'Completada').length;
    const accionesEnRevisionCount = acciones.filter(acc => acc.estado === 'En Revisión').length;
    const accionesEnProgresoCount = acciones.filter(acc => acc.estado === 'En Progreso').length;

    const processContexts = new Map<string, Set<string>>();
    activeProcesses.forEach(proc => {
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

    const actividadesDuplicadasCount = actividades.filter(act => act.activa && (act.procesosAsociadosCount || 0) > 1).length;

    return {
      procesosMapeadosCount,
      actividadesActivasCount,
      actividadesSinUsoCount,
      accionesCompletadasCount,
      accionesEnRevisionCount,
      accionesEnProgresoCount,
      procesosConVariacionesCount,
      actividadesDuplicadasCount,
    };
  }, [capturedProcesses, actividades, acciones, isLoadingProcessData, isLoadingActividades, isLoadingAcciones]);


  const isLoadingAllData = isLoadingProcessData || isLoadingActividades || isLoadingAcciones || isLoadingSistemasCostos;

  const renderMetric = (value: number | string, loading: boolean, icon?: React.ReactNode) => {
    if (loading) {
      return <Loader2 className={`h-5 w-5 animate-spin ${icon ? 'mr-2' : ''}`} />;
    }
    return <>{icon}{value}</>;
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-headline font-bold mb-8 text-primary">Dashboard Ejecutivo</h1>
      
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
            <p className="text-xs text-muted-foreground">Actividades asignadas a más de un proceso.</p>
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
          </CardContent>
        </Card>
        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Actividades Activas Sin Uso</CardTitle>
            <PackageX className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
               {renderMetric(dashboardMetrics.actividadesSinUsoCount, isLoadingActividades)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-lg">
          <CardHeader>
            <CardTitle>Evolución de Optimización de Procesos</CardTitle>
            <CardDescription>Seguimiento mensual de procesos mapeados vs. acciones completadas (últimos 6 meses).</CardDescription>
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
                    <p className="text-muted-foreground">No hay suficientes datos para mostrar la evolución.</p>
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
            <CardDescription className="mb-4">Resumen de costos anuales estimados por uso y licencias, y número total de licencias.</CardDescription>
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
