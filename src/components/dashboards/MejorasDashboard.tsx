
'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, CheckCircle2, TrendingUp, Activity as ActivityIcon, FileSearch2, Clock, Loader2, FileText } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from 'recharts';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { useSistemasCostos, type Sistema, type SistemaCosto, type TipoMoneda } from '@/contexts/SistemasCostosContext';
import { useAcciones, type Accion } from '@/contexts/AccionesContext';
import { Tooltip as UiTooltip, TooltipProvider, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DateRange } from 'react-day-picker';
import { format, parseISO, isValid, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { toast } from '@/hooks/use-toast';
import { formatMinutesToHours } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ChartConfig } from '@/components/ui/chart';
import { useAreas } from '@/contexts/AreasContext';
import { useDepartamentos } from '@/contexts/DepartamentosContext';
import { usePuestos } from '@/contexts/PuestosContext';
import { useProcesos } from '@/contexts/ProcesosContext';

function formatDashboardCurrency(amount: number, currency: string) {
  if (currency === 'N/A' || !currency) return amount.toLocaleString('es-MX');
  try {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: currency, currencyDisplay: 'code', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
  } catch (e) {
    return `${amount.toFixed(0)} ${currency}`;
  }
}

const getComparisonText = (current: number, previous: number): string => {
    if (previous === 0) {
        return current > 0 ? "+∞% vs periodo anterior" : "Sin cambios vs periodo anterior";
    }
    const diff = ((current - previous) / previous) * 100;
    if (diff > 0) return `+${diff.toFixed(0)}% vs periodo anterior`;
    if (diff < 0) return `${diff.toFixed(0)}% vs periodo anterior`;
    return "Sin cambios vs periodo anterior";
}

const renderMetric = (value: number | string, loading: boolean, comparisonValue?: string) => {
  if (loading) return <Loader2 className="h-5 w-5 animate-spin" />;
  return (
    <>
      {value}
      {comparisonValue && (
          <p className="text-xs text-muted-foreground pt-1">
            {comparisonValue}
          </p>
      )}
    </>
  );
}

type AhorrosChartType = 'ahorrosPorAccion' | 'ahorrosPorArea';
type AhorrosMetricType = 'costo' | 'tiempo';

interface ValidatedImprovement {
    id: string;
    accionNombre: string;
    procesoNombre: string;
    area: string;
    puesto: string;
    metrica: string;
    antes: number | string;
    despues: number | string;
    ahorro: number;
    moneda?: string;
}

