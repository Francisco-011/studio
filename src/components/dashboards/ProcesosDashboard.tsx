
'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Layers, CopyCheck, PackageX, Brain, Factory, FileText, CalendarRange, Users, AlertTriangle } from "lucide-react";
import { PieChart, Pie, Cell, Legend, Tooltip } from 'recharts';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { useProcesos, type CapturedProcess } from '@/contexts/ProcesosContext';
import { useActividades, type Actividad } from '@/contexts/ActividadesContext';
import { useAreas } from '@/contexts/AreasContext';
import { useDepartamentos } from '@/contexts/DepartamentosContext';
import { usePuestos } from '@/contexts/PuestosContext';
import { useProcedimientos, type Procedimiento } from '@/contexts/ProcedimientosContext';
import { summarizeEntity, type SummarizeEntityOutput } from '@/ai/flows/summarize-entity-flow';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DateRange } from "react-day-picker";
import { format, parseISO, isValid, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';
import { formatMinutesToHours } from '@/lib/utils';


const renderMetric = (value: number | string, loading: boolean, comparisonValue?: string) => {
  if (loading) {
    return <Loader2 className={`h-5 w-5 animate-spin`} />;
  }
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

const getComparisonText = (current: number, previous: number): string => {
    if (previous === 0) {
        return current > 0 ? "+∞% vs periodo anterior" : "Sin cambios vs periodo anterior";
    }
    const diff = ((current - previous) / previous) * 100;
    if (diff > 0) return `+${diff.toFixed(0)}% vs periodo anterior`;
    if (diff < 0) return `${diff.toFixed(0)}% vs periodo anterior`;
    return "Sin cambios vs periodo anterior";
}

const formatDashboardCurrency = (amount: number, currency: string) => {
  if (currency === 'N/A' || !currency) return amount.toLocaleString('es-MX');
  try {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: currency, currencyDisplay: 'code', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
  } catch (e) {
    return `${amount.toFixed(0)} ${currency}`;
  }
}

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
        case 'A demanda': return 1; // Default assumption for 'on demand'
        default: return 0;
    }
}


