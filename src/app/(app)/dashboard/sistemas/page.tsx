
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, HardDrive, AlertTriangle, TrendingUp, FileText, Activity as ActivityIcon } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from '@/components/ui/button';
import { ChartContainer, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { useSistemasCostos, type Sistema, type SistemaCosto, type TipoMoneda } from '@/contexts/SistemasCostosContext';
import { useProcesos } from '@/contexts/ProcesosContext';
import { useActividades } from '@/contexts/ActividadesContext';
import { useProcedimientos } from '@/contexts/ProcedimientosContext';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { useAreas } from '@/contexts/AreasContext';
import { useDepartamentos } from '@/contexts/DepartamentosContext';
import { usePuestos } from '@/contexts/PuestosContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Helper function to format currency
function formatDashboardCurrency(amount: number, currency: string) {
  if (currency === 'N/A' || !currency) return amount.toLocaleString('es-MX');
  try {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: currency, currencyDisplay: 'code', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
  } catch (e) {
    return `${amount.toFixed(0)} ${currency}`;
  }
}

// Helper to get monthly multiplier from frequency
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
        case 'A demanda': return 1;
        default: return 0;
    }
}

// Helper to render metric cards
const renderMetric = (value: number | string, loading: boolean) => {
  if (loading) return <Loader2 className="h-5 w-5 animate-spin" />;
  return value;
}

// Helper to escape CSV cell content
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