export default function MejorasDashboardPage() {
  const { acciones: globalAcciones, isLoadingAcciones } = useAcciones();
  const { areas, isLoading: isLoadingAreas } = useAreas();
  const { departamentos, isLoading: isLoadingDepartamentos } = useDepartamentos();
  const { puestos, isLoadingPuestos } = usePuestos();
  const { procesos: allCapturedProcesses, isLoadingProcesos } = useProcesos();
  
  const [isLoadingData, setIsLoadingData] = useState(true);

  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [isComparing, setIsComparing] = useState(false);
  const [comparisonDateRange, setComparisonDateRange] = useState<DateRange | undefined>(undefined);
  const [ahorrosChartType, setAhorrosChartType] = useState<AhorrosChartType>('ahorrosPorAccion');
  const [ahorrosMetricType, setAhorrosMetricType] = useState<AhorrosMetricType>('costo');

  useEffect(() => {
    setIsLoadingData(isLoadingAcciones || isLoadingAreas || isLoadingDepartamentos || isLoadingPuestos || isLoadingProcesos);
  }, [isLoadingAcciones, isLoadingAreas, isLoadingDepartamentos, isLoadingPuestos, isLoadingProcesos]);
  
  const filterAccionesByCriteria = (accionesToFilter: Accion[], range?: DateRange): Accion[] => {
      let filtered = accionesToFilter;
      
      if (range?.from) {
        const from = startOfDay(range.from);
        const to = range.to ? endOfDay(range.to) : new Date();
        filtered = filtered.filter(accion => {
            if (accion.fechaFinalizacion) {
                const completionDate = parseISO(accion.fechaFinalizacion);
                return isValid(completionDate) && completionDate >= from && completionDate <= to;
            }
            return false;
        });
      }
      return filtered;
  }
  
  const filteredAcciones = useMemo(() => filterAccionesByCriteria(globalAcciones, dateRange), [globalAcciones, dateRange]);
  const comparisonAcciones = useMemo(() => isComparing ? filterAccionesByCriteria(globalAcciones, comparisonDateRange) : [], [globalAcciones, comparisonDateRange, isComparing]);
  
  const processAccionesMetrics = (accionesToProcess: Accion[]) => {
    const completedActions = accionesToProcess.filter(acc => acc.estado === 'Completada');
    
    const ahorroCostosMap = new Map<string, number>();
    let totalMinutesSaved = 0;

    completedActions.forEach(accion => {
      const historyCostSavings = accion.historialDeCambios?.reduce((acc, cambio) => {
        if (cambio.field.toLowerCase().includes('costo')) {
          const ahorro = (Number(cambio.before) || 0) - (Number(cambio.after) || 0);
          return acc + (ahorro > 0 ? ahorro : 0);
        }
        return acc;
      }, 0) || 0;

      let costoRealizado = 0;
      if (historyCostSavings > 0) {
        costoRealizado = historyCostSavings;
      } else if (accion.ahorroEstimado && accion.ahorroEstimado > 0) {
        costoRealizado = accion.ahorroEstimado;
      }

      if (costoRealizado > 0) {
        const moneda = accion.monedaAhorro || 'MXN';
        ahorroCostosMap.set(moneda, (ahorroCostosMap.get(moneda) || 0) + costoRealizado);
      }

      const historyTimeSavings = accion.historialDeCambios?.reduce((acc, cambio) => {
        if (cambio.field.toLowerCase().includes('tiempo')) {
          const ahorro = (Number(cambio.before) || 0) - (Number(cambio.after) || 0);
          return acc + (ahorro > 0 ? ahorro : 0);
        }
        return acc;
      }, 0) || 0;

      let tiempoRealizado = 0;
       if (historyTimeSavings > 0) {
        tiempoRealizado = historyTimeSavings;
      } else if (accion.ahorroTiempoEstimado && accion.ahorroTiempoEstimado > 0) {
        tiempoRealizado = accion.ahorroTiempoEstimado;
      }
      totalMinutesSaved += tiempoRealizado;
    });

    const ahorroCostosRealizado = Array.from(ahorroCostosMap.entries())
      .map(([currency, total]) => formatDashboardCurrency(total, currency))
      .join(', ') || 'N/A';

    const ahorroTiempoRealizado = totalMinutesSaved > 0 ? formatMinutesToHours(totalMinutesSaved) : 'N/A';
    
    return {
      accionesCompletadasCount: completedActions.length,
      ahorroCostosRealizado,
      ahorroTiempoRealizado,
      totalAhorroCosto: Array.from(ahorroCostosMap.values()).reduce((sum, current) => sum + current, 0),
      totalAhorroTiempoMinutos: totalMinutesSaved,
    };
  };

  const dashboardMetrics = useMemo(() => {
    if (isLoadingAcciones) {
      return {
        accionesCompletadasCount: 0,
        accionesEnRevisionCount: 0,
        accionesEnProgresoCount: 0,
        ahorroCostosRealizado: 'N/A',
        ahorroTiempoRealizado: 'N/A',
        totalAhorroCosto: 0,
        totalAhorroTiempoMinutos: 0,
      };
    }
    const metrics = processAccionesMetrics(filteredAcciones);
    return {
      ...metrics,
      accionesEnRevisionCount: globalAcciones.filter(acc => acc.estado === 'En Revisión').length,
      accionesEnProgresoCount: globalAcciones.filter(acc => acc.estado === 'En Progreso').length,
    };
  }, [filteredAcciones, globalAcciones, isLoadingAcciones]);
  
  const comparisonMetrics = useMemo(() => {
    if (!isComparing || isLoadingAcciones) return null;
    return processAccionesMetrics(comparisonAcciones);
  }, [comparisonAcciones, isComparing, isLoadingAcciones]);


  const isLoadingAll = isLoadingData;
  
  const { ahorrosChartData, ahorrosChartConfig } = useMemo(() => {
    let data: any[] = [];
    const config: ChartConfig = {};
    const accionesCompletadas = filteredAcciones.filter(a => a.estado === 'Completada');

    const getSavings = (accion: Accion, metricType: AhorrosMetricType): {ahorro: number, unidad?: string} => {
        let ahorroRealizado = 0;
        let unidad: string | undefined;

        if (metricType === 'costo') {
            unidad = accion.monedaAhorro;
            const historySavings = accion.historialDeCambios?.reduce((acc, cambio) => {
                 if (cambio.field.toLowerCase().includes('costo')) {
                    const ahorro = (Number(cambio.before) || 0) - (Number(cambio.after) || 0);
                    return acc + (ahorro > 0 ? ahorro : 0);
                }
                return acc;
            }, 0) || 0;
            if (historySavings > 0) {
                ahorroRealizado = historySavings;
            } else if (accion.ahorroEstimado && accion.ahorroEstimado > 0) {
                ahorroRealizado = accion.ahorroEstimado;
            }
        } else { // tiempo
            unidad = accion.unidadTiempoAhorro;
            const historySavings = accion.historialDeCambios?.reduce((acc, cambio) => {
                 if (cambio.field.toLowerCase().includes('tiempo')) {
                    const ahorro = (Number(cambio.before) || 0) - (Number(cambio.after) || 0);
                    return acc + (ahorro > 0 ? ahorro : 0);
                }
                return acc;
            }, 0) || 0;
             if (historySavings > 0) {
                ahorroRealizado = historySavings;
            } else if (accion.ahorroTiempoEstimado && accion.ahorroTiempoEstimado > 0) {
                ahorroRealizado = accion.ahorroTiempoEstimado;
            }
        }
        return {ahorro: ahorroRealizado, unidad};
    }
    
    switch (ahorrosChartType) {
        case 'ahorrosPorArea':
            const ahorrosPorArea = new Map<string, { [key: string]: number }>();
            accionesCompletadas.forEach(a => {
                const { ahorro, unidad } = getSavings(a, ahorrosMetricType);
                if (ahorro > 0 && unidad) {
                    const areaName = a.area || 'Sin Área Asignada';
                    const current = ahorrosPorArea.get(areaName) || {};
                    current[unidad] = (current[unidad] || 0) + ahorro;
                    ahorrosPorArea.set(areaName, current);
                }
            });
            data = Array.from(ahorrosPorArea.entries()).map(([name, values]) => ({ name, ...values }));
            
            const allKeys = new Set<string>();
            data.forEach(d => { Object.keys(d).forEach(k => { if(k !== 'name') allKeys.add(k) }) });
            let i = 1;
            allKeys.forEach(key => { config[key] = { label: key.split('/')[0], color: `hsl(var(--chart-${i++}))` }; });
            break;

        case 'ahorrosPorAccion':
        default:
            const ahorrosPorAccionMap = new Map<string, { ahorro: number; unidad?: string }>();
            accionesCompletadas.forEach(accion => {
                const { ahorro, unidad } = getSavings(accion, ahorrosMetricType);
                if (ahorro > 0) {
                    ahorrosPorAccionMap.set(accion.nombre, { ahorro, unidad });
                }
            });
            data = Array.from(ahorrosPorAccionMap.entries()).map(([name, { ahorro, unidad }]) => ({ name, Ahorro: ahorro, unidad, }));
            config['Ahorro'] = { label: `Ahorro Realizado (${ahorrosMetricType})`, color: 'hsl(var(--chart-1))' };
            break;
    }
    
    return { ahorrosChartData: data, ahorrosChartConfig: config };

  }, [ahorrosChartType, ahorrosMetricType, filteredAcciones]);


  return (
    <div className="container mx-auto py-8">
       <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Ahorro Anual Realizado</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{renderMetric(dashboardMetrics.ahorroCostosRealizado, isLoadingAll, isComparing && comparisonMetrics ? getComparisonText(dashboardMetrics.totalAhorroCosto, comparisonMetrics.totalAhorroCosto) : undefined)}</div><p className="text-xs text-muted-foreground">De acciones completadas</p></CardContent>
        </Card>
        <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Ahorro de Tiempo</CardTitle><Clock className="h-4 w-4 text-muted-foreground" /></CardHeader>
            <CardContent><div className="text-2xl font-bold">{renderMetric(dashboardMetrics.ahorroTiempoRealizado, isLoadingAll, isComparing && comparisonMetrics ? getComparisonText(dashboardMetrics.totalAhorroTiempoMinutos, comparisonMetrics.totalAhorroTiempoMinutos) : undefined)}</div><p className="text-xs text-muted-foreground">De acciones completadas</p></CardContent>
        </Card>
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Acciones Completadas</CardTitle><CheckCircle2 className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{renderMetric(dashboardMetrics.accionesCompletadasCount, isLoadingAll, isComparing && comparisonMetrics ? getComparisonText(dashboardMetrics.accionesCompletadasCount, comparisonMetrics.accionesCompletadasCount) : undefined)}</div><p className="text-xs text-muted-foreground">En el periodo</p></CardContent>
        </Card>
        <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Acciones en Progreso</CardTitle><ActivityIcon className="h-4 w-4 text-muted-foreground" /></CardHeader>
            <CardContent><div className="text-2xl font-bold">{renderMetric(dashboardMetrics.accionesEnProgresoCount, isLoadingAll)}</div><p className="text-xs text-muted-foreground">Activas actualmente</p></CardContent>
        </Card>
        <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Acciones en Revisión</CardTitle><FileSearch2 className="h-4 w-4 text-muted-foreground" /></CardHeader>
            <CardContent><div className="text-2xl font-bold">{renderMetric(dashboardMetrics.accionesEnRevisionCount, isLoadingAll)}</div><p className="text-xs text-muted-foreground">Pendientes de aprobación</p></CardContent>
        </Card>
      </div>
      
      <Card className="shadow-lg mb-6">
        <CardHeader>
          <div className="flex justify-between items-center flex-wrap gap-2">
            <CardTitle>Análisis Gráfico de Ahorros</CardTitle>
            <div className="flex gap-2">
                <Select value={ahorrosChartType} onValueChange={(v) => setAhorrosChartType(v as AhorrosChartType)}>
                  <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ahorrosPorAccion">Por Acción</SelectItem>
                    <SelectItem value="ahorrosPorArea">Por Área</SelectItem>
                  </SelectContent>
                </Select>
                 <Select value={ahorrosMetricType} onValueChange={(v) => setAhorrosMetricType(v as AhorrosMetricType)}>
                  <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="costo">Ahorro Monetario</SelectItem>
                    <SelectItem value="tiempo">Ahorro de Tiempo</SelectItem>
                  </SelectContent>
                </Select>
            </div>
          </div>
          <CardDescription>Visualización del ahorro realizado por cada acción de mejora completada en el período.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingAll ? <div className="flex justify-center items-center h-full min-h-[300px]"><Loader2 className="h-8 w-8 animate-spin"/></div> :
          ahorrosChartData.length > 0 ? (
            <ChartContainer config={ahorrosChartConfig} className="min-h-[300px] w-full">
              <BarChart data={ahorrosChartData} layout="vertical">
                <CartesianGrid horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tickMargin={10} width={120} />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted))" }}
                  content={
                    <ChartTooltipContent
                      formatter={(value, name, item) => {
                          const { payload } = item;
                          const unidad = payload.unidad || (typeof name === 'string' ? name : null) || 'N/A';
                          const formattedValue = ahorrosMetricType === 'costo'
                              ? formatDashboardCurrency(value as number, unidad)
                              : formatMinutesToHours(value as number);

                          return (
                              <div className="flex w-full justify-between items-center">
                                  <span>{ahorrosChartConfig[name as string]?.label || name}</span>
                                  <span className="ml-4 font-mono font-medium tabular-nums text-foreground">
                                    {formattedValue}
                                  </span>
                              </div>
                          );
                      }}
                      labelClassName="font-bold"
                    />
                  }
                />
                <Legend />
                {ahorrosChartType === 'ahorrosPorAccion' ? (
                  <Bar dataKey="Ahorro" fill="var(--color-Ahorro)" radius={4} />
                ) : (
                  Object.keys(ahorrosChartConfig).map(key => (
                    <Bar key={key} dataKey={key} stackId="a" fill={`var(--color-${key})`} radius={4} />
                  ))
                )}
              </BarChart>
            </ChartContainer>
          ) : (
            <div className="flex items-center justify-center h-full bg-muted/30 rounded-lg min-h-[250px]">
              <p className="text-muted-foreground">No hay datos de ahorros para graficar.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
