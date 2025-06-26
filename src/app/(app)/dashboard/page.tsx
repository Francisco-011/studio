
'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Factory, DollarSign, ListChecks, PackageX, Loader2, Layers, CopyCheck, CheckCircle2, TrendingUp, FileSearch2, Activity as ActivityIcon, CalendarIcon as CalendarIconLucide, Brain, AreaChart, UserSquare2, Filter as FilterIcon, Download, Settings2, Users, ClipboardCheck, AlertTriangle, Building2, Clock, TrendingDown } from "lucide-react";
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
import { useDepartamentos, type Departamento as DepartamentoType } from '@/contexts/DepartamentosContext';
import { usePuestos, type Puesto as PuestoType } from '@/contexts/PuestosContext';
import { summarizeEntity, type SummarizeEntityOutput } from '@/ai/flows/summarize-entity-flow';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";


const CAPTURED_DATA_LOCAL_STORAGE_KEY = 'proceza-captured-data';
const LOCAL_STORAGE_AUDITS_KEY = 'proceza-audits';


// Minimal types needed for dashboard from audit module
type FindingType = "Conforme" | "No Conforme" | "Oportunidad de Mejora";
interface AuditFinding {
  type: FindingType;
}
interface Audit {
  id: string;
  auditDate: string; // ISO string
  status: 'En Progreso' | 'Completada' | 'Cancelada';
  findings: AuditFinding[];
}


function formatDashboardCurrency(amount: number, currency: string) {
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
    totalAnnualCost: number;
}
interface CalculatedSystemCost {
    id: string;
    name: string;
    costsByCurrency: CostByCurrency[];
    totalLicenses: number;
    descriptions: string[];
}


