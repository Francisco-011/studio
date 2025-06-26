
'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, CheckCircle2, TrendingUp, Activity as ActivityIcon, FileSearch2, Clock, Loader2, FileText, CalendarRange } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
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
import type { CapturedProcess } from '../../procesos-y-flujos-registrados/page';
import { Label } from '@/components/ui/label';

const CAPTURED_DATA_LOCAL_STORAGE_KEY = 'proceza-captured-data';

function formatDashboardCurrency(amount: number, currency: string) {
  if (currency === 'N/A') return '-';
  try {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: currency, currencyDisplay: 'code', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
  } catch (e) {
    return `${amount.toFixed(0)} ${currency}`;
  }
}

interface CostByCurrency {
    currency: TipoMoneda | string;
    annualUsageCost: number;
    annualLicenseCost: number;
}
interface CalculatedSystemCost {
    id: string;
    name: string;
    costsByCurrency: CostByCurrency[];
    descriptions: string[];
}

function calculateAllSystemAnnualCosts(
  systemsToCalculate: Sistema[],
  allCostos: SistemaCosto[]
): CalculatedSystemCost[] {
  return systemsToCalculate.map(system => {
    const costsForSystem = allCostos.filter(cost => cost.sistemaId === system.id);
    const costsByCurrency = new Map<TipoMoneda | string, { annualUsageCost: number; annualLicenseCost: number }>();
    const descriptions: string[] = [];

    costsForSystem.forEach(cost => {
      if (cost.descripcion) descriptions.push(cost.descripcion);
      const multiplier = cost.frecuencia === 'Mensual' ? 12 : 1;
      
      const usageCost = (cost.montoUso || 0) * multiplier;
      const licenseCost = ((cost.costoPorLicencia || 0) * (cost.numeroLicencias || 0)) * multiplier;

      const currency = cost.moneda || 'MXN';
      const currentCosts = costsByCurrency.get(currency) || { annualUsageCost: 0, annualLicenseCost: 0 };
      
      costsByCurrency.set(currency, {
          annualUsageCost: currentCosts.annualUsageCost + usageCost,
          annualLicenseCost: currentCosts.annualLicenseCost + licenseCost
      });
    });

    return {
      id: system.id,
      name: system.nombre,
      costsByCurrency: Array.from(costsByCurrency.entries()).map(([currency, { annualUsageCost, annualLicenseCost }]) => ({ currency, annualUsageCost, annualLicenseCost })),
      descriptions,
    };
  });
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

type ChartType = 'costos' | 'ahorros';

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
  const { sistemas, costosSistemas, isLoadingSistemasCostos } = useSistemasCostos();
  const { acciones: globalAcciones, isLoadingAcciones } = useAcciones();
  const { areas, isLoading: isLoadingAreas } = useAreas();
  const { departamentos, isLoading: isLoadingDepartamentos } = useDepartamentos();
  const { puestos, isLoadingPuestos } = usePuestos();
  
  const [allCapturedProcesses, setAllCapturedProcesses] = useState<CapturedProcess[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [isComparing, setIsComparing] = useState(false);
  const [comparisonDateRange, setComparisonDateRange] = useState<DateRange | undefined>(undefined);
  const [chartType, setChartType] = useState<ChartType>('ahorros');
  
  const [selectedArea, setSelectedArea] = useState<string>('all');
  const [selectedDepartamento, setSelectedDepartamento] = useState<string>('all');
  const [selectedPuesto, setSelectedPuesto] = useState<string>('all');

  useEffect(() => {
    setIsLoadingData(isLoadingSistemasCostos || isLoadingAcciones || isLoadingAreas || isLoadingDepartamentos || isLoadingPuestos);
  }, [isLoadingSistemasCostos, isLoadingAcciones, isLoadingAreas, isLoadingDepartamentos, isLoadingPuestos]);
  
  useEffect(() => {
    try {
        const storedProcesses = localStorage.getItem(CAPTURED_DATA_LOCAL_STORAGE_KEY);
        if (storedProcesses) {
            setAllCapturedProcesses(JSON.parse(storedProcesses));
        }
    } catch(e) {
        console.error("Error loading processes for mejoras dashboard", e);
    }
  }, []);

  const filterAccionesByCriteria = (accionesToFilter: Accion[], range?: DateRange): Accion[] => {
      let filtered = accionesToFilter;
      
      if (range?.from) {
        const from = startOfDay(range.from);
        const to = range.to ? endOfDay(range.to) : endOfDay(new Date());
        filtered = filtered.filter(accion => {
            if (accion.fechaFinalizacion) {
                const completionDate = parseISO(accion.fechaFinalizacion);
                return isValid(completionDate) && completionDate >= from && completionDate <= to;
            }
            return false;
        });
      }
      
      if (selectedArea !== 'all') {
        const puestosInArea = puestos.filter(p => p.areaId === areas.find(a => a.nombre === selectedArea)?.id).map(p => p.nombre);
        filtered = filtered.filter(a => a.area === selectedArea || (a.puesto && puestosInArea.includes(a.puesto)));
      }
      if (selectedDepartamento !== 'all') {
          const depto = departamentos.find(d => d.nombre === selectedDepartamento);
          if (depto) {
              const puestosInDepto = puestos.filter(p => p.departamentoId === depto.id).map(p => p.nombre);
              filtered = filtered.filter(a => a.puesto && puestosInDepto.includes(a.puesto));
          } else {
              filtered = [];
          }
      }
      if (selectedPuesto !== 'all') {
        filtered = filtered.filter(a => a.puesto === selectedPuesto);
      }
      
      return filtered;
  }
  
  const filteredAcciones = useMemo(() => filterAccionesByCriteria(globalAcciones, dateRange), [globalAcciones, dateRange, selectedArea, selectedDepartamento, selectedPuesto, areas, departamentos, puestos]);
  const comparisonAcciones = useMemo(() => isComparing ? filterAccionesByCriteria(globalAcciones, comparisonDateRange) : [], [globalAcciones, comparisonDateRange, isComparing, selectedArea, selectedDepartamento, selectedPuesto, areas, departamentos, puestos]);
  
  const processAccionesMetrics = (accionesToProcess: Accion[]) => {
      const completedActions = accionesToProcess.filter(acc => acc.estado === 'Completada');
      const ahorroCostosMap = new Map<string, number>();
      completedActions.forEach(a => {
        if (a.ahorroEstimado && a.monedaAhorro) {
          ahorroCostosMap.set(a.monedaAhorro, (ahorroCostosMap.get(a.monedaAhorro) || 0) + a.ahorroEstimado);
        }
      });
      
      let totalMinutesSaved = 0;
      completedActions.forEach(a => {
        if (a.ahorroTiempoEstimado && a.unidadTiempoAhorro) {
            let valueInMinutes = a.ahorroTiempoEstimado;
            if (a.unidadTiempoAhorro.startsWith('Horas')) {
                valueInMinutes *= 60;
            }
            totalMinutesSaved += valueInMinutes;
        }
      });
      const ahorroTiempoRealizado = totalMinutesSaved > 0 ? formatMinutesToHours(totalMinutesSaved) : 'N/A';
      
      return {
        accionesCompletadasCount: completedActions.length,
        ahorroCostosRealizado: Array.from(ahorroCostosMap.entries()).map(([currency, total]) => formatDashboardCurrency(total, currency)).join(', ') || 'N/A',
        ahorroTiempoRealizado,
        totalAhorroMXN: ahorroCostosMap.get('MXN') || 0, // for comparison
      };
  }

  const dashboardMetrics = useMemo(() => {
    if (isLoadingAcciones) {
      return {
        accionesCompletadasCount: 0,
        accionesEnRevisionCount: 0,
        accionesEnProgresoCount: 0,
        ahorroCostosRealizado: 'N/A',
        ahorroTiempoRealizado: 'N/A',
        totalAhorroMXN: 0,
      };
    }
    const { accionesCompletadasCount, ahorroCostosRealizado, ahorroTiempoRealizado, totalAhorroMXN } = processAccionesMetrics(filteredAcciones);
    return {
      accionesCompletadasCount,
      accionesEnRevisionCount: globalAcciones.filter(acc => acc.estado === 'En Revisión').length,
      accionesEnProgresoCount: globalAcciones.filter(acc => acc.estado === 'En Progreso').length,
      ahorroCostosRealizado,
      ahorroTiempoRealizado,
      totalAhorroMXN,
    };
  }, [filteredAcciones, globalAcciones, isLoadingAcciones]);
  
  const comparisonMetrics = useMemo(() => {
    if (!isComparing || isLoadingAcciones) return null;
    return processAccionesMetrics(comparisonAcciones);
  }, [comparisonAcciones, isComparing, isLoadingAcciones]);


  const isLoadingAll = isLoadingData;

  const filteredSystemCosts = useMemo(() => {
      if (isLoadingSistemasCostos || isLoadingAll) return [];
      
      let processesToConsider = allCapturedProcesses.filter(p => !p.deletedAt);
      if (selectedArea !== 'all') {
          processesToConsider = processesToConsider.filter(p => p.area === selectedArea);
      }
      if (selectedDepartamento !== 'all') {
          processesToConsider = processesToConsider.filter(p => p.departamento === selectedDepartamento);
      }
      if (selectedPuesto !== 'all') {
          processesToConsider = processesToConsider.filter(p => p.puesto === selectedPuesto);
      }
      
      const systemNamesInScope = new Set<string>();
      processesToConsider.forEach(p => { p.sistemas?.forEach(s => systemNamesInScope.add(s)); });
      const systemsToCalculate = sistemas.filter(s => systemNamesInScope.has(s.nombre));
      
      const calculated = calculateAllSystemAnnualCosts(systemsToCalculate, costosSistemas);

      return calculated.flatMap(system => 
          (system.costsByCurrency && system.costsByCurrency.length > 0)
              ? system.costsByCurrency.map(cost => ({
                  id: `${system.id}-${cost.currency}`,
                  name: system.name,
                  currency: cost.currency,
                  annualUsageCost: cost.annualUsageCost,
                  annualLicenseCost: cost.annualLicenseCost,
                  descriptions: system.descriptions,
              }))
              : [{
                  id: system.id,
                  name: system.name,
                  currency: 'N/A',
                  annualUsageCost: 0,
                  annualLicenseCost: 0,
                  descriptions: ["Sin costos registrados"],
              }]
      ).sort((a, b) => a.name.localeCompare(b.name));
  }, [allCapturedProcesses, sistemas, costosSistemas, selectedArea, selectedDepartamento, selectedPuesto, isLoadingSistemasCostos, isLoadingAll]);
  
  const grandTotals = useMemo(() => {
    const totals = new Map<string, { usage: number; license: number }>();
    filteredSystemCosts.forEach(item => {
        if(item.currency !== 'N/A') {
            const current = totals.get(item.currency) || { usage: 0, license: 0 };
            current.usage += item.annualUsageCost;
            current.license += item.annualLicenseCost;
            totals.set(item.currency, current);
        }
    });
    return Array.from(totals.entries()).map(([currency, data]) => ({
        currency,
        ...data,
        total: data.usage + data.license
    }));
  }, [filteredSystemCosts]);
  
  const mejorasValidadas = useMemo((): ValidatedImprovement[] => {
      const mejoras: ValidatedImprovement[] = [];
      filteredAcciones
          .filter(a => a.estado === 'Completada' && a.historialDeCambios && a.historialDeCambios.length > 0)
          .forEach(accion => {
              accion.historialDeCambios?.forEach(cambio => {
                  if (cambio.field.includes('Tiempo') || cambio.field.includes('Costo')) {
                      const procesoAfectado = allCapturedProcesses.find(p => p.id === accion.procesoId);
                      if (procesoAfectado) {
                          mejoras.push({
                              id: `${accion.id}-${cambio.field}`,
                              accionNombre: accion.nombre,
                              procesoNombre: procesoAfectado.proceso,
                              area: procesoAfectado.area || 'N/A',
                              puesto: procesoAfectado.puesto || 'N/A',
                              metrica: cambio.field.includes('Tiempo') ? 'Tiempo (min)' : 'Costo',
                              antes: Number(cambio.before) || 0,
                              despues: Number(cambio.after) || 0,
                              ahorro: (Number(cambio.before) || 0) - (Number(cambio.after) || 0),
                              moneda: accion.monedaAhorro,
                          });
                      }
                  }
              });
          });
      return mejoras;
  }, [filteredAcciones, allCapturedProcesses]);
  
  const chartData = useMemo(() => {
    if (chartType === 'costos') {
      return filteredSystemCosts
          .filter(sys => sys.currency !== 'N/A')
          .map(sys => ({
              name: `${sys.name} (${sys.currency})`,
              'Costo Uso': sys.annualUsageCost,
              'Costo Licencias': sys.annualLicenseCost,
          }));
    } else {
      const processChartAcciones = (acciones: Accion[], suffix = "") => {
          const data: { [key: string]: { ahorro: number, moneda: string } } = {};
          acciones.filter(a => a.estado === 'Completada' && a.ahorroEstimado && a.monedaAhorro)
              .forEach(a => {
                  const key = `${a.nombre}${suffix}`;
                  data[key] = {
                      ahorro: (data[key]?.ahorro || 0) + a.ahorroEstimado!,
                      moneda: a.monedaAhorro!
                  };
              });
          return data;
      };

      const primaryData = processChartAcciones(filteredAcciones);
      const comparisonData = isComparing ? processChartAcciones(comparisonAcciones, " (Comp)") : {};
      
      const allNames = new Set([...Object.keys(primaryData), ...Object.keys(comparisonData).map(k => k.replace(" (Comp)", ""))]);
      
      return Array.from(allNames).map(name => {
          const baseName = name.replace(" (Comp)", "");
          return {
              name: baseName,
              'Ahorro': primaryData[baseName] ? primaryData[baseName].ahorro : 0,
              'Ahorro (Comp)': comparisonData[`${baseName} (Comp)`] ? comparisonData[`${baseName} (Comp)`].ahorro : 0,
              moneda: primaryData[baseName]?.moneda || comparisonData[`${baseName} (Comp)`]?.moneda || '',
          }
      });
    }
  }, [chartType, filteredSystemCosts, filteredAcciones, comparisonAcciones, isComparing]);

  const chartConfig: ChartConfig = useMemo(() => {
    if (chartType === 'costos') {
      return {
        'Costo Uso': { label: 'Costo Uso', color: 'hsl(var(--chart-2))' },
        'Costo Licencias': { label: 'Costo Licencias', color: 'hsl(var(--chart-1))' },
      };
    } else {
      return {
        'Ahorro': { label: 'Ahorro Periodo Actual', color: 'hsl(var(--chart-1))' },
        'Ahorro (Comp)': { label: 'Ahorro Periodo Comp.', color: 'hsl(var(--chart-2))' },
      };
    }
  }, [chartType]);

  const handleExport = (type: 'sistemas' | 'mejoras') => {
    if (type === 'sistemas') {
        if (filteredSystemCosts.length === 0) {
            toast({ title: "Nada que exportar", description: "No hay datos de costos de sistemas para exportar.", variant: "default" });
            return;
        }
        const headers = ["Sistema", "Moneda", "Costo Anual (Uso)", "Costo Anual (Licencias)", "Costo Anual (Total)"];
        const csvRows = [headers.join(',')];
        filteredSystemCosts.forEach(sys => {
            const row = [
                escapeCsvCell(sys.name),
                escapeCsvCell(sys.currency),
                escapeCsvCell(sys.annualUsageCost.toFixed(2)),
                escapeCsvCell(sys.annualLicenseCost.toFixed(2)),
                escapeCsvCell((sys.annualUsageCost + sys.annualLicenseCost).toFixed(2))
            ];
            csvRows.push(row.join(','));
        });
        grandTotals.forEach(total => {
            csvRows.push(['']);
            csvRows.push([`Total General (${total.currency})`, '', escapeCsvCell(total.usage.toFixed(2)), escapeCsvCell(total.license.toFixed(2)), escapeCsvCell(total.total.toFixed(2))].join(','));
        });
        const csvString = csvRows.join('\n');
        const blob = new Blob(["\uFEFF" + csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `costos_sistemas_${format(new Date(), 'yyyy-MM-dd')}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    } else { // mejoras
        if (mejorasValidadas.length === 0) {
            toast({ title: "Nada que exportar", description: "No hay datos de mejoras para exportar.", variant: "default" });
            return;
        }
        const headers = ["Proceso Afectado", "Área", "Puesto", "Acción de Mejora", "Métrica", "Valor Anterior", "Valor Nuevo", "Ahorro Realizado", "Moneda"];
        const csvRows = [headers.join(',')];
        mejorasValidadas.forEach(m => {
            csvRows.push([
                escapeCsvCell(m.procesoNombre),
                escapeCsvCell(m.area),
                escapeCsvCell(m.puesto),
                escapeCsvCell(m.accionNombre),
                escapeCsvCell(m.metrica),
                escapeCsvCell(m.antes),
                escapeCsvCell(m.despues),
                escapeCsvCell(m.ahorro),
                escapeCsvCell(m.moneda || 'N/A'),
            ].join(','));
        });
        const csvString = csvRows.join('\n');
        const blob = new Blob(["\uFEFF" + csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `validacion_mejoras_${format(new Date(), 'yyyy-MM-dd')}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    }
  };
  
  const availableDepartamentos = useMemo(() => {
    if (isLoadingDepartamentos || selectedArea === 'all') return departamentos;
    const area = areas.find(a => a.nombre === selectedArea);
    return area ? departamentos.filter(d => d.areaId === area.id) : [];
  }, [selectedArea, areas, departamentos, isLoadingDepartamentos]);

  const availablePuestos = useMemo(() => {
      if (isLoadingPuestos) return puestos;
      let scopedPuestos = puestos;
      if (selectedArea !== 'all') {
          const area = areas.find(a => a.nombre === selectedArea);
          scopedPuestos = area ? scopedPuestos.filter(p => p.areaId === area.id) : [];
      }
      if (selectedDepartamento !== 'all') {
          const depto = departamentos.find(d => d.nombre === selectedDepartamento);
          scopedPuestos = depto ? scopedPuestos.filter(p => p.departamentoId === depto.id) : [];
      }
      return scopedPuestos;
  }, [selectedArea, selectedDepartamento, areas, departamentos, puestos, isLoadingPuestos]);


  return (
    <div className="container mx-auto py-8">
       <div className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary mb-2">Dashboard: Impacto y Mejoras</h1>
          <p className="text-muted-foreground">Mida los resultados, ahorros y costos generados por las acciones de mejora y los sistemas.</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
            <DateRangePicker date={dateRange} setDate={setDateRange} />
            <Button variant="outline" onClick={() => setIsComparing(!isComparing)} disabled={!dateRange}>
                 <CalendarRange className="mr-2 h-4 w-4" />
                 {isComparing ? "Cancelar Comparación" : "Comparar"}
            </Button>
        </div>
      </div>
      
       {isComparing && (
            <div className="mb-4 flex flex-col sm:flex-row gap-4 items-center bg-muted/50 p-3 rounded-lg border">
                <p className="text-sm font-medium">Comparar con:</p>
                <DateRangePicker date={comparisonDateRange} setDate={setComparisonDateRange} />
            </div>
        )}

       <div className="mb-6 flex flex-col sm:flex-row gap-2 items-center bg-muted/50 p-3 rounded-lg border">
        <p className="text-sm font-medium shrink-0">Filtros de Entidad:</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full">
          <Select value={selectedArea} onValueChange={v => {setSelectedArea(v); setSelectedDepartamento('all'); setSelectedPuesto('all');}}>
            <SelectTrigger><SelectValue placeholder="Todas las Áreas"/></SelectTrigger>
            <SelectContent><SelectItem value="all">Todas las Áreas</SelectItem>{areas.map(a => <SelectItem key={a.id} value={a.nombre}>{a.nombre}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={selectedDepartamento} onValueChange={v => {setSelectedDepartamento(v); setSelectedPuesto('all');}} disabled={selectedArea === 'all' || isLoadingDepartamentos}>
            <SelectTrigger><SelectValue placeholder={selectedArea === 'all' ? 'Seleccione área primero' : 'Todos los Deptos.'} /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos los Deptos.</SelectItem>{availableDepartamentos.map(d => <SelectItem key={d.id} value={d.nombre}>{d.nombre}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={selectedPuesto} onValueChange={setSelectedPuesto} disabled={isLoadingPuestos}>
            <SelectTrigger><SelectValue placeholder="Todos los Puestos" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos los Puestos</SelectItem>{availablePuestos.map(p => <SelectItem key={p.id} value={p.nombre}>{p.nombre}</SelectItem>)}</SelectContent>
          </Select>
        </div>
       </div>

       <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Ahorro Anual Realizado</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{renderMetric(dashboardMetrics.ahorroCostosRealizado, isLoadingAll, isComparing && comparisonMetrics ? getComparisonText(dashboardMetrics.totalAhorroMXN, comparisonMetrics.totalAhorroMXN) : undefined)}</div><p className="text-xs text-muted-foreground">De acciones completadas</p></CardContent>
        </Card>
        <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Ahorro de Tiempo</CardTitle><Clock className="h-4 w-4 text-muted-foreground" /></CardHeader>
            <CardContent><div className="text-2xl font-bold">{renderMetric(dashboardMetrics.ahorroTiempoRealizado, isLoadingAll)}</div><p className="text-xs text-muted-foreground">De acciones completadas</p></CardContent>
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
      
      <Card className="shadow-lg mb-8">
        <CardHeader>
           <div className="flex justify-between items-center">
              <CardTitle>Análisis Gráfico</CardTitle>
              <Select value={chartType} onValueChange={(v) => setChartType(v as ChartType)}>
                  <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                      <SelectItem value="ahorros">Ahorros por Acción</SelectItem>
                      <SelectItem value="costos">Costos de Sistemas</SelectItem>
                  </SelectContent>
              </Select>
           </div>
            <CardDescription>
              {chartType === 'costos'
                  ? 'Comparativa de costos anuales (Uso vs. Licencias) por sistema y moneda.'
                  : 'Ahorro anual estimado por cada acción de mejora completada en el período.'}
            </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingAll ? <div className="flex justify-center items-center h-full min-h-[300px]"><Loader2 className="h-8 w-8 animate-spin"/></div> :
          chartData.length > 0 ? (
            <ChartContainer config={chartConfig} className="min-h-[300px] w-full">
                <ResponsiveContainer>
                    <BarChart data={chartData} layout="vertical">
                        <CartesianGrid horizontal={false} />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tickMargin={10} width={120} />
                        <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} content={<ChartTooltipContent />} />
                        <Legend />
                        {chartType === 'costos' ? (
                          <>
                            <Bar dataKey="Costo Uso" stackId="a" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                            <Bar dataKey="Costo Licencias" stackId="a" fill="hsl(var(--chart-1))" radius={[4, 4, 4, 4]} />
                          </>
                        ) : (
                          <>
                            <Bar dataKey="Ahorro" fill="hsl(var(--chart-1))" radius={4} />
                            {isComparing && <Bar dataKey="Ahorro (Comp)" fill="hsl(var(--chart-2))" radius={4} opacity={0.6} />}
                          </>
                        )}
                    </BarChart>
                </ResponsiveContainer>
            </ChartContainer>
          ) : (
              <div className="flex items-center justify-center h-full bg-muted/30 rounded-lg min-h-[250px]">
                  <p className="text-muted-foreground">No hay datos para graficar.</p>
              </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle>Validación de Ahorros por Acción</CardTitle>
              <CardDescription className="text-xs mt-1">Detalle de las mejoras aplicadas por acciones completadas en el periodo.</CardDescription>
            </div>
            <Button variant="outline" onClick={() => handleExport('mejoras')} disabled={mejorasValidadas.length === 0}>
                <FileText className="mr-2 h-4 w-4" /> Exportar CSV
            </Button>
          </CardHeader>
          <CardContent>
            {isLoadingAll ? <div className="flex items-center justify-center p-4"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            : mejorasValidadas.length === 0 ? <p className="text-muted-foreground text-sm">No hay mejoras validadas en el periodo seleccionado.</p>
            : (
                <div className="max-h-[400px] overflow-y-auto">
                  <Table>
                      <TableHeader><TableRow>
                          <TableHead>Proceso / Contexto</TableHead>
                          <TableHead>Acción de Mejora</TableHead>
                          <TableHead>Métrica</TableHead>
                          <TableHead className="text-right">Antes</TableHead>
                          <TableHead className="text-right">Después</TableHead>
                          <TableHead className="text-right font-bold">Ahorro</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {mejorasValidadas.map(m => (
                            <TableRow key={m.id}>
                                <TableCell>
                                  <p className="font-medium">{m.procesoNombre}</p>
                                  <p className="text-xs text-muted-foreground">{m.area} / {m.puesto}</p>
                                </TableCell>
                                <TableCell className="text-xs">{m.accionNombre}</TableCell>
                                <TableCell>{m.metrica}</TableCell>
                                <TableCell className="text-right">{m.metrica === 'Tiempo (min)' ? formatMinutesToHours(Number(m.antes)) : formatDashboardCurrency(Number(m.antes), m.moneda || 'USD')}</TableCell>
                                <TableCell className="text-right">{m.metrica === 'Tiempo (min)' ? formatMinutesToHours(Number(m.despues)) : formatDashboardCurrency(Number(m.despues), m.moneda || 'USD')}</TableCell>
                                <TableCell className="text-right font-bold text-green-600">{m.metrica === 'Tiempo (min)' ? formatMinutesToHours(m.ahorro) : formatDashboardCurrency(m.ahorro, m.moneda || 'USD')}</TableCell>
                            </TableRow>
                        ))}
                      </TableBody>
                  </Table>
                </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle>Costos de Sistemas (Filtrado)</CardTitle>
              <CardDescription className="text-xs mt-1">Costos anuales de sistemas usados por procesos que cumplen los filtros.</CardDescription>
            </div>
            <Button variant="outline" onClick={() => handleExport('sistemas')} disabled={filteredSystemCosts.length === 0}>
                <FileText className="mr-2 h-4 w-4" /> Exportar CSV
            </Button>
          </CardHeader>
          <CardContent>
            {isLoadingAll ? <div className="flex items-center justify-center p-4"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            : filteredSystemCosts.length === 0 ? <p className="text-muted-foreground text-sm">No hay datos de costos para los filtros seleccionados.</p>
            : (
                <div className="max-h-[400px] overflow-y-auto">
                  <Table>
                    <TableHeader><TableRow>
                        <TableHead>Sistema</TableHead>
                        <TableHead className="text-right">Costo Anual (Uso)</TableHead>
                        <TableHead className="text-right">Costo Anual (Licencias)</TableHead>
                        <TableHead className="text-right font-bold">Costo Anual (Total)</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                        {filteredSystemCosts.map((system) => (
                        <TableRow key={system.id}>
                            <TableCell className="font-medium">
                                <TooltipProvider><UiTooltip>
                                    <TooltipTrigger asChild><span className="cursor-default">{system.name}</span></TooltipTrigger>
                                    {system.descriptions.length > 0 && (<TooltipContent><p className="font-bold">Detalle de Costos:</p><ul className="list-disc pl-4 text-left">{system.descriptions.map((d, i) => <li key={i}>{d}</li>)}</ul></TooltipContent>)}
                                </UiTooltip></TooltipProvider>
                            </TableCell>
                            <TableCell className="text-right">{formatDashboardCurrency(system.annualUsageCost, system.currency)}</TableCell>
                            <TableCell className="text-right">{formatDashboardCurrency(system.annualLicenseCost, system.currency)}</TableCell>
                            <TableCell className="text-right font-bold">{formatDashboardCurrency(system.annualUsageCost + system.annualLicenseCost, system.currency)}</TableCell>
                        </TableRow>
                        ))}
                    </TableBody>
                    {grandTotals.length > 0 && (
                      <TableFooter>
                        {grandTotals.map(total => (
                          <TableRow key={total.currency} className="font-extrabold bg-muted/50 hover:bg-muted/70">
                              <TableCell>Total ({total.currency})</TableCell>
                              <TableCell className="text-right">{formatDashboardCurrency(total.usage, total.currency)}</TableCell>
                              <TableCell className="text-right">{formatDashboardCurrency(total.license, total.currency)}</TableCell>
                              <TableCell className="text-right">{formatDashboardCurrency(total.total, total.currency)}</TableCell>
                          </TableRow>
                        ))}
                      </TableFooter>
                    )}
                  </Table>
                </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
