

'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, CheckCircle2, TrendingUp, Activity as ActivityIcon, FileSearch2, Clock, Loader2, FileText, CalendarRange } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
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
      name: system.name || '',
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
  const { sistemas, costosSistemas, isLoadingSistemasCostos } = useSistemasCostos();
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

  const [selectedArea, setSelectedArea] = useState<string>('all');
  const [selectedDepartamento, setSelectedDepartamento] = useState<string>('all');
  const [selectedPuesto, setSelectedPuesto] = useState<string>('all');

  useEffect(() => {
    setIsLoadingData(isLoadingSistemasCostos || isLoadingAcciones || isLoadingAreas || isLoadingDepartamentos || isLoadingPuestos || isLoadingProcesos);
  }, [isLoadingSistemasCostos, isLoadingAcciones, isLoadingAreas, isLoadingDepartamentos, isLoadingPuestos, isLoadingProcesos]);
  
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
    let totalMinutesSaved = 0;

    completedActions.forEach(accion => {
      // Cost savings
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

      // Time savings
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

  const filteredSystemCosts = useMemo(() => {
      if (isLoadingSistemasCostos || isLoadingAll) return [];
      
      let processesToConsider = allCapturedProcesses.filter(p => p.activo !== false && !p.deletedAt);
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
      const systemsToCalculate = sistemas.filter(s => s.nombre && systemNamesInScope.has(s.nombre));
      
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
      ).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
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
      if (isLoadingAcciones || isLoadingData) return [];
      const mejoras: ValidatedImprovement[] = [];
      filteredAcciones
          .filter(a => a.estado === 'Completada' && a.historialDeCambios && a.historialDeCambios.length > 0)
          .forEach(accion => {
              accion.historialDeCambios?.forEach((cambio, index) => {
                  if (cambio.field.includes('Tiempo') || cambio.field.includes('Costo')) {
                      const procesoAfectado = allCapturedProcesses.find(p => p.id === accion.procesoId);
                      if (procesoAfectado) {
                          mejoras.push({
                              id: `${accion.id}-${cambio.field}-${index}`,
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
  }, [filteredAcciones, allCapturedProcesses, isLoadingAcciones, isLoadingData]);
  
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

  const costosChartData = useMemo(() => {
      return filteredSystemCosts
          .filter(sys => sys.currency !== 'N/A')
          .map(sys => ({
              name: `${sys.name} (${sys.currency})`.replaceAll(/[\W_]+/g, "_"),
              displayName: `${sys.name} (${sys.currency})`,
              costoUso: sys.annualUsageCost,
              costoLicencias: sys.annualLicenseCost,
          }));
  }, [filteredSystemCosts]);

  const costosChartConfig: ChartConfig = {
      costoUso: { label: 'Costo por Uso', color: 'hsl(var(--chart-1))' },
      costoLicencias: { label: 'Costo por Licencias', color: 'hsl(var(--chart-2))' },
  };

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
            <SelectTrigger><SelectValue /></SelectTrigger>
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
      
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6">
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
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Análisis de Costos de Sistemas</CardTitle>
              <Button variant="outline" onClick={() => handleExport('sistemas')} disabled={filteredSystemCosts.length === 0}>
                <FileText className="mr-2 h-4 w-4" /> Exportar CSV
              </Button>
            </div>
            <CardDescription className="text-xs mt-1">Costos anuales de sistemas usados por procesos que cumplen los filtros.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingAll ? <div className="flex items-center justify-center p-4"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> :
              <>
                <div className="min-h-[250px] mb-4">
                  {costosChartData.length > 0 ? (
                    <ChartContainer config={costosChartConfig} className="min-h-[250px] w-full">
                       <BarChart data={costosChartData} layout="vertical">
                          <CartesianGrid horizontal={false} />
                          <XAxis type="number" hide />
                          <YAxis dataKey="displayName" type="category" tickLine={false} axisLine={false} tickMargin={10} width={120} />
                          <Tooltip
                              cursor={{ fill: "hsl(var(--muted))" }}
                              content={<ChartTooltipContent 
                                formatter={(value, name, item) => {
                                    const currency = item.payload.displayName.match(/\(([^)]+)\)/)?.[1] || 'N/A';
                                    return (
                                        <div className="flex w-full justify-between items-center">
                                            <span>{costosChartConfig[name as keyof typeof costosChartConfig]?.label || name}</span>
                                            <span className="ml-4 font-mono font-medium tabular-nums text-foreground">
                                                {formatDashboardCurrency(value as number, currency)}
                                            </span>
                                        </div>
                                    );
                                }}
                                labelFormatter={(label) => {
                                    const originalItem = costosChartData.find(d => d.name === label);
                                    return originalItem ? originalItem.displayName : label;
                                }}
                              />}
                          />
                          <Legend />
                          <Bar dataKey="costoUso" stackId="a" fill="var(--color-costoUso)" radius={[0, 4, 4, 0]} />
                          <Bar dataKey="costoLicencias" stackId="a" fill="var(--color-costoLicencias)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ChartContainer>
                  ) : <div className="flex items-center justify-center min-h-[250px]"><p className="text-muted-foreground text-sm">No hay datos de costos para graficar.</p></div>}
                </div>
                <div className="max-h-[200px] overflow-y-auto">
                  <Table>
                    <TableHeader><TableRow>
                        <TableHead>Sistema</TableHead>
                        <TableHead className="text-right">Costo Anual (Uso)</TableHead>
                        <TableHead className="text-right">Costo Anual (Licencias)</TableHead>
                        <TableHead className="text-right font-bold">Total</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                        {filteredSystemCosts.map((system) => (
                        <TableRow key={system.id}>
                            <TableCell className="font-medium">
                                <TooltipProvider><UiTooltip>
                                    <TooltipTrigger asChild><span className="cursor-default">{system.name}</span></TooltipTrigger>
                                    {system.descriptions.length > 0 && (<TooltipContent><p className="font-bold">Detalle:</p><ul className="list-disc pl-4 text-left">{system.descriptions.map((d, i) => <li key={i}>{d}</li>)}</ul></TooltipContent>)}
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
              </>
            }
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