export default function SistemasDashboardPage() {
    const { sistemas, costosSistemas, isLoadingSistemasCostos } = useSistemasCostos();
    const { procesos: allCapturedProcesses, isLoadingProcesos } = useProcesos();
    const { procedimientos, isLoadingProcedimientos } = useProcedimientos();
    const { actividades, isLoadingActividades } = useActividades();
    const { areas, isLoading: isLoadingAreas } = useAreas();
    const { departamentos, isLoading: isLoadingDepartamentos } = useDepartamentos();
    const { puestos, isLoadingPuestos } = usePuestos();
    
    const [selectedArea, setSelectedArea] = useState<string>('all');
    const [selectedDepartamento, setSelectedDepartamento] = useState<string>('all');
    const [selectedPuesto, setSelectedPuesto] = useState<string>('all');
    
    const isLoadingAll = isLoadingSistemasCostos || isLoadingProcesos || isLoadingProcedimientos || isLoadingActividades || isLoadingAreas || isLoadingDepartamentos || isLoadingPuestos;

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


    const systemUsageData = useMemo(() => {
        if (isLoadingAll) return [];

        let filteredProcesos = allCapturedProcesses;
        if (selectedArea !== 'all') filteredProcesos = filteredProcesos.filter(p => p.area === selectedArea);
        if (selectedDepartamento !== 'all') filteredProcesos = filteredProcesos.filter(p => p.departamento === selectedDepartamento);
        if (selectedPuesto !== 'all') filteredProcesos = filteredProcesos.filter(p => p.puesto === selectedPuesto);
        
        const filteredProcesoIds = new Set(filteredProcesos.map(p => p.id));
        
        const filteredProcedimientos = procedimientos.filter(p => filteredProcesoIds.has(p.procesoId));
        const filteredProcedimientoIds = new Set(filteredProcedimientos.map(p => p.id));
        
        const filteredActividades = actividades.filter(a => a.procedimientoId && filteredProcedimientoIds.has(a.procedimientoId));

        const usageMap = new Map<string, { sistema: Sistema; processes: Set<string>; activities: Set<string>; totalExecutions: number; }>();
        
        sistemas.forEach(sistema => {
            usageMap.set(sistema.id, {
                sistema,
                processes: new Set(),
                activities: new Set(),
                totalExecutions: 0,
            });
        });

        filteredProcesos.forEach(proc => {
            (proc.sistemas || []).forEach(sysName => {
                const sistema = sistemas.find(s => s.nombre === sysName);
                if (sistema && usageMap.has(sistema.id)) {
                    usageMap.get(sistema.id)!.processes.add(proc.id);
                }
            });
            // Also check systems from procedures
            const proceduresOfProcess = filteredProcedimientos.filter(p => p.procesoId === proc.id);
            proceduresOfProcess.forEach(procManual => {
                (procManual.sistemasUtilizados || []).forEach(sysName => {
                    const sistema = sistemas.find(s => s.nombre === sysName);
                    if (sistema && usageMap.has(sistema.id)) {
                        usageMap.get(sistema.id)!.processes.add(proc.id);
                    }
                });
            });

        });
        
        filteredActividades.forEach(act => {
            if (act.sistemaUtilizado) {
                 const sistema = sistemas.find(s => s.nombre === act.sistemaUtilizado);
                 if (sistema && usageMap.has(sistema.id)) {
                    usageMap.get(sistema.id)!.activities.add(act.id);
                    const multiplier = getMonthlyMultiplier(act.frecuencia);
                    usageMap.get(sistema.id)!.totalExecutions += multiplier;
                 }
            }
        });
        
        return Array.from(usageMap.values())
          .map(data => {
            const costData = costosSistemas.filter(c => c.sistemaId === data.sistema.id);
            let totalAnnualCost = 0;
            let currency: TipoMoneda | string = 'N/A';
            if (costData.length > 0) {
              currency = costData[0].moneda || 'MXN'; // Assume one currency for simplicity in dashboard
              totalAnnualCost = costData.reduce((sum, cost) => {
                const multiplier = cost.frecuencia === 'Mensual' ? 12 : 1;
                const usageCost = (cost.montoUso || 0) * multiplier;
                const licenseCost = ((cost.costoPorLicencia || 0) * (cost.numeroLicencias || 0)) * multiplier;
                return sum + usageCost + licenseCost;
              }, 0);
            }
            return {
              ...data,
              totalAnnualCost,
              currency,
              usageIndex: (data.totalExecutions / (totalAnnualCost + 1)), // +1 to avoid division by zero
            };
          })
          .sort((a,b) => b.totalAnnualCost - a.totalAnnualCost);

    }, [isLoadingAll, sistemas, allCapturedProcesses, procedimientos, actividades, costosSistemas, selectedArea, selectedDepartamento, selectedPuesto]);

    const dashboardMetrics = useMemo(() => {
        const totalCostByCurrency = new Map<string, number>();
        let mostUsedSystem = { name: 'N/A', executions: 0 };
        let mostExpensiveSystem = { name: 'N/A', cost: 0, currency: 'N/A' };

        systemUsageData.forEach(sys => {
            totalCostByCurrency.set(sys.currency, (totalCostByCurrency.get(sys.currency) || 0) + sys.totalAnnualCost);
            if (sys.totalExecutions > mostUsedSystem.executions) {
                mostUsedSystem = { name: sys.sistema.nombre, executions: sys.totalExecutions };
            }
            if (sys.totalAnnualCost > mostExpensiveSystem.cost) {
                mostExpensiveSystem = { name: sys.sistema.nombre, cost: sys.totalAnnualCost, currency: sys.currency };
            }
        });
        
        const totalAnnualCostString = Array.from(totalCostByCurrency.entries())
            .map(([currency, total]) => formatDashboardCurrency(total, currency))
            .join(', ') || formatDashboardCurrency(0, 'USD');

        return {
            totalSystems: sistemas.length,
            totalAnnualCost: totalAnnualCostString,
            mostUsedSystem: `${mostUsedSystem.name} (${Math.round(mostUsedSystem.executions)} exec/mes)`,
            mostExpensiveSystem: `${mostExpensiveSystem.name} (${formatDashboardCurrency(mostExpensiveSystem.cost, mostExpensiveSystem.currency)})`,
        };
    }, [systemUsageData, sistemas]);


    const chartData = useMemo(() => {
      return systemUsageData
          .filter(sys => sys.totalAnnualCost > 0)
          .map(sys => ({
              name: `${sys.sistema.nombre} (${sys.currency})`,
              costo: sys.totalAnnualCost,
          }));
    }, [systemUsageData]);

    const chartConfig: ChartConfig = {
        costo: { label: 'Costo Anual', color: 'hsl(var(--chart-1))' },
    };
    
    const handleExport = () => {
        if (systemUsageData.length === 0) {
            toast({ title: "Nada que exportar", description: "No hay datos de sistemas para exportar.", variant: "default" });
            return;
        }
        const headers = ["Sistema", "Costo Anual Total", "Moneda", "Procesos Vinculados", "Actividades Vinculadas", "Ejecuciones Mensuales Est."];
        const csvRows = [headers.join(',')];
        systemUsageData.forEach(sys => {
            const row = [
                escapeCsvCell(sys.sistema.nombre),
                escapeCsvCell(sys.totalAnnualCost.toFixed(2)),
                escapeCsvCell(sys.currency),
                escapeCsvCell(sys.processes.size),
                escapeCsvCell(sys.activities.size),
                escapeCsvCell(Math.round(sys.totalExecutions)),
            ];
            csvRows.push(row.join(','));
        });

        const csvString = csvRows.join('\n');
        const blob = new Blob(["\uFEFF" + csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `analisis_sistemas_${format(new Date(), 'yyyy-MM-dd')}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    }
    
    return (
        <div className="container mx-auto py-8">
            <div className="mb-6">
                <h1 className="text-3xl font-headline font-bold text-primary mb-2">Dashboard: Costo y Uso de Sistemas</h1>
                <p className="text-muted-foreground">Analice la relación entre el costo de los sistemas y su uso real en los procesos y actividades de la organización.</p>
            </div>

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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <Card className="shadow-md"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Sistemas Registrados</CardTitle><HardDrive className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{renderMetric(dashboardMetrics.totalSystems, isLoadingAll)}</div></CardContent></Card>
                <Card className="shadow-md"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Costo Anual Total</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{renderMetric(dashboardMetrics.totalAnnualCost, isLoadingAll)}</div></CardContent></Card>
                <Card className="shadow-md"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Sistema Más Costoso</CardTitle><AlertTriangle className="h-4 w-4 text-destructive" /></CardHeader><CardContent><div className="text-2xl font-bold">{renderMetric(dashboardMetrics.mostExpensiveSystem, isLoadingAll)}</div></CardContent></Card>
                <Card className="shadow-md"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Sistema Más Utilizado</CardTitle><ActivityIcon className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{renderMetric(dashboardMetrics.mostUsedSystem, isLoadingAll)}</div></CardContent></Card>
            </div>

            <div className="grid grid-cols-1 gap-6">
                <Card className="shadow-lg">
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <CardTitle>Análisis de Costo y Uso por Sistema</CardTitle>
                            <Button variant="outline" onClick={handleExport} disabled={systemUsageData.length === 0}>
                                <FileText className="mr-2 h-4 w-4" /> Exportar CSV
                            </Button>
                        </div>
                        <CardDescription>Compare el costo anual de cada sistema con la cantidad de procesos y actividades que lo utilizan.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoadingAll ? <div className="flex justify-center items-center h-full min-h-[300px]"><Loader2 className="h-8 w-8 animate-spin"/></div> :
                        systemUsageData.length > 0 ? (
                            <div className="max-h-[500px] overflow-y-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Sistema</TableHead>
                                            <TableHead className="text-right">Costo Anual Est.</TableHead>
                                            <TableHead className="text-center">Procesos Vinculados</TableHead>
                                            <TableHead className="text-center">Actividades Vinculadas</TableHead>
                                            <TableHead className="text-center">Ejecuciones / Mes</TableHead>
                                            <TableHead className="text-right">Índice Costo/Uso</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {systemUsageData.map(sys => (
                                            <TableRow key={sys.sistema.id}>
                                                <TableCell className="font-medium">{sys.sistema.nombre}</TableCell>
                                                <TableCell className="text-right">{formatDashboardCurrency(sys.totalAnnualCost, sys.currency)}</TableCell>
                                                <TableCell className="text-center"><Badge variant="outline">{sys.processes.size}</Badge></TableCell>
                                                <TableCell className="text-center"><Badge variant="outline">{sys.activities.size}</Badge></TableCell>
                                                <TableCell className="text-center"><Badge variant="secondary">{Math.round(sys.totalExecutions)}</Badge></TableCell>
                                                <TableCell className="text-right font-mono">{sys.usageIndex.toFixed(2)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        ) : (
                             <div className="flex items-center justify-center h-full bg-muted/30 rounded-lg min-h-[250px]">
                                <p className="text-muted-foreground">No hay datos de sistemas para los filtros seleccionados.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
