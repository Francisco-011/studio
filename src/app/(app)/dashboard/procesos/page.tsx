

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
      const to = dateRange.to ? endOfDay(dateRange.to) : endOfDay(new Date());
      
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
    const to = comparisonDateRange.to ? endOfDay(comparisonDateRange.to) : endOfDay(new Date());

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
          if (area) {
              scopedPuestos = scopedPuestos.filter(p => p.areaId === area.id);
          } else {
              return [];
          }
      }
      if (selectedDepartamento !== 'all') {
          const depto = departamentos.find(d => d.nombre === selectedDepartamento);
          if (depto) {
             scopedPuestos = scopedPuestos.filter(p => p.departamentoId === depto.id);
          } else {
             return [];
          }
      }
      return scopedPuestos;
  }, [selectedArea, selectedDepartamento, areas, departamentos, puestos, isLoadingPuestos]);

  const workloadAnalysis = useMemo(() => {
    if (isLoadingPuestos || isLoadingActividades) return [];
    
    const analysisByPuesto: { [key: string]: { totalMonthlyMinutes: number, totalMonthlyCost: number, puesto: any } } = {};
  
    puestos.forEach(puesto => {
      analysisByPuesto[puesto.id] = {
        totalMonthlyMinutes: 0,
        totalMonthlyCost: 0,
        puesto: puesto
      };
    });
  
    globalActividades.forEach(act => {
      if (act.puestoId && act.tiempoEstimado) {
        const puesto = analysisByPuesto[act.puestoId];
        if (puesto) {
          const monthlyMultiplier = getMonthlyMultiplier(act.frecuencia);
          const monthlyExecutions = monthlyMultiplier * (act.ejecucionesPorPeriodo || 1);
          
          puesto.totalMonthlyMinutes += (act.tiempoEstimado || 0) * monthlyExecutions;
  
          if (puesto.puesto.costoHora) {
            const costPerMinute = puesto.puesto.costoHora / 60;
            const costoActividad = act.tiempoEstimado * costPerMinute;
            puesto.totalMonthlyCost += costoActividad * monthlyExecutions;
          }
        }
      }
    });
  
    return Object.values(analysisByPuesto)
      .filter(data => data.totalMonthlyMinutes > 0)
      .map(data => {
        const estimatedMonthlySalary = (data.puesto.costoHora || 0) * (40 * 4.33); // 40 hrs/week
        const loadRatio = estimatedMonthlySalary > 0 ? (data.totalMonthlyCost / estimatedMonthlySalary) * 100 : 0;
        return {
          puestoName: data.puesto.nombre,
          totalMonthlyHours: data.totalMonthlyMinutes / 60,
          totalMonthlyCost: data.totalMonthlyCost,
          estimatedMonthlySalary: estimatedMonthlySalary,
          loadRatio: loadRatio,
          currency: data.puesto.monedaCosto || 'N/A'
        };
      })
      .sort((a, b) => b.loadRatio - a.loadRatio);
  
  }, [puestos, globalActividades, isLoadingPuestos, isLoadingActividades]);


  const handleGenerateSummary = async () => {
    if (selectedEntityType === 'none' || !selectedEntityName) {
      toast({ title: "Selección Incompleta", description: "Por favor, seleccione un tipo de entidad y un nombre.", variant: "default" });
      return;
    }
    setIsGeneratingSummary(true);
    setGeneratedSummary('');

    try {
      let processDataString = '';
      const dataForSummary = dateRange?.from ? filteredProcesses : allCapturedProcesses;

      if (selectedEntityType === 'area') {
        const processesInArea = dataForSummary.filter(p => !p.deletedAt && p.area === selectedEntityName);
        if (processesInArea.length === 0) {
            setGeneratedSummary(`No se encontraron procesos capturados para el área "${selectedEntityName}" en el periodo seleccionado.`);
            setIsGeneratingSummary(false);
            return;
        }

        const processesByDept: Record<string, CapturedProcess[]> = {};
        processesInArea.forEach(proc => {
            const deptName = proc.departamento || 'Sin Departamento Asignado';
            if (!processesByDept[deptName]) {
                processesByDept[deptName] = [];
            }
            processesByDept[deptName].push(proc);
        });

        processDataString = `El Área "${selectedEntityName}" contiene los siguientes departamentos y procesos:\n\n`;
        processDataString += Object.entries(processesByDept).map(([deptName, deptProcs]) => {
            const deptProcsString = deptProcs.map(proc => {
                const activitiesString = (proc.activityOrder || []).map(actId => globalActividades.find(a => a.id === actId)?.nombre).filter(Boolean).join(', ');
                return `  - Proceso: ${proc.proceso} (Ejecutado por Puesto: ${proc.puesto})\n    Descripción: ${proc.descripcion}\n` + (activitiesString ? `    Actividades Clave: ${activitiesString}\n` : '');
            }).join('');
            return `Departamento: ${deptName}\n${deptProcsString}`;
        }).join('\n---\n');

      } else { // Puesto o Departamento
        let relevantProcesses: CapturedProcess[];
        if (selectedEntityType === 'puesto') {
          relevantProcesses = dataForSummary.filter(p => !p.deletedAt && p.puesto === selectedEntityName);
        } else { // departamento
          relevantProcesses = dataForSummary.filter(p => !p.deletedAt && p.departamento === selectedEntityName);
        }

        if (relevantProcesses.length === 0) {
            setGeneratedSummary(`No se encontraron procesos capturados para ${selectedEntityType === 'puesto' ? 'el puesto' : 'el departamento'} "${selectedEntityName}" en el periodo seleccionado.`);
            setIsGeneratingSummary(false);
            return;
        }
        processDataString = relevantProcesses.map(proc => {
            const activitiesString = (proc.activityOrder || []).map(actId => globalActividades.find(a => a.id === actId)?.nombre).filter(Boolean).join(', ');
            let context = selectedEntityType === 'departamento' ? ` (Ejecutado por Puesto: ${proc.puesto})` : '';
            return `Proceso: ${proc.proceso}${context}\nDescripción: ${proc.descripcion}\n` + (activitiesString ? `Actividades Clave: ${activitiesString}\n` : '');
        }).join('\n---\n');
      }

      const result: SummarizeEntityOutput = await summarizeEntity({
        entityType: selectedEntityType,
        entityName: selectedEntityName,
        processData: processDataString,
      });
      setGeneratedSummary(result.summary);

    } catch (error) {
      console.error("Error generating summary:", error);
      toast({ title: "Error al generar resumen", variant: "destructive" });
      setGeneratedSummary("Error al generar el resumen. Intente nuevamente.");
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const isLoadingAll = isLoadingData || isLoadingActividades || isLoadingAreas || isLoadingPuestos || isLoadingDepartamentos || isLoadingProcedimientos;

  const topCostlyProcedures = useMemo(() => {
    if (isLoadingAll) return [];
    return procedimientos
      .filter(p => p.activo && p.costoEstimado && p.costoEstimado > 0)
      .sort((a,b) => (b.costoEstimado || 0) - (a.costoEstimado || 0))
      .slice(0, 5)
      .map(p => ({
        ...p,
        procesoPadre: allCapturedProcesses.find(proc => proc.id === p.procesoId)?.proceso || 'N/A'
      }));
  }, [procedimientos, allCapturedProcesses, isLoadingAll]);

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

            const duplicadasPorArea = new Map<string, Set<string>>();
            allCapturedProcesses.forEach(proc => {
                if (proc.procedimientoOrder) {
                   // This is getting complex, will simplify the metric for now
                }
            })

            data = []; // Placeholder
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


  return (
    <div className="container mx-auto py-8">
      <div className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary mb-2">Dashboard: Procesos y Eficiencia</h1>
          <p className="text-muted-foreground">Analice la salud, estructura y eficiencia de sus procesos operativos y personal.</p>
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
            <SelectTrigger><SelectValue/></SelectTrigger>
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

       <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">
         <Card className="shadow-lg lg:col-span-3">
          <CardHeader>
            <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <CardTitle>Análisis de Carga de Trabajo por Puesto</CardTitle>
            </div>
            <CardDescription className="pt-2">Análisis del costo operativo mensual de las actividades de cada puesto, comparado con un sueldo base estimado.</CardDescription>
          </CardHeader>
          <CardContent>
             {isLoadingAll ? (<div className="flex items-center justify-center p-4"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>) : 
             workloadAnalysis.length === 0 ? (<p className="text-muted-foreground text-sm">No hay datos de carga de trabajo para mostrar.</p>) : (
                <div className="max-h-[400px] overflow-y-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Puesto</TableHead>
                                <TableHead className="text-right">Horas/Mes (Actividades)</TableHead>
                                <TableHead className="text-right">Costo Operativo Mensual</TableHead>
                                <TableHead className="text-right">Sueldo Mensual Estimado</TableHead>
                                <TableHead className="text-right">% de Carga vs Sueldo</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {workloadAnalysis.map(item => (
                                <TableRow key={item.puestoName}>
                                    <TableCell className="font-medium">{item.puestoName}</TableCell>
                                    <TableCell className="text-right">{item.totalMonthlyHours.toFixed(1)} hrs</TableCell>
                                    <TableCell className="text-right">{formatDashboardCurrency(item.totalMonthlyCost, item.currency)}</TableCell>
                                    <TableCell className="text-right text-muted-foreground">{formatDashboardCurrency(item.estimatedMonthlySalary, item.currency)}</TableCell>
                                    <TableCell className="text-right font-bold">
                                        <div className="flex items-center justify-end gap-2">
                                           {item.loadRatio > 90 && <AlertTriangle className="h-4 w-4 text-destructive" title="Carga económica alta en comparación al sueldo."/>}
                                           <span className={item.loadRatio > 90 ? 'text-destructive' : ''}>{item.loadRatio.toFixed(0)}%</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
          </CardContent>
        </Card>
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
                              <SelectItem value="personal">Procesos por Área</SelectItem>
                              <SelectItem value="procesos">Procesos por Área</SelectItem>
                              <SelectItem value="variaciones">Variaciones por Área</SelectItem>
                              <SelectItem value="sinActividades">Procesos sin Flujo</SelectItem>
                              <SelectItem value="actividadesDuplicadas">Actividades Duplicadas</SelectItem>
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
            <Card>
                <CardHeader>
                    <CardTitle>Top 5 Procedimientos Más Costosos (Mensual)</CardTitle>
                    <CardDescription>Basado en cálculos de actividad y costos de puesto.</CardDescription>
                </CardHeader>
                <CardContent>
                {isLoadingAll ? <div className="flex items-center justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> :
                    topCostlyProcedures.length > 0 ? (
                    <Table>
                        <TableHeader><TableRow><TableHead>Procedimiento</TableHead><TableHead className="text-right">Costo Est.</TableHead></TableRow></TableHeader>
                        <TableBody>
                        {topCostlyProcedures.map(p => (
                            <TableRow key={p.id}>
                            <TableCell>
                                <p className="font-medium">{p.nombre}</p>
                                <p className="text-xs text-muted-foreground">{p.procesoPadre}</p>
                            </TableCell>
                            <TableCell className="text-right font-semibold">{formatDashboardCurrency(p.costoEstimado || 0, p.monedaCosto || 'USD')}</TableCell>
                            </TableRow>
                        ))}
                        </TableBody>
                    </Table>
                    ) : (
                    <p className="text-muted-foreground text-sm text-center py-4">No hay datos de costos para mostrar. Recalcule los totales en los módulos de Procedimientos y Procesos.</p>
                    )}
                </CardContent>
            </Card>
        </div>
       </div>

      <Card className="shadow-lg">
        <CardHeader><div className="flex items-center gap-2"><Brain className="h-6 w-6 text-primary" /><CardTitle>Análisis de Entidad por IA</CardTitle></div><CardDescription>Seleccione una área, departamento o puesto para obtener un resumen de sus funciones basado en los procesos del periodo seleccionado.</CardDescription></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 items-end">
              <div><Label htmlFor="entityTypeSelect" className="text-sm font-medium">Tipo</Label><Select value={selectedEntityType} onValueChange={(v: 'area'|'puesto'|'departamento'|'none') => { setSelectedEntityType(v); setSelectedEntityName(''); setGeneratedSummary(''); }}><SelectTrigger id="entityTypeSelect"><SelectValue placeholder="Seleccione..." /></SelectTrigger><SelectContent><SelectItem value="none" disabled>Seleccione tipo...</SelectItem><SelectItem value="area"><Factory className="inline-block h-4 w-4 mr-2" />Área</SelectItem><SelectItem value="departamento"><Users className="inline-block h-4 w-4 mr-2" />Departamento</SelectItem><SelectItem value="puesto"><Users className="inline-block h-4 w-4 mr-2" />Puesto</SelectItem></SelectContent></Select></div>
              <div className="md:col-span-2"><Label htmlFor="entityNameSelect" className="text-sm font-medium">Nombre</Label><Select value={selectedEntityName} onValueChange={setSelectedEntityName} disabled={selectedEntityType === 'none' || isLoadingAll || entityList.length === 0}><SelectTrigger id="entityNameSelect"><SelectValue placeholder={selectedEntityType === 'none' ? "Seleccione tipo" : "Seleccione nombre..."} /></SelectTrigger><SelectContent>{entityList.map(e => (<SelectItem key={e.id} value={e.name}>{e.name}</SelectItem>))}</SelectContent></Select></div>
          </div>
          <Button onClick={handleGenerateSummary} disabled={isGeneratingSummary || selectedEntityType === 'none' || !selectedEntityName} className="w-full mb-4">{isGeneratingSummary ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Brain className="mr-2 h-4 w-4" />}Generar Resumen</Button>
          {isGeneratingSummary && (<div className="flex items-center justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-primary" /><p className="ml-2">Generando...</p></div>)}
          {generatedSummary && !isGeneratingSummary && (
              <div><h4 className="font-semibold mb-2">Resumen Generado:</h4><Textarea value={generatedSummary} readOnly className="min-h-[150px] bg-muted/50" rows={8}/></div>
          )}
        </CardContent>
       </Card>
    </div>
  );
}