function calculateAllSystemAnnualCosts(
  systemsToCalculate: Sistema[],
  allCostos: SistemaCosto[]
): CalculatedSystemCost[] {
  if (!systemsToCalculate || !allCostos) return [];

  const costsBySystem = new Map<string, { system: Sistema; costs: SistemaCosto[] }>();

  systemsToCalculate.forEach(system => {
    costsBySystem.set(system.id, { system, costs: [] });
  });

  allCostos.forEach(cost => {
    if (costsBySystem.has(cost.sistemaId)) {
      costsBySystem.get(cost.sistemaId)!.costs.push(cost);
    }
  });

  return Array.from(costsBySystem.values()).map(({ system, costs }) => {
    const costsByCurrency = new Map<TipoMoneda | string, CostByCurrency>();
    let systemTotalLicenses = 0;
    const descriptions: string[] = [];

    costs.forEach(cost => {
      if (cost.descripcion) descriptions.push(cost.descripcion);
      
      const usage = cost.montoUso || 0;
      const licenses = cost.numeroLicencias || 0;
      const costPerLicense = cost.costoPorLicencia || 0;
      const licenseTotal = licenses * costPerLicense;

      let multiplier = 1;
      if (cost.frecuencia === 'Mensual') {
        multiplier = 12;
      }
      
      systemTotalLicenses += licenses;

      const currency = cost.moneda || 'MXN';
      if (!costsByCurrency.has(currency)) {
        costsByCurrency.set(currency, { currency, annualUsageCost: 0, annualLicenseCost: 0, totalAnnualCost: 0 });
      }

      const currentCosts = costsByCurrency.get(currency)!;
      currentCosts.annualUsageCost += usage * multiplier;
      currentCosts.annualLicenseCost += licenseTotal * multiplier;
      currentCosts.totalAnnualCost = currentCosts.annualUsageCost + currentCosts.annualLicenseCost;
    });

    return {
      id: system.id,
      name: system.nombre,
      costsByCurrency: Array.from(costsByCurrency.values()),
      totalLicenses: systemTotalLicenses,
      descriptions,
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
  auditoriasCompletadas: number;
  hallazgosNoConformes: number;
  hallazgosOportunidad: number;
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
  auditoriasCompletadas: { label: "Auditorías Completadas", color: "hsl(var(--chart-10))" },
  hallazgosNoConformes: { label: "Hallazgos No Conf.", color: "hsl(var(--chart-11))" },
  hallazgosOportunidad: { label: "Oport. de Mejora", color: "hsl(var(--chart-12))" },
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
  const [allAudits, setAllAudits] = useState<Audit[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const { actividades: globalActividades, isLoadingActividades } = useActividades();
  const { sistemas, costosSistemas, isLoadingSistemasCostos } = useSistemasCostos();
  const { acciones: globalAcciones, isLoadingAcciones } = useAcciones();
  const { areas, isLoading: isLoadingAreas } = useAreas();
  const { departamentos, isLoading: isLoadingDepartamentos } = useDepartamentos();
  const { puestos, isLoadingPuestos } = usePuestos();

  const [calculatedSystemCosts, setCalculatedSystemCosts] = useState<CalculatedSystemCost[]>([]);
  const [evolutionChartData, setEvolutionChartData] = useState<MonthlyEvolutionData[]>([]);
  const [selectedChartMetrics, setSelectedChartMetrics] = useState<ChartMetricKey[]>(['procesosMapeados', 'accionesCompletadas', 'auditoriasCompletadas']);

  const [dashboardDateRange, setDashboardDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [selectedArea, setSelectedArea] = useState<string>('all');
  const [selectedDepartamento, setSelectedDepartamento] = useState<string>('all');
  const [selectedPuesto, setSelectedPuesto] = useState<string>('all');
  
  const [availablePuestosForFilter, setAvailablePuestosForFilter] = useState<PuestoType[]>([]);
  const [availableDepartamentosForFilter, setAvailableDepartamentosForFilter] = useState<DepartamentoType[]>([]);


  const [selectedEntityType, setSelectedEntityType] = useState<'area' | 'puesto' | 'none'>('none');
  const [selectedEntityName, setSelectedEntityName] = useState<string>('');
  const [generatedSummary, setGeneratedSummary] = useState<string>('');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState<boolean>(false);
  const [entityList, setEntityList] = useState<{id: string, name: string}[]>([]);


  useEffect(() => {
    setIsLoadingData(true);
    try {
      const storedProcesses = localStorage.getItem(CAPTURED_DATA_LOCAL_STORAGE_KEY);
      if (storedProcesses) {
        const parsedProcesses: CapturedProcess[] = JSON.parse(storedProcesses);
        setAllCapturedProcesses(parsedProcesses);
      }
      const storedAudits = localStorage.getItem(LOCAL_STORAGE_AUDITS_KEY);
      if (storedAudits) {
        setAllAudits(JSON.parse(storedAudits));
      }
    } catch (error) {
      console.error("Error loading data from localStorage:", error);
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  useEffect(() => {
    setDashboardDateRange({
      from: startOfMonth(subMonths(new Date(), 5)),
      to: endOfMonth(new Date()),
    });
  }, []);

  useEffect(() => {
    if (selectedArea === 'all') {
      setAvailableDepartamentosForFilter(departamentos.sort((a,b) => a.nombre.localeCompare(b.nombre)));
    } else {
      const areaId = areas.find(a => a.nombre === selectedArea)?.id;
      if (areaId) {
        const filtered = departamentos.filter(d => d.areaId === areaId).sort((a,b) => a.nombre.localeCompare(b.nombre));
        setAvailableDepartamentosForFilter(filtered);
      } else {
        setAvailableDepartamentosForFilter([]);
      }
    }
    if (selectedDepartamento !== 'all' && !availableDepartamentosForFilter.some(d => d.nombre === selectedDepartamento)) {
      setSelectedDepartamento('all');
    }
  }, [selectedArea, departamentos, areas, selectedDepartamento, availableDepartamentosForFilter]);


  useEffect(() => {
    let puestosToFilter = puestos;
    if (selectedArea !== 'all') {
      const areaId = areas.find(a => a.nombre === selectedArea)?.id;
      if (areaId) {
        puestosToFilter = puestosToFilter.filter(p => p.areaId === areaId);
      }
    }
    if (selectedDepartamento !== 'all') {
      const deptoId = departamentos.find(d => d.nombre === selectedDepartamento)?.id;
      if (deptoId) {
        puestosToFilter = puestosToFilter.filter(p => p.departamentoId === deptoId);
      }
    }
    setAvailablePuestosForFilter(puestosToFilter.sort((a,b) => a.nombre.localeCompare(b.nombre)));
    
    if (selectedPuesto !== 'all' && !puestosToFilter.some(p => p.nombre === selectedPuesto)) {
      setSelectedPuesto('all');
    }
  }, [selectedArea, selectedDepartamento, puestos, areas, departamentos, selectedPuesto]);


  useEffect(() => {
    if (!isLoadingSistemasCostos && !isLoadingAreas && !isLoadingPuestos && sistemas && costosSistemas && areas && puestos) {
        let systemsToDisplay: Sistema[] = [];
        const selectedAreaObject = selectedArea !== 'all' ? areas.find(a => a.nombre === selectedArea) : null;
        const selectedPuestoObject = selectedPuesto !== 'all' ? puestos.find(p => p.nombre === selectedPuesto) : null;
        const selectedDeptoObject = selectedDepartamento !== 'all' ? departamentos.find(d => d.nombre === selectedDepartamento) : null;
        
        if (selectedPuestoObject) {
            systemsToDisplay = sistemas.filter(s => s.scope === "Puesto" && s.scopeId === selectedPuestoObject.id);
        } else if (selectedDeptoObject) {
            const puestosInDeptoIds = puestos.filter(p => p.departamentoId === selectedDeptoObject.id).map(p => p.id);
            systemsToDisplay = sistemas.filter(s =>
                (s.scope === "Departamento" && s.scopeId === selectedDeptoObject.id) ||
                (s.scope === "Puesto" && s.scopeId && puestosInDeptoIds.includes(s.scopeId))
            );
        } else if (selectedAreaObject) {
            const deptosInAreaIds = departamentos.filter(d => d.areaId === selectedAreaObject.id).map(d => d.id);
            const puestosInAreaIds = puestos.filter(p => p.areaId === selectedAreaObject.id).map(p => p.id);
            
            systemsToDisplay = sistemas.filter(s =>
                (s.scope === "Área" && s.scopeId === selectedAreaObject.id) ||
                (s.scope === "Departamento" && s.scopeId && deptosInAreaIds.includes(s.scopeId)) ||
                (s.scope === "Puesto" && s.scopeId && puestosInAreaIds.includes(s.scopeId))
            );
        } else { // All filters are 'all', show all systems
            systemsToDisplay = [...sistemas];
        }

        setCalculatedSystemCosts(calculateAllSystemAnnualCosts(systemsToDisplay, costosSistemas));
    }
  }, [
    sistemas,
    costosSistemas,
    isLoadingSistemasCostos,
    selectedArea,
    selectedDepartamento,
    selectedPuesto,
    areas,
    departamentos,
    puestos,
    isLoadingAreas,
    isLoadingDepartamentos,
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


  const processesFiltered = useMemo(() => {
    let processes = allCapturedProcesses.filter(p => p.activo !== false && !p.deletedAt);
    if (selectedArea !== 'all') {
      processes = processes.filter(proc => proc.area === selectedArea);
    }
    if (selectedDepartamento !== 'all') {
      processes = processes.filter(proc => proc.departamento === selectedDepartamento);
    }
    if (selectedPuesto !== 'all') {
      processes = processes.filter(proc => proc.puesto === selectedPuesto);
    }
    return processes;
  }, [allCapturedProcesses, selectedArea, selectedDepartamento, selectedPuesto]);

  const filteredCapturedProcesses = useMemo(() => {
    if (!dashboardDateRange.from || !dashboardDateRange.to) return processesFiltered;
    return processesFiltered.filter(proc => {
        if (!proc.capturedAt) return false;
        const capturedDate = parseISO(proc.capturedAt);
        return isValid(capturedDate) && isWithinInterval(capturedDate, { start: dashboardDateRange.from!, end: dashboardDateRange.to! });
    });
  }, [processesFiltered, dashboardDateRange]);

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

        if (selectedArea !== 'all' || selectedPuesto !== 'all' || selectedDepartamento !== 'all') {
          if (!act.procesosAsociadosIds || act.procesosAsociadosIds.length === 0) return false;
          return act.procesosAsociadosIds.some(procId => relevantProcessIds.has(procId));
        }
        return true;
    });
  }, [globalActividades, dashboardDateRange, filteredCapturedProcesses, selectedArea, selectedPuesto, selectedDepartamento]);

  const filteredAudits = useMemo(() => {
    if (!dashboardDateRange.from || !dashboardDateRange.to) return allAudits.filter(a => a.status === 'Completada');
    return allAudits.filter(audit => {
        if (audit.status !== 'Completada') return false;
        const auditDate = parseISO(audit.auditDate);
        return isValid(auditDate) && isWithinInterval(auditDate, { start: dashboardDateRange.from!, end: dashboardDateRange.to! });
    });
  }, [allAudits, dashboardDateRange]);


 useEffect(() => {
    if (!isLoadingData && !isLoadingAcciones && !isLoadingActividades && dashboardDateRange.from && dashboardDateRange.to) {
      const monthlyData: MonthlyEvolutionData[] = [];
      const monthsInInterval = eachMonthOfInterval({
        start: dashboardDateRange.from,
        end: dashboardDateRange.to,
      });

      const baseProcessesForChart = processesFiltered;
      const baseActionsForChart = globalAcciones; 
      const baseActivitiesForChart = globalActividades.filter(actividad => {
        const relevantProcessIdsForChart = new Set(baseProcessesForChart.map(p => p.id));
        if (selectedArea !== 'all' || selectedPuesto !== 'all' || selectedDepartamento !== 'all') {
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
        baseProcessesForChart.forEach(p => { 
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

        const auditsInMonth = allAudits.filter(audit => {
          if (audit.status !== 'Completada') return false;
          const auditDate = parseISO(audit.auditDate);
          return isValid(auditDate) && isWithinInterval(auditDate, { start: monthStart, end: monthEnd });
        });

        const auditoriasCompletadasEnMes = auditsInMonth.length;
        const hallazgosNoConformesEnMes = auditsInMonth.reduce((sum, audit) => sum + audit.findings.filter(f => f.type === 'No Conforme').length, 0);
        const hallazgosOportunidadEnMes = auditsInMonth.reduce((sum, audit) => sum + audit.findings.filter(f => f.type === 'Oportunidad de Mejora').length, 0);


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
          auditoriasCompletadas: auditoriasCompletadasEnMes,
          hallazgosNoConformes: hallazgosNoConformesEnMes,
          hallazgosOportunidad: hallazgosOportunidadEnMes,
        });
      });
      setEvolutionChartData(monthlyData);
    }
  }, [allAudits, processesFiltered, globalAcciones, globalActividades, isLoadingData, isLoadingAcciones, isLoadingActividades, dashboardDateRange, selectedArea, selectedPuesto]);


  const dashboardMetrics = useMemo(() => {
    if (isLoadingData || isLoadingActividades || isLoadingAcciones) {
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
        auditoriasCompletadasCount: 0,
        hallazgosNoConformesCount: 0,
        hallazgosOportunidadCount: 0,
        ahorroCostosRealizado: 'N/A',
        ahorroTiempoRealizado: 'N/A',
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

    const completedActions = filteredAcciones.filter(acc => acc.estado === 'Completada');
    const accionesCompletadasCount = completedActions.length;
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

    const auditoriasCompletadasCount = filteredAudits.length;
    const hallazgosNoConformesCount = filteredAudits.reduce((sum, audit) => sum + audit.findings.filter(f => f.type === 'No Conforme').length, 0);
    const hallazgosOportunidadCount = filteredAudits.reduce((sum, audit) => sum + audit.findings.filter(f => f.type === 'Oportunidad de Mejora').length, 0);

    const ahorroCostosMap = new Map<string, number>();
    completedActions.forEach(a => {
      if (a.ahorroEstimado && a.monedaAhorro) {
        const current = ahorroCostosMap.get(a.monedaAhorro) || 0;
        ahorroCostosMap.set(a.monedaAhorro, current + a.ahorroEstimado);
      }
    });
    const ahorroCostosRealizado = Array.from(ahorroCostosMap.entries())
      .map(([currency, total]) => formatDashboardCurrency(total, currency))
      .join(', ') || 'N/A';

    const ahorroTiempoMap = new Map<string, number>();
    completedActions.forEach(a => {
      if (a.ahorroTiempoEstimado && a.unidadTiempoAhorro) {
        const current = ahorroTiempoMap.get(a.unidadTiempoAhorro) || 0;
        ahorroTiempoMap.set(a.unidadTiempoAhorro, current + a.ahorroTiempoEstimado);
      }
    });
    const ahorroTiempoRealizado = Array.from(ahorroTiempoMap.entries())
      .map(([unit, total]) => `${total} ${unit.split('/')[0]}`)
      .join(', ') || 'N/A';


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
      auditoriasCompletadasCount,
      hallazgosNoConformesCount,
      hallazgosOportunidadCount,
      ahorroCostosRealizado,
      ahorroTiempoRealizado,
    };
  }, [filteredCapturedProcesses, filteredAcciones, filteredActividades, filteredAudits, globalActividades, isLoadingData, isLoadingActividades, isLoadingAcciones]);


  const isLoadingAll = isLoadingData || isLoadingActividades || isLoadingAcciones || isLoadingSistemasCostos || isLoadingAreas || isLoadingPuestos;

  const staffSummary = useMemo(() => {
    if (isLoadingAreas || isLoadingPuestos || isLoadingDepartamentos) {
        return { total: 0, breakdown: [] };
    }

    let filteredPuestos = puestos;
    if (selectedArea !== 'all') {
        const areaId = areas.find(a => a.nombre === selectedArea)?.id;
        if (areaId) {
            filteredPuestos = filteredPuestos.filter(p => p.areaId === areaId);
        }
    }
     if (selectedDepartamento !== 'all') {
      const deptoId = departamentos.find(d => d.nombre === selectedDepartamento)?.id;
      if (deptoId) {
        filteredPuestos = filteredPuestos.filter(p => p.departamentoId === deptoId);
      }
    }
    if (selectedPuesto !== 'all') {
        filteredPuestos = filteredPuestos.filter(p => p.nombre === selectedPuesto);
    }

    let filteredAreas = areas;
    if (selectedArea !== 'all') {
        filteredAreas = filteredAreas.filter(a => a.nombre === selectedArea);
    }
    
    const total = filteredPuestos.reduce((acc, puesto) => acc + (puesto.numeroPersonas || 0), 0);

    const breakdownByArea: Map<string, { areaName: string; totalInArea: number; deptos: { deptoName: string, deptoId: string, totalInDepto: number, puestos: { puestoName: string; puestoId: string; count: number }[] }[] }> = new Map();

    filteredAreas.forEach(area => {
        breakdownByArea.set(area.id, { areaName: area.nombre, totalInArea: 0, deptos: [] });
    });

    const deptosInScope = departamentos.filter(depto => {
        if (selectedArea === 'all') return true;
        const areaId = areas.find(a => a.nombre === selectedArea)?.id;
        return depto.areaId === areaId;
    });

    filteredPuestos.forEach(puesto => {
        const areaId = puesto.areaId;
        const areaData = breakdownByArea.get(areaId);
        if (areaData) {
            areaData.totalInArea += (puesto.numeroPersonas || 0);

            let deptoData = areaData.deptos.find(d => d.deptoId === (puesto.departamentoId || 'unassigned'));
            if (!deptoData) {
                const deptoName = departamentos.find(d => d.id === puesto.departamentoId)?.nombre || "Sin Departamento Asignado";
                deptoData = { deptoName, deptoId: puesto.departamentoId || 'unassigned', totalInDepto: 0, puestos: [] };
                areaData.deptos.push(deptoData);
            }
            deptoData.totalInDepto += (puesto.numeroPersonas || 0);
            deptoData.puestos.push({
                puestoName: puesto.nombre,
                puestoId: puesto.id,
                count: puesto.numeroPersonas || 0,
            });
        }
    });

    const finalBreakdown = Array.from(breakdownByArea.values())
        .filter(area => area.totalInArea > 0)
        .sort((a,b) => b.totalInArea - a.totalInArea);

    finalBreakdown.forEach(area => {
        area.deptos.sort((a, b) => b.totalInDepto - a.totalInDepto);
        area.deptos.forEach(depto => {
            depto.puestos.sort((a,b) => b.count - a.count);
        });
    });

    return { total, breakdown: finalBreakdown };
  }, [areas, departamentos, puestos, isLoadingAreas, isLoadingDepartamentos, isLoadingPuestos, selectedArea, selectedDepartamento, selectedPuesto]);


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

        const effectiveCost = proc.costoEstimado !== undefined && proc.costoEstimado !== null
          ? `${proc.costoEstimado} ${proc.monedaCosto || ''}`
          : 'No especificado';

        return `Proceso: ${proc.proceso}\n` +
               (proc.departamento ? `Departamento: ${proc.departamento}\n` : '') +
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
    calculatedSystemCosts.forEach(system => {
        const totalAnnualCostStr = system.costsByCurrency.map(c => formatDashboardCurrency(c.totalAnnualCost, c.currency)).join('; ');
        const annualUsageCostStr = system.costsByCurrency.map(c => formatDashboardCurrency(c.annualUsageCost, c.currency)).join('; ');
        const annualLicenseCostStr = system.costsByCurrency.map(c => formatDashboardCurrency(c.annualLicenseCost, c.currency)).join('; ');
        csvRows.push([
            escapeCsvCell(system.name),
            escapeCsvCell(annualUsageCostStr),
            escapeCsvCell(annualLicenseCostStr),
            escapeCsvCell(system.totalLicenses > 0 ? system.totalLicenses : '-'),
            escapeCsvCell(totalAnnualCostStr),
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
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
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
                    <Select value={selectedArea} onValueChange={(v) => { setSelectedArea(v); setSelectedDepartamento('all'); setSelectedPuesto('all'); }} disabled={isLoadingAreas}>
                        <SelectTrigger id="areaFilter" className="h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                        <SelectItem value="all">Todas las Áreas</SelectItem>
                        {areas.map(area => <SelectItem key={area.id} value={area.nombre}>{area.nombre}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                 <div>
                    <Label htmlFor="departamentoFilter" className="text-xs">Departamento</Label>
                    <Select value={selectedDepartamento} onValueChange={(v) => { setSelectedDepartamento(v); setSelectedPuesto('all'); }} disabled={isLoadingDepartamentos || selectedArea === 'all'}>
                        <SelectTrigger id="departamentoFilter" className="h-9 text-sm">
                            <SelectValue placeholder={selectedArea === 'all' ? "Seleccione un Área" : "Todos los Deptos."} />
                        </SelectTrigger>
                        <SelectContent>
                        <SelectItem value="all">Todos los Departamentos</SelectItem>
                        {availableDepartamentosForFilter.map(depto => <SelectItem key={depto.id} value={depto.nombre}>{depto.nombre}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label htmlFor="puestoFilter" className="text-xs">Puesto</Label>
                    <Select value={selectedPuesto} onValueChange={setSelectedPuesto} disabled={isLoadingPuestos || availablePuestosForFilter.length === 0}>
                        <SelectTrigger id="puestoFilter" className="h-9 text-sm">
                           <SelectValue placeholder={isLoadingPuestos ? "Cargando..." : (availablePuestosForFilter.length === 0 && (selectedArea !== 'all' || selectedDepartamento !== 'all') ? "Sin puestos" : "Todos los Puestos")} />
                        </SelectTrigger>
                        <SelectContent>
                        <SelectItem value="all">Todos los Puestos</SelectItem>
                        {availablePuestosForFilter.map(puesto => <SelectItem key={puesto.id} value={puesto.nombre}>{puesto.nombre}</SelectItem>)}
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
        Métricas clave y gráficos basados en el rango de fechas y filtros de área/puesto seleccionados.
      </p>

       <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Procesos Mapeados</CardTitle><Factory className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{renderMetric(dashboardMetrics.procesosMapeadosCount, isLoadingAll)}</div><p className="text-xs text-muted-foreground">Procesos activos en el periodo</p></CardContent>
        </Card>
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Acciones Completadas</CardTitle><CheckCircle2 className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{renderMetric(dashboardMetrics.accionesCompletadasCount, isLoadingAll)}</div><p className="text-xs text-muted-foreground">Finalizadas en el periodo</p></CardContent>
        </Card>
        <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Ahorro Anual Realizado</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader>
            <CardContent><div className="text-2xl font-bold">{renderMetric(dashboardMetrics.ahorroCostosRealizado, isLoadingAll)}</div><p className="text-xs text-muted-foreground">De acciones completadas</p></CardContent>
        </Card>
        <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Ahorro de Tiempo</CardTitle><Clock className="h-4 w-4 text-muted-foreground" /></CardHeader>
            <CardContent><div className="text-2xl font-bold">{renderMetric(dashboardMetrics.ahorroTiempoRealizado, isLoadingAll)}</div><p className="text-xs text-muted-foreground">De acciones completadas</p></CardContent>
        </Card>
        <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Acciones en Progreso</CardTitle><ActivityIcon className="h-4 w-4 text-muted-foreground" /></CardHeader>
            <CardContent><div className="text-2xl font-bold">{renderMetric(dashboardMetrics.accionesEnProgresoCount, isLoadingAll)}</div><p className="text-xs text-muted-foreground">Activas en el periodo</p></CardContent>
        </Card>
        <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Acciones en Revisión</CardTitle><FileSearch2 className="h-4 w-4 text-muted-foreground" /></CardHeader>
            <CardContent><div className="text-2xl font-bold">{renderMetric(dashboardMetrics.accionesEnRevisionCount, isLoadingAll)}</div><p className="text-xs text-muted-foreground">Pendientes de aprobación</p></CardContent>
        </Card>
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Procesos con Variaciones</CardTitle><Layers className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{renderMetric(dashboardMetrics.procesosConVariacionesCount, isLoadingAll)}</div><p className="text-xs text-muted-foreground">Procesos con mismo nombre</p></CardContent>
        </Card>
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Actividades Duplicadas</CardTitle><CopyCheck className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{renderMetric(dashboardMetrics.actividadesDuplicadasCount, isLoadingAll)}</div><p className="text-xs text-muted-foreground">Actividades en 2+ procesos</p></CardContent>
        </Card>
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Procesos sin Actividades</CardTitle><PackageX className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{renderMetric(dashboardMetrics.procesosSinActividadesCount, isLoadingAll)}</div><p className="text-xs text-muted-foreground">Procesos no detallados</p></CardContent>
        </Card>
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Auditorías Completadas</CardTitle><ClipboardCheck className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{renderMetric(dashboardMetrics.auditoriasCompletadasCount, isLoadingAll)}</div><p className="text-xs text-muted-foreground">En el periodo</p></CardContent>
        </Card>
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Hallazgos No Conformes</CardTitle><AlertTriangle className="h-4 w-4 text-destructive" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{renderMetric(dashboardMetrics.hallazgosNoConformesCount, isLoadingAll)}</div><p className="text-xs text-muted-foreground">De auditorías en periodo</p></CardContent>
        </Card>
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Oportunidades de Mejora</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{renderMetric(dashboardMetrics.hallazgosOportunidadCount, isLoadingAll)}</div><p className="text-xs text-muted-foreground">De auditorías en periodo</p></CardContent>
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
                Resumen del personal total y desglose por área y puesto, según filtros. La información se basa en el campo "Número de Personas" de la configuración de Puestos.
            </CardDescription>
            <div className="text-2xl font-bold mb-4">
                Total (filtrado): {renderMetric(staffSummary.total, isLoadingAll)} personas
            </div>
            {isLoadingAll ? (
                <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" /> Cargando distribución...
                </div>
            ) : staffSummary.breakdown.length === 0 ? (
                <p className="text-muted-foreground text-sm">No hay datos de personal para mostrar según los filtros seleccionados. Verifique la configuración de Puestos.</p>
            ) : (
                <Accordion type="multiple" className="w-full">
                {staffSummary.breakdown.map(areaData => (
                    <AccordionItem value={areaData.areaName} key={areaData.areaName}>
                        <AccordionTrigger>
                            <div className="flex justify-between w-full pr-4 items-center">
                                <span className="font-semibold">{areaData.areaName}</span>
                                <Badge>{areaData.totalInArea} personas</Badge>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                           {areaData.deptos.length > 0 ? (
                            <Accordion type="multiple" className="w-full pl-4" collapsible>
                                {areaData.deptos.map(deptoData => (
                                    <AccordionItem value={deptoData.deptoId} key={deptoData.deptoId}>
                                        <AccordionTrigger className="text-sm">
                                            <div className="flex justify-between w-full pr-4 items-center">
                                                <span className="font-medium">{deptoData.deptoName}</span>
                                                <Badge variant="secondary">{deptoData.totalInDepto} personas</Badge>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent>
                                            <Table>
                                                <TableHeader><TableRow><TableHead>Puesto</TableHead><TableHead className="text-right w-[150px]">Nº Personas</TableHead></TableRow></TableHeader>
                                                <TableBody>
                                                    {deptoData.puestos.map(puesto => (
                                                        <TableRow key={puesto.puestoId}><TableCell>{puesto.puestoName}</TableCell><TableCell className="text-right">{puesto.count}</TableCell></TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                           ) : ( <p className="text-sm text-muted-foreground p-4">No hay departamentos con personal asignado en esta área.</p> )}
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
              Costos anuales estimados. Refleja filtros organizacionales.
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
                        {calculatedSystemCosts.map((system) => (
                        <TableRow key={system.id}>
                            <TableCell className="font-medium text-xs">{system.name}</TableCell>
                            <TableCell className="text-right text-xs">
                                {(system.costsByCurrency || []).length > 0 ? (system.costsByCurrency || []).map(c => <div key={c.currency}>{formatDashboardCurrency(c.annualUsageCost, c.currency)}</div>) : <span>-</span>}
                            </TableCell>
                            <TableCell className="text-right text-xs">
                                {(system.costsByCurrency || []).length > 0 ? (system.costsByCurrency || []).map(c => <div key={c.currency}>{formatDashboardCurrency(c.annualLicenseCost, c.currency)}</div>) : <span>-</span>}
                            </TableCell>
                            <TableCell className="text-right text-xs">{system.totalLicenses > 0 ? system.totalLicenses : '-'}</TableCell>
                            <TableCell className="text-right font-semibold text-xs">
                               <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div>
                                            {(system.costsByCurrency || []).length > 0 ? (system.costsByCurrency || []).map(c => <div key={c.currency}>{formatDashboardCurrency(c.totalAnnualCost, c.currency)}</div>) : <span>-</span>}
                                        </div>
                                    </TooltipTrigger>
                                    {system.descriptions.length > 0 && (
                                    <TooltipContent>
                                        <p className="font-bold">Detalle de Costos:</p>
                                        <ul className="list-disc pl-4 text-left">
                                            {system.descriptions.map((desc, i) => <li key={i}>{desc}</li>)}
                                        </ul>
                                    </TooltipContent>
                                    )}
                                </Tooltip>
                               </TooltipProvider>
                            </TableCell>
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