export default function ProcesosDashboardPage() {
  const { procesos: allCapturedProcesses, isLoadingProcesos } = useProcesos();
  const [isLoadingData, setIsLoadingData] = useState(true);

  const { actividades: globalActividades, isLoadingActividades } = useActividades();
  const { areas, isLoading: isLoadingAreas } = useAreas();
  const { departamentos, isLoading: isLoadingDepartamentos } = useDepartamentos();
  const { puestos, isLoadingPuestos } = usePuestos();
  const { procedimientos, isLoadingProcedimientos } = useProcedimientos();
  
  const [selectedEntityType, setSelectedEntityType] = useState<'area' | 'puesto' | 'departamento' | 'none'>('none');
  const [selectedEntityName, setSelectedEntityName] = useState<string>('');
  const [generatedSummary, setGeneratedSummary] = useState<string>('');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState<boolean>(false);
  const [entityList, setEntityList] = useState<{id: string, name: string}[]>([]);
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [isComparing, setIsComparing] = useState(false);
  const [comparisonDateRange, setComparisonDateRange] = useState<DateRange | undefined>(undefined);
  const [chartDataType, setChartDataType] = useState<'personal' | 'procesos' | 'variaciones' | 'sinActividades' | 'actividadesDuplicadas'>('personal');
  
  const [selectedArea, setSelectedArea] = useState<string>('all');
  const [selectedDepartamento, setSelectedDepartamento] = useState<string>('all');
  const [selectedPuesto, setSelectedPuesto] = useState<string>('all');

   useEffect(() => {
    setIsLoadingData(isLoadingProcesos);
  }, [isLoadingProcesos]);

  const filteredProcesses = useMemo(() => {
    let processes = allCapturedProcesses;

    if (dateRange?.from) {
      const from = startOfDay(dateRange.from);
      const to = dateRange.to ? endOfDay(dateRange.to) : new Date();
      
      processes = processes.filter(proc => {
          const procDate = parseISO(proc.capturedAt);
          return isValid(procDate) && procDate >= from && procDate <= to;
      });
    }

    if (selectedArea !== 'all') {
      processes = processes.filter(p => p.area === selectedArea);
    }
    if (selectedDepartamento !== 'all') {
      processes = processes.filter(p => p.departamento === selectedDepartamento);
    }
    if (selectedPuesto !== 'all') {
      processes = processes.filter(p => p.puesto === selectedPuesto);
    }
    return processes;

  }, [allCapturedProcesses, dateRange, selectedArea, selectedDepartamento, selectedPuesto]);

  const comparisonProcesses = useMemo(() => {
    if (!isComparing || !comparisonDateRange?.from) return [];
    
    const from = startOfDay(comparisonDateRange.from);
    const to = comparisonDateRange.to ? endOfDay(comparisonDateRange.to) : new Date();

    let processes = allCapturedProcesses.filter(proc => {
        const procDate = parseISO(proc.capturedAt);
        return isValid(procDate) && procDate >= from && procDate <= to;
    });

    if (selectedArea !== 'all') {
      processes = processes.filter(p => p.area === selectedArea);
    }
    if (selectedDepartamento !== 'all') {
      processes = processes.filter(p => p.departamento === selectedDepartamento);
    }
    if (selectedPuesto !== 'all') {
      processes = processes.filter(p => p.puesto === selectedPuesto);
    }

    return processes;
  }, [allCapturedProcesses, comparisonDateRange, isComparing, selectedArea, selectedDepartamento, selectedPuesto]);

  useEffect(() => {
    if (selectedEntityType === 'area' && !isLoadingAreas) {
      setEntityList(areas.map(a => ({ id: a.id, name: a.nombre })).sort((a,b) => a.name.localeCompare(b.name)));
      setSelectedEntityName('');
    } else if (selectedEntityType === 'puesto' && !isLoadingPuestos) {
      setEntityList(puestos.map(p => ({ id: p.id, name: p.nombre })).sort((a,b) => a.name.localeCompare(b.name)));
      setSelectedEntityName('');
    } else if (selectedEntityType === 'departamento' && !isLoadingDepartamentos) {
      setEntityList(departamentos.map(d => ({ id: d.id, name: d.nombre })).sort((a,b) => a.name.localeCompare(b.name)));
      setSelectedEntityName('');
    } else {
      setEntityList([]);
      setSelectedEntityName('');
    }
  }, [selectedEntityType, areas, puestos, departamentos, isLoadingAreas, isLoadingPuestos, isLoadingDepartamentos]);

  const processMetrics = (processesToAnalyze: CapturedProcess[]) => {
      if (isLoadingData || isLoadingActividades) {
        return {
          procesosMapeadosCount: 0,
          procesosConVariacionesCount: 0,
          actividadesDuplicadasCount: 0,
          procesosSinActividadesCount: 0,
        };
      }
      const processes = processesToAnalyze.filter(p => p.activo !== false && !p.deletedAt);
      const activeActivities = globalActividades.filter(a => a.activa);

      const processContexts = new Map<string, Set<string>>();
      processes.forEach(proc => {
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
      
      const activityNameToProcedures = new Map<string, Set<string>>();
      activeActivities.forEach(act => {
          if (act.procedimientoId) {
            if (!activityNameToProcedures.has(act.nombre)) {
                activityNameToProcedures.set(act.nombre, new Set());
            }
            activityNameToProcedures.get(act.nombre)!.add(act.procedimientoId);
          }
      });

      let actividadesDuplicadasCount = 0;
      activityNameToProcedures.forEach(procedures => {
        if(procedures.size > 1) {
          actividadesDuplicadasCount++;
        }
      })
      
      return {
        procesosMapeadosCount: processes.length,
        actividadesDuplicadasCount,
        procesosSinActividadesCount: processes.filter(proc => !proc.procedimientoOrder || proc.procedimientoOrder.length === 0).length,
        procesosConVariacionesCount,
      };
  }

  const dashboardMetrics = useMemo(() => processMetrics(filteredProcesses), [filteredProcesses, globalActividades, isLoadingData, isLoadingActividades]);
  const comparisonMetrics = useMemo(() => {
      if (!isComparing) return null;
      return processMetrics(comparisonProcesses);
  }, [comparisonProcesses, isComparing, globalActividades, isLoadingData, isLoadingActividades]);

  const { chartData, chartConfig, chartDescription } = useMemo(() => {
    if (isLoadingAll) {
      return { chartData: [], chartConfig: {}, chartDescription: '' };
    }

    let data;
    let description = '';

    switch (chartDataType) {
        case 'procesos':
            description = 'Distribución del número total de procesos mapeados en cada área.';
            const procesosPorArea = new Map<string, number>();
            filteredProcesses.forEach(proc => {
                if(proc.area) {
                    procesosPorArea.set(proc.area, (procesosPorArea.get(proc.area) || 0) + 1);
                }
            });
            data = Array.from(procesosPorArea.entries()).map(([name, value]) => ({ name, value }));
            break;

        case 'variaciones':
            description = 'Número de procesos en cada área que tienen el mismo nombre que procesos en otras áreas/puestos.';
            const processContexts = new Map<string, Set<string>>();
            filteredProcesses.forEach(proc => {
                if (!processContexts.has(proc.proceso)) {
                    processContexts.set(proc.proceso, new Set());
                }
                processContexts.get(proc.proceso)!.add(`${proc.area}|${proc.puesto}`);
            });
            const variationNames = new Set<string>();
            processContexts.forEach((contexts, processName) => {
                if (contexts.size > 1) {
                    variationNames.add(processName);
                }
            });
            const variacionesPorArea = new Map<string, number>();
            filteredProcesses.forEach(proc => {
                if (proc.area && variationNames.has(proc.proceso)) {
                    variacionesPorArea.set(proc.area, (variacionesPorArea.get(proc.area) || 0) + 1);
                }
            });
            data = Array.from(variacionesPorArea.entries()).map(([name, value]) => ({ name, value }));
            break;

        case 'sinActividades':
            description = 'Número de procesos en cada área que no tienen procedimientos o actividades definidas.';
            const sinActividadesPorArea = new Map<string, number>();
            filteredProcesses.forEach(proc => {
                if (proc.area && (!proc.procedimientoOrder || proc.procedimientoOrder.length === 0)) {
                    sinActividadesPorArea.set(proc.area, (sinActividadesPorArea.get(proc.area) || 0) + 1);
                }
            });
            data = Array.from(sinActividadesPorArea.entries()).map(([name, value]) => ({ name, value }));
            break;
        
        case 'actividadesDuplicadas':
            description = 'Distribución de actividades con el mismo nombre en diferentes procedimientos, por área.';
            const activityCountByName = new Map<string, number>();
            globalActividades.forEach(act => {
                activityCountByName.set(act.nombre, (activityCountByName.get(act.nombre) || 0) + 1);
            });
            
            const duplicatedActivityNames = new Set<string>();
            activityCountByName.forEach((count, name) => {
                if (count > 1) {
                    duplicatedActivityNames.add(name);
                }
            });
            data = [];
            break;

        case 'personal':
        default:
            description = 'Distribución del número total de procesos por área.';
            const countByArea = filteredProcesses.reduce((acc, proc) => {
              if (proc.area) {
                acc[proc.area] = (acc[proc.area] || 0) + 1;
              }
              return acc;
            }, {} as Record<string, number>);
            data = Object.entries(countByArea).map(([name, value]) => ({name, value}));
            break;
    }

    const coloredData = data.sort((a,b) => b.value - a.value).map((entry, index) => ({
      ...entry,
      fill: `hsl(var(--chart-${(index % 12) + 1}))`
    }));

    const config = coloredData.reduce((acc, entry) => {
        acc[entry.name] = {
            label: entry.name,
            color: entry.fill
        };
        return acc;
    }, {} as ChartConfig);

    return { chartData: coloredData, chartConfig: config, chartDescription: description };

  }, [chartDataType, filteredProcesses, isLoadingAll, globalActividades, allCapturedProcesses]);
  
  const isLoadingAll = isLoadingData || isLoadingActividades || isLoadingAreas || isLoadingPuestos || isLoadingProcedimientos;

  return (
    <div className="container mx-auto py-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Procesos Mapeados</CardTitle><Factory className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{renderMetric(dashboardMetrics.procesosMapeadosCount, isLoadingAll, isComparing && comparisonMetrics ? getComparisonText(dashboardMetrics.procesosMapeadosCount, comparisonMetrics.procesosMapeadosCount) : undefined)}</div><p className="text-xs text-muted-foreground">{dateRange?.from ? 'En el periodo seleccionado' : 'Acumulado Total'}</p></CardContent>
        </Card>
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Procesos con Variaciones</CardTitle><Layers className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{renderMetric(dashboardMetrics.procesosConVariacionesCount, isLoadingAll, isComparing && comparisonMetrics ? getComparisonText(dashboardMetrics.procesosConVariacionesCount, comparisonMetrics.procesosConVariacionesCount) : undefined)}</div><p className="text-xs text-muted-foreground">Mismo nombre, diferente área/puesto</p></CardContent>
        </Card>
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Actividades Duplicadas</CardTitle><CopyCheck className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{renderMetric(dashboardMetrics.actividadesDuplicadasCount, isLoadingAll, isComparing && comparisonMetrics ? getComparisonText(dashboardMetrics.actividadesDuplicadasCount, comparisonMetrics.actividadesDuplicadasCount) : undefined)}</div><p className="text-xs text-muted-foreground">Actividades con nombres idénticos</p></CardContent>
        </Card>
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Procesos sin Flujo</CardTitle><PackageX className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{renderMetric(dashboardMetrics.procesosSinActividadesCount, isLoadingAll, isComparing && comparisonMetrics ? getComparisonText(dashboardMetrics.procesosSinActividadesCount, comparisonMetrics.procesosSinActividadesCount) : undefined)}</div><p className="text-xs text-muted-foreground">Procesos sin procedimientos/actividades</p></CardContent>
        </Card>
      </div>

       <div className="grid grid-cols-1 gap-6 mb-8">
        <div className="lg:col-span-2 flex flex-col gap-6">
            <Card className="shadow-lg">
                <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle>Análisis Gráfico</CardTitle>
                       <Select value={chartDataType} onValueChange={(v) => setChartDataType(v as any)}>
                          <SelectTrigger className="w-[220px] h-8 text-xs">
                              <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                              <SelectItem value="procesos">Procesos por Área</SelectItem>
                              <SelectItem value="variaciones">Variaciones por Área</SelectItem>
                              <SelectItem value="sinActividades">Procesos sin Flujo</SelectItem>
                          </SelectContent>
                      </Select>
                    </div>
                    <CardDescription>{chartDescription}</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-center">
                    {isLoadingAll ? <div className="h-[200px] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin"/></div> :
                     chartData.length > 0 ? (
                        <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
                            <PieChart>
                                <Tooltip content={<ChartTooltipContent hideLabel />} />
                                <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                                    {chartData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.fill} />))}
                                </Pie>
                                <Legend />
                            </PieChart>
                        </ChartContainer>
                     ) : <p className="text-muted-foreground text-sm h-[200px] flex items-center">No hay datos para graficar.</p>}
                </CardContent>
            </Card>
        </div>
       </div>
    </div>
  );
}
