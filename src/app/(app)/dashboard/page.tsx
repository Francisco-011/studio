
'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Factory, DollarSign, ListChecks, PackageX, Loader2, Layers, CopyCheck, CheckCircle2, TrendingUp, FileSearch2, Activity as ActivityIcon, CalendarIcon as CalendarIconLucide, Brain, AreaChart, UserSquare2, Filter as FilterIcon, Download, Settings2, Users } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";


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
  systemsToCalculate: Sistema[],
  allCostos: SistemaCosto[]
): CalculatedSystemCost[] {
  if (!systemsToCalculate || !allCostos) return [];

  return systemsToCalculate.map(system => {
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
  accionesEnProgreso: number;
  accionesEnRevision: number;
  actividadesCreadas: number;
  procesosSinActividades: number;
  actividadesActivas: number;
  actividadesDuplicadas: number;
  procesosConVariaciones: number;
}

type ChartMetricKey = keyof Omit<MonthlyEvolutionData, 'month'>;

const baseChartConfig = {
  procesosMapeados: { label: "Procesos Mapeados", color: "hsl(var(--chart-1))" },
  accionesCompletadas: { label: "Acciones Completadas", color: "hsl(var(--chart-2))" },
  accionesEnProgreso: { label: "Acc. en Progreso", color: "hsl(var(--chart-3))" },
  accionesEnRevision: { label: "Acc. en Revisión", color: "hsl(var(--chart-4))" },
  actividadesCreadas: { label: "Activ. Creadas", color: "hsl(var(--chart-5))" },
  procesosSinActividades: { label: "Proc. Sin Activ.", color: "hsl(var(--chart-6))" },
  actividadesActivas: { label: "Activ. Activas Creadas", color: "hsl(var(--chart-7))" },
  actividadesDuplicadas: { label: "Activ. Duplic. Creadas", color: "hsl(var(--chart-8))" },
  procesosConVariaciones: { label: "Nuevos Proc. c/Variación", color: "hsl(var(--chart-9))" },
} satisfies ChartConfig;


const escapeCsvCell = (cellData: string | number | undefined | null): string => {
  if (cellData === undefined || cellData === null) {
    return '';
  }
  const stringValue = String(cellData);
  const escapedString = stringValue.replace(/"/g, '""');
  if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
    return `"${escapedString}"`;
  }
  return escapedString;
};


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
  const [selectedChartMetrics, setSelectedChartMetrics] = useState<ChartMetricKey[]>(['procesosMapeados', 'accionesCompletadas']);

  const [dashboardDateRange, setDashboardDateRange] = useState<{ from?: Date; to?: Date }>({
    from: startOfMonth(subMonths(new Date(), 5)),
    to: endOfMonth(new Date()),
  });
  const [selectedArea, setSelectedArea] = useState<string>('all');
  const [selectedPuesto, setSelectedPuesto] = useState<string>('all');
  const [availablePuestosForFilter, setAvailablePuestosForFilter] = useState<PuestoType[]>([]);


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
        setAllCapturedProcesses(parsedProcesses);
      }
    } catch (error) {
      console.error("Error loading process data from localStorage:", error);
    } finally {
      setIsLoadingProcessData(false);
    }
  }, []);

  useEffect(() => {
    if (isLoadingPuestos) {
      setAvailablePuestosForFilter([]);
      return;
    }
    if (selectedArea === 'all') {
      setAvailablePuestosForFilter(puestos.sort((a, b) => a.nombre.localeCompare(b.nombre)));
    } else {
      const areaObj = areas.find(a => a.nombre === selectedArea);
      if (areaObj) {
        const filtered = puestos.filter(p => p.areaId === areaObj.id).sort((a,b) => a.nombre.localeCompare(b.nombre));
        setAvailablePuestosForFilter(filtered);
        if (selectedPuesto !== 'all' && !filtered.some(p => p.nombre === selectedPuesto)) {
          setSelectedPuesto('all');
        }
      } else {
        setAvailablePuestosForFilter(puestos.sort((a, b) => a.nombre.localeCompare(b.nombre)));
      }
    }
  }, [selectedArea, puestos, areas, isLoadingPuestos, selectedPuesto]);

  useEffect(() => {
    if (isLoadingPuestos || isLoadingAreas || selectedPuesto === 'all') return;

    const puestoObj = puestos.find(p => p.nombre === selectedPuesto);
    if (puestoObj && puestoObj.areaId) {
      const areaObj = areas.find(a => a.id === puestoObj.areaId);
      if (areaObj && areaObj.nombre !== selectedArea) {
        setSelectedArea(areaObj.nombre);
      }
    }
  }, [selectedPuesto, puestos, areas, isLoadingPuestos, isLoadingAreas, selectedArea]);


  useEffect(() => {
    if (!isLoadingSistemasCostos && !isLoadingAreas && !isLoadingPuestos && sistemas && costosSistemas && areas && puestos) {
        let systemsToDisplay: Sistema[] = [];
        const selectedAreaObject = selectedArea !== 'all' ? areas.find(a => a.nombre === selectedArea) : null;
        const selectedPuestoObject = selectedPuesto !== 'all' ? puestos.find(p => p.nombre === selectedPuesto) : null;

        if (selectedPuestoObject) { // Filter by specific Puesto
             systemsToDisplay = sistemas.filter(system =>
                system.scope === "Puesto" && system.scopeId === selectedPuestoObject.id
            );
        } else if (selectedAreaObject) { // Filter by specific Area (and Puesto is 'all')
            const puestosInSelectedAreaIds = puestos
                .filter(p => p.areaId === selectedAreaObject.id)
                .map(p => p.id);

            systemsToDisplay = sistemas.filter(system =>
                (system.scope === "Área" && system.scopeId === selectedAreaObject.id) ||
                (system.scope === "Puesto" && system.scopeId && puestosInSelectedAreaIds.includes(system.scopeId))
            );
        } else { // Both Area and Puesto are 'all'
            systemsToDisplay = [...sistemas]; // Show all systems
        }

        setCalculatedSystemCosts(calculateAllSystemAnnualCosts(systemsToDisplay, costosSistemas));
    }
  }, [
    sistemas,
    costosSistemas,
    isLoadingSistemasCostos,
    selectedArea,
    selectedPuesto,
    areas,
    puestos,
    isLoadingAreas,
    isLoadingPuestos
  ]);

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
    if (!dashboardDateRange.from || !dashboardDateRange.to) return globalAcciones;

    const rangeStart = dashboardDateRange.from;
    const rangeEnd = dashboardDateRange.to;

    let actionsToFilter = globalAcciones;

    return actionsToFilter.filter(accion => {
        if (accion.estado === 'Completada' && accion.fechaFinalizacion) {
            const finalizacionDate = parseISO(accion.fechaFinalizacion);
            return isValid(finalizacionDate) && isWithinInterval(finalizacionDate, { start: rangeStart, end: rangeEnd });
        }
        if ( (accion.estado === 'En Progreso' || accion.estado === 'En Revisión' || accion.estado === 'Pendiente') && accion.fechaCreacion ) {
             const creacionDate = parseISO(accion.fechaCreacion);
             return isValid(creacionDate) && isWithinInterval(creacionDate, { start: rangeStart, end: rangeEnd });
        }
        if (accion.fechaCreacion) {
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
    if (!isLoadingProcessData && !isLoadingAcciones && !isLoadingActividades && dashboardDateRange.from && dashboardDateRange.to) {
      const monthlyData: MonthlyEvolutionData[] = [];
      const monthsInInterval = eachMonthOfInterval({
        start: dashboardDateRange.from,
        end: dashboardDateRange.to,
      });

      // Use base data filtered by Area/Puesto for chart consistency across months
      const baseProcessesForChart = processesFilteredByAreaPuesto;
      const baseActionsForChart = globalAcciones.filter(accion => {
         // Apply area/puesto filtering if needed here - for now, actions are global in chart
         return true;
      });
      const baseActivitiesForChart = globalActividades.filter(actividad => {
        const relevantProcessIdsForChart = new Set(baseProcessesForChart.map(p => p.id));
        if (selectedArea !== 'all' || selectedPuesto !== 'all') {
            if (!actividad.procesosAsociadosIds || actividad.procesosAsociadosIds.length === 0) return false;
            return actividad.procesosAsociadosIds.some(procId => relevantProcessIdsForChart.has(procId));
        }
        return true;
      });


      monthsInInterval.forEach(monthStart => {
        const monthEnd = endOfMonth(monthStart);
        const monthLabel = format(monthStart, "MMM yy", { locale: es });

        const procesosMapeadosEnMes = baseProcessesForChart.filter(proc => {
          if (!proc.capturedAt) return false;
          const capturedDate = parseISO(proc.capturedAt);
          return isValid(capturedDate) && isWithinInterval(capturedDate, { start: monthStart, end: monthEnd });
        }).length;

        const accionesCompletadasEnMes = baseActionsForChart.filter(accion => {
          if (accion.estado === 'Completada' && accion.fechaFinalizacion) {
            const finalizacionDate = parseISO(accion.fechaFinalizacion);
            return isValid(finalizacionDate) && isWithinInterval(finalizacionDate, { start: monthStart, end: monthEnd });
          }
          return false;
        }).length;

        const accionesEnProgresoEnMes = baseActionsForChart.filter(accion => {
          if (accion.estado === 'En Progreso' && accion.fechaCreacion) {
            const creacionDate = parseISO(accion.fechaCreacion);
            return isValid(creacionDate) && isWithinInterval(creacionDate, { start: monthStart, end: monthEnd });
          }
          return false;
        }).length;

        const accionesEnRevisionEnMes = baseActionsForChart.filter(accion => {
          if (accion.estado === 'En Revisión' && accion.fechaCreacion) {
            const creacionDate = parseISO(accion.fechaCreacion);
            return isValid(creacionDate) && isWithinInterval(creacionDate, { start: monthStart, end: monthEnd });
          }
          return false;
        }).length;
        
        const actividadesCreadasEnMes = baseActivitiesForChart.filter(actividad => {
          if (!actividad.createdAt) return false;
          const creacionDate = new Date(actividad.createdAt);
          return isValid(creacionDate) && isWithinInterval(creacionDate, { start: monthStart, end: monthEnd });
        }).length;

        const procesosSinActividadesEnMes = baseProcessesForChart.filter(proc => {
            if (!proc.capturedAt) return false;
            const capturedDate = parseISO(proc.capturedAt);
            return isValid(capturedDate) && isWithinInterval(capturedDate, { start: monthStart, end: monthEnd }) && 
                   (!proc.activityOrder || proc.activityOrder.length === 0);
        }).length;

        const actividadesActivasCreadasEnMes = baseActivitiesForChart.filter(act => {
            if (!act.createdAt) return false;
            const createdAtDate = new Date(act.createdAt);
            return isValid(createdAtDate) && isWithinInterval(createdAtDate, { start: monthStart, end: monthEnd }) && act.activa;
        }).length;

        const actividadesDuplicadasCreadasEnMes = baseActivitiesForChart.filter(act => {
            if (!act.createdAt) return false;
            const createdAtDate = new Date(act.createdAt);
            return isValid(createdAtDate) && isWithinInterval(createdAtDate, { start: monthStart, end: monthEnd }) && 
                   act.activa && (act.procesosAsociadosCount || 0) > 1;
        }).length;

        let procesosConVariacionesEnMes = 0;
        const processosCreadosEnMes = baseProcessesForChart.filter(proc => {
            if (!proc.capturedAt) return false;
            const capturedDate = parseISO(proc.capturedAt);
            return isValid(capturedDate) && isWithinInterval(capturedDate, { start: monthStart, end: monthEnd });
        });
        
        const processNamesOverall = new Map<string, Set<string>>();
        baseProcessesForChart.forEach(p => { // Compare against all relevant processes for variation context
            if (!processNamesOverall.has(p.proceso)) {
                processNamesOverall.set(p.proceso, new Set());
            }
            processNamesOverall.get(p.proceso)!.add(`${p.area}|${p.puesto}`);
        });

        processosCreadosEnMes.forEach(newProc => {
            if ((processNamesOverall.get(newProc.proceso)?.size || 0) > 1) {
                procesosConVariacionesEnMes++;
            }
        });


        monthlyData.push({
          month: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
          procesosMapeados: procesosMapeadosEnMes,
          accionesCompletadas: accionesCompletadasEnMes,
          accionesEnProgreso: accionesEnProgresoEnMes,
          accionesEnRevision: accionesEnRevisionEnMes,
          actividadesCreadas: actividadesCreadasEnMes,
          procesosSinActividades: procesosSinActividadesEnMes,
          actividadesActivas: actividadesActivasCreadasEnMes,
          actividadesDuplicadas: actividadesDuplicadasCreadasEnMes,
          procesosConVariaciones: procesosConVariacionesEnMes,
        });
      });
      setEvolutionChartData(monthlyData);
    }
  }, [processesFilteredByAreaPuesto, globalAcciones, globalActividades, isLoadingProcessData, isLoadingAcciones, isLoadingActividades, dashboardDateRange, selectedArea, selectedPuesto]);


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

  const staffSummary = useMemo(() => {
    if (isLoadingAreas || isLoadingPuestos) {
        return { total: 0, breakdown: [] };
    }

    const total = puestos.reduce((acc, puesto) => acc + (puesto.numeroPersonas || 0), 0);

    const breakdownByArea: Map<string, { areaName: string; totalInArea: number; puestos: { puestoName: string; puestoId: string; count: number }[] }> = new Map();

    areas.forEach(area => {
        breakdownByArea.set(area.id, { areaName: area.nombre, totalInArea: 0, puestos: [] });
    });

    puestos.forEach(puesto => {
        const areaId = puesto.areaId || 'unassigned';
        if (areaId === 'unassigned' && !breakdownByArea.has('unassigned')) {
            breakdownByArea.set('unassigned', { areaName: "Sin Área Asignada", totalInArea: 0, puestos: [] });
        }
        const areaData = breakdownByArea.get(areaId);
        if (areaData) {
            const count = puesto.numeroPersonas || 0;
            areaData.totalInArea += count;
            if (count > 0) { // Only add puestos with staff
                areaData.puestos.push({
                    puestoName: puesto.nombre,
                    puestoId: puesto.id,
                    count: count,
                });
            }
        }
    });

    const finalBreakdown = Array.from(breakdownByArea.entries())
        .map(([areaId, data]) => ({ ...data, areaId }))
        .filter(area => area.totalInArea > 0)
        .sort((a,b) => b.totalInArea - a.totalInArea);

    finalBreakdown.forEach(area => {
        area.puestos.sort((a,b) => b.count - a.count);
    });

    return {
        total,
        breakdown: finalBreakdown,
    };

  }, [areas, puestos, isLoadingAreas, isLoadingPuestos]);


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
      } else {
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

        // New cost logic
        const effectiveCost = proc.costoEstimado !== undefined && proc.costoEstimado !== null
          ? `${proc.costoEstimado} ${proc.monedaCosto || ''}`
          : (() => {
              const activityCostSum = (proc.activityOrder || [])
                .reduce((sum, actId) => {
                  const act = globalActividades.find(a => a.id === actId);
                  return sum + (act?.costoEstimadoActividad || 0);
                }, 0);
              return activityCostSum > 0 ? `${activityCostSum} ${proc.monedaCosto || ''} (derivado de actividades)` : 'No especificado';
            })();

        return `Proceso: ${proc.proceso}\n` +
               `Descripción: ${proc.descripcion}\n` +
               `Costo Estimado del Proceso: ${effectiveCost}\n` +
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

  const handleExportCsv = () => {
    const csvRows: string[][] = [];

    csvRows.push(["Métricas del Dashboard (según filtros aplicados)"]);
    csvRows.push(["Métrica", "Valor"]);
    const metrics = [
      { name: "Procesos Activos Mapeados", value: dashboardMetrics.procesosMapeadosCount },
      { name: "Procesos con Variaciones", value: dashboardMetrics.procesosConVariacionesCount },
      { name: "Actividades Activas", value: dashboardMetrics.actividadesActivasCount },
      { name: "Actividades Duplicadas", value: dashboardMetrics.actividadesDuplicadasCount },
      { name: "Acciones Completadas", value: dashboardMetrics.accionesCompletadasCount },
      { name: "Acciones en Revisión", value: dashboardMetrics.accionesEnRevisionCount },
      { name: "Acciones en Progreso", value: dashboardMetrics.accionesEnProgresoCount },
      { name: "Procesos Sin Actividades", value: dashboardMetrics.procesosSinActividadesCount },
    ];
    metrics.forEach(metric => csvRows.push([escapeCsvCell(metric.name), escapeCsvCell(metric.value)]));
    csvRows.push([]);

    csvRows.push(["Costos de Sistemas (refleja filtros de Área/Puesto)"]);
    csvRows.push(["Sistema", "Uso Anual", "Lic. Anual", "Total Lic.", "Total Anual"]);
    calculatedSystemCosts.forEach(cost => {
      csvRows.push([
        escapeCsvCell(cost.name),
        escapeCsvCell(formatDashboardCurrency(cost.annualUsageCost, cost.currency)),
        escapeCsvCell(formatDashboardCurrency(cost.annualLicenseCost, cost.currency)),
        escapeCsvCell(cost.totalLicenses > 0 ? cost.totalLicenses : '-'),
        escapeCsvCell(formatDashboardCurrency(cost.totalAnnualCost, cost.currency)),
      ]);
    });
    csvRows.push([]);

    csvRows.push(["Evolución de Optimización de Procesos (refleja filtros de Área/Puesto y selección de métricas)"]);
    const chartHeaderRow = ["Mes"];
    selectedChartMetrics.forEach(metricKey => {
      chartHeaderRow.push(escapeCsvCell(baseChartConfig[metricKey].label as string));
    });
    csvRows.push(chartHeaderRow);
    evolutionChartData.forEach(data => {
      const row = [escapeCsvCell(data.month)];
      selectedChartMetrics.forEach(metricKey => {
         row.push(escapeCsvCell(data[metricKey]));
      });
      csvRows.push(row);
    });
    csvRows.push([]);

    if (generatedSummary && selectedEntityType !== 'none' && selectedEntityName) {
      csvRows.push(["Resumen de Entidad por IA"]);
      csvRows.push(["Tipo de Entidad", "Nombre de Entidad"]);
      csvRows.push([escapeCsvCell(selectedEntityType), escapeCsvCell(selectedEntityName)]);
      csvRows.push([]);
      csvRows.push(["Resumen Generado:"]);
      csvRows.push([escapeCsvCell(generatedSummary)]);
    }

    const csvString = csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob(["\uFEFF" + csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');

    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `dashboard_resumen_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: "Exportación CSV Iniciada", description: "El archivo CSV del resumen del dashboard se está descargando." });
    } else {
      toast({ title: "Exportación Fallida", description: "Su navegador no soporta la descarga directa de archivos.", variant: "destructive" });
    }
  };

  const currentActiveChartConfig = useMemo(() => {
    return Object.fromEntries(
      Object.entries(baseChartConfig).filter(([key]) => selectedChartMetrics.includes(key as ChartMetricKey))
    );
  }, [selectedChartMetrics]);


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
                    <Select value={selectedPuesto} onValueChange={setSelectedPuesto} disabled={isLoadingPuestos || availablePuestosForFilter.length === 0}>
                        <SelectTrigger id="puestoFilter" className="h-9 text-sm">
                           <SelectValue placeholder={isLoadingPuestos ? "Cargando..." : (availablePuestosForFilter.length === 0 && selectedArea !== 'all' ? "Sin puestos para área" : "Todos los Puestos")} />
                        </SelectTrigger>
                        <SelectContent>
                        <SelectItem value="all">Todos los Puestos</SelectItem>
                        {isLoadingPuestos ? (
                             <SelectItem value="loading-puestos" disabled>Cargando...</SelectItem>
                        ) : availablePuestosForFilter.length === 0 && selectedArea !== 'all' ? (
                            <SelectItem value="no-puestos-for-area" disabled>No hay puestos para esta área</SelectItem>
                        ) : (
                            availablePuestosForFilter.map(puesto => <SelectItem key={puesto.id} value={puesto.nombre}>{puesto.nombre}</SelectItem>)
                        )}
                        </SelectContent>
                    </Select>
                </div>
                <Button onClick={handleExportCsv} variant="outline" size="sm" className="w-full self-end">
                    <Download className="mr-2 h-4 w-4" /> Exportar Resumen CSV
                </Button>
            </div>
        </div>
      </div>
      <p className="text-sm text-muted-foreground mb-8">
        Métricas clave y gráficos basados en el rango de fechas y filtros de área/puesto seleccionados. La tabla de Costos de Sistemas tiene su propia lógica de filtrado basada en Área/Puesto.
      </p>

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

      <div className="grid grid-cols-1 gap-6 mb-8">
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle>Distribución de Personal</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="mb-4">
                Resumen del personal total y desglose por área y puesto. La información se basa en el campo "Número de Personas" de la configuración de Puestos.
            </CardDescription>
            <div className="text-2xl font-bold mb-4">
                Total General: {renderMetric(staffSummary.total, isLoadingAreas || isLoadingPuestos)} personas
            </div>
            {isLoadingAll ? (
                <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" /> Cargando distribución...
                </div>
            ) : staffSummary.breakdown.length === 0 ? (
                <p className="text-muted-foreground text-sm">No hay datos de personal para mostrar. Verifique la configuración de Puestos.</p>
            ) : (
                <Accordion type="single" collapsible className="w-full">
                {staffSummary.breakdown.map(areaData => (
                    <AccordionItem value={areaData.areaId} key={areaData.areaId}>
                        <AccordionTrigger>
                            <div className="flex justify-between w-full pr-4 items-center">
                                <span className="font-semibold">{areaData.areaName}</span>
                                <Badge>{areaData.totalInArea} personas</Badge>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Puesto</TableHead>
                                        <TableHead className="text-right w-[150px]">Nº Personas</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {areaData.puestos.map(puesto => (
                                        <TableRow key={puesto.puestoId}>
                                            <TableCell>{puesto.puestoName}</TableCell>
                                            <TableCell className="text-right">{puesto.count}</TableCell>
                                        </TableRow>
                                    ))}
                                    {areaData.puestos.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={2} className="text-center text-muted-foreground">No hay puestos con personal asignado en esta área.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </AccordionContent>
                    </AccordionItem>
                ))}
                </Accordion>
            )}
          </CardContent>
        </Card>
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <Card className="lg:col-span-2 shadow-lg">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between">
                <div className="mb-2 sm:mb-0">
                    <CardTitle>Evolución de Optimización de Procesos</CardTitle>
                    <CardDescription>Seguimiento mensual. Refleja filtros de Área/Puesto.</CardDescription>
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="ml-auto self-start sm:self-center">
                            <Settings2 className="mr-2 h-4 w-4" /> Métricas del Gráfico
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
                        <DropdownMenuLabel>Seleccionar Métricas</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {(Object.keys(baseChartConfig) as ChartMetricKey[]).map((key) => (
                        <DropdownMenuCheckboxItem
                            key={key}
                            checked={selectedChartMetrics.includes(key)}
                            onCheckedChange={(checked) => {
                            setSelectedChartMetrics(prev =>
                                checked ? [...prev, key] : prev.filter(m => m !== key)
                            );
                            }}
                        >
                            {baseChartConfig[key].label}
                        </DropdownMenuCheckboxItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent className="h-[350px] pt-4">
            {isLoadingAll ? (
                <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" /> Cargando datos del gráfico...
                </div>
            ) : evolutionChartData.length > 0 && selectedChartMetrics.length > 0 ? (
              <ChartContainer config={currentActiveChartConfig} className="w-full h-full">
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
                  {selectedChartMetrics.map((metricKey) => (
                    <Bar key={metricKey} dataKey={metricKey} fill={`var(--color-${metricKey})`} radius={4} />
                  ))}
                </BarChart>
              </ChartContainer>
            ) : (
                 <div className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground text-center">
                        {selectedChartMetrics.length === 0 ? "Seleccione al menos una métrica para mostrar en el gráfico." : "No hay suficientes datos para mostrar la evolución en el rango/filtros seleccionados."}
                    </p>
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
            <CardDescription className="mb-4 text-xs">
              Costos anuales estimados.
              Si filtra por Puesto, muestra costos solo de ese Puesto.
              Si filtra por Área (y Puesto='Todos'), muestra costos de esa Área y de Puestos dentro de ella.
              Si Área y Puesto son 'Todos', muestra todos los sistemas.
            </CardDescription>
            {isLoadingAll ? (
                <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" /> Cargando costos...
                </div>
            ) : calculatedSystemCosts.length === 0 ? (
                <p className="text-muted-foreground text-sm">No hay datos de costos de sistemas que coincidan con los filtros.</p>
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
                  setSelectedEntityName('');
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
