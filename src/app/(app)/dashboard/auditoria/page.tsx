'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardCheck, AlertTriangle, TrendingUp, Loader2, FileText, CalendarRange } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { format, parseISO, isValid, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { DateRange } from "react-day-picker";
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAreas } from '@/contexts/AreasContext';
import { useDepartamentos } from '@/contexts/DepartamentosContext';
import { usePuestos } from '@/contexts/PuestosContext';
import { useProcesos } from '@/contexts/ProcesosContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAudits, type Audit, type AuditFinding } from '@/contexts/AuditsContext';

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

const getComparisonText = (current: number, previous: number): string => {
    if (previous === 0) {
        return current > 0 ? "+∞% vs periodo anterior" : "Sin cambios vs periodo anterior";
    }
    const diff = ((current - previous) / previous) * 100;
    if (diff > 0) return `+${diff.toFixed(0)}% vs periodo anterior`;
    if (diff < 0) return `${diff.toFixed(0)}% vs periodo anterior`;
    return "Sin cambios vs periodo anterior";
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

type ChartType = 'evolucion' | 'distribucion';

export default function AuditoriaDashboardPage() {
  const { audits: allAudits, isLoadingAudits } = useAudits();
  const { procesos: allCapturedProcesses, isLoadingProcesos } = useProcesos();
  
  const { areas, isLoading: isLoadingAreas } = useAreas();
  const { departamentos, isLoading: isLoadingDepartamentos } = useDepartamentos();
  const { puestos, isLoadingPuestos } = usePuestos();
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [isComparing, setIsComparing] = useState(false);
  const [comparisonDateRange, setComparisonDateRange] = useState<DateRange | undefined>(undefined);

  const [selectedArea, setSelectedArea] = useState<string>('all');
  const [selectedDepartamento, setSelectedDepartamento] = useState<string>('all');
  const [selectedPuesto, setSelectedPuesto] = useState<string>('all');
  const [chartType, setChartType] = useState<ChartType>('evolucion');

  const filterAuditsByCriteria = (auditsToFilter: Audit[], range?: DateRange) => {
    let filtered = auditsToFilter;
    
    if (range?.from) {
      const from = startOfDay(range.from);
      const to = range.to ? endOfDay(range.to) : endOfDay(new Date());
      filtered = filtered.filter(audit => {
          const auditDate = parseISO(audit.auditDate);
          return isValid(auditDate) && auditDate >= from && auditDate <= to;
      });
    }

    if (selectedArea !== 'all' || selectedDepartamento !== 'all' || selectedPuesto !== 'all') {
      filtered = filtered.filter(audit => {
        if (audit.auditType === 'proceso') {
          const proc = allCapturedProcesses.find(p => p.id === audit.targetId);
          if (!proc) return false;
          const areaMatch = selectedArea === 'all' || proc.area === selectedArea;
          const deptoMatch = selectedDepartamento === 'all' || proc.departamento === selectedDepartamento;
          const puestoMatch = selectedPuesto === 'all' || proc.puesto === selectedPuesto;
          return areaMatch && deptoMatch && puestoMatch;
        }
        if (audit.auditType === 'puesto') {
          const pst = puestos.find(p => p.id === audit.targetId);
          if (!pst) return false;
          const areaForPuesto = areas.find(a => a.id === pst.areaId)?.nombre;
          const deptoForPuesto = departamentos.find(d => d.id === pst.departamentoId)?.nombre;
          const areaMatch = selectedArea === 'all' || areaForPuesto === selectedArea;
          const deptoMatch = selectedDepartamento === 'all' || deptoForPuesto === selectedDepartamento;
          const puestoMatch = selectedPuesto === 'all' || pst.nombre === selectedPuesto;
          return areaMatch && deptoMatch && puestoMatch;
        }
        return true;
      });
    }

    return filtered;
  };

  const filteredAudits = useMemo(() => filterAuditsByCriteria(allAudits, dateRange), [allAudits, dateRange, selectedArea, selectedDepartamento, selectedPuesto, allCapturedProcesses, puestos, areas, departamentos]);
  const comparisonAudits = useMemo(() => isComparing ? filterAuditsByCriteria(allAudits, comparisonDateRange) : [], [allAudits, comparisonDateRange, isComparing, selectedArea, selectedDepartamento, selectedPuesto, allCapturedProcesses, puestos, areas, departamentos]);

  const processMetrics = (audits: Audit[]) => {
      const completedAudits = audits.filter(a => a.status === 'Completada');
      return {
          auditoriasCompletadasCount: completedAudits.length,
          hallazgosNoConformesCount: completedAudits.reduce((sum, audit) => sum + audit.findings.filter(f => f.type === 'No Conforme').length, 0),
          hallazgosOportunidadCount: completedAudits.reduce((sum, audit) => sum + audit.findings.filter(f => f.type === 'Oportunidad de Mejora').length, 0),
      };
  }

  const dashboardMetrics = useMemo(() => processMetrics(filteredAudits), [filteredAudits]);
  const comparisonMetrics = useMemo(() => {
      if (!isComparing) return null;
      return processMetrics(comparisonAudits);
  }, [comparisonAudits, isComparing]);

  const lineChartData = useMemo(() => {
    const processData = (audits: Audit[], suffix: string) => {
        const data: { [key: string]: { [key: string]: any } } = {};
        audits.filter(a => a.status === 'Completada').forEach(audit => {
            const auditDate = parseISO(audit.auditDate);
            if (!isValid(auditDate)) return;

            const sortKey = format(auditDate, 'yyyy-MM-dd');
            if (!data[sortKey]) data[sortKey] = {};

            const completedKey = `Auditorías Completadas${suffix}`;
            const nonConformKey = `Hallazgos No Conformes${suffix}`;
            const opportunityKey = `Oportunidades de Mejora${suffix}`;

            data[sortKey][completedKey] = (data[sortKey][completedKey] || 0) + 1;
            data[sortKey][nonConformKey] = (data[sortKey][nonConformKey] || 0) + audit.findings.filter(f => f.type === 'No Conforme').length;
            data[sortKey][opportunityKey] = (data[sortKey][opportunityKey] || 0) + audit.findings.filter(f => f.type === 'Oportunidad de Mejora').length;
        });
        return data;
    }

    const primaryData = processData(filteredAudits, "");
    const secondaryData = isComparing ? processData(comparisonAudits, " (Comp)") : {};
    
    const allKeys = new Set([...Object.keys(primaryData), ...Object.keys(secondaryData)]);
    const sortedKeys = Array.from(allKeys).sort();

    return sortedKeys.map(key => {
        const date = format(parseISO(key), 'dd MMM', { locale: es });
        return {
            date,
            ...primaryData[key],
            ...secondaryData[key],
        }
    });
}, [filteredAudits, comparisonAudits, isComparing]);

  const lineChartConfig: ChartConfig = {
    'Auditorías Completadas': { label: 'Auditorías Completadas', color: 'hsl(var(--chart-1))' },
    'Hallazgos No Conformes': { label: 'Hallazgos No Conformes', color: 'hsl(var(--chart-5))' },
    'Oportunidades de Mejora': { label: 'Oportunidades de Mejora', color: 'hsl(var(--chart-3))' },
    'Auditorías Completadas (Comp)': { label: 'Auditorías (Comp)', color: 'hsl(var(--chart-1))' },
    'Hallazgos No Conformes (Comp)': { label: 'Hallazgos NC (Comp)', color: 'hsl(var(--chart-5))' },
    'Oportunidades de Mejora (Comp)': { label: 'Oportunidades (Comp)', color: 'hsl(var(--chart-3))' },
  };

  const pieChartData = useMemo(() => {
    const findingsCount = {
        'Conforme': 0,
        'No Conforme': 0,
        'Oportunidad de Mejora': 0,
    };
    filteredAudits.forEach(audit => {
        if (audit.status === 'Completada') {
            audit.findings.forEach(finding => {
                findingsCount[finding.type]++;
            });
        }
    });
    return [
        { name: 'Conforme', value: findingsCount['Conforme'], fill: 'hsl(var(--chart-2))' },
        { name: 'No Conforme', value: findingsCount['No Conforme'], fill: 'hsl(var(--chart-5))' },
        { name: 'Oportunidad de Mejora', value: findingsCount['Oportunidad de Mejora'], fill: 'hsl(var(--chart-3))' },
    ].filter(d => d.value > 0);
  }, [filteredAudits]);

  const pieChartConfig: ChartConfig = {
    'Conforme': { label: 'Conformes', color: 'hsl(var(--chart-2))' },
    'No Conforme': { label: 'No Conformes', color: 'hsl(var(--chart-5))' },
    'Oportunidad de Mejora': { label: 'Oportunidades de Mejora', color: 'hsl(var(--chart-3))' },
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


  const isLoadingAll = isLoadingAudits || isLoadingAreas || isLoadingPuestos || isLoadingDepartamentos || isLoadingProcesos;

  const handleExport = () => {
    if (filteredAudits.length === 0) {
      toast({ title: "Nada que exportar", description: "No hay auditorías en el rango de fechas seleccionado.", variant: "default" });
      return;
    }
    const headers = ["ID", "Fecha", "Tipo", "Objetivo", "Estado", "Hallazgos No Conformes", "Oportunidades de Mejora"];
    const csvRows = [headers.join(',')];
    filteredAudits.forEach(audit => {
      const row = [
        escapeCsvCell(audit.id),
        escapeCsvCell(format(parseISO(audit.auditDate), 'yyyy-MM-dd')),
        escapeCsvCell(audit.auditType),
        escapeCsvCell(audit.targetName),
        escapeCsvCell(audit.status),
        escapeCsvCell(audit.findings.filter(f => f.type === 'No Conforme').length),
        escapeCsvCell(audit.findings.filter(f => f.type === 'Oportunidad de Mejora').length)
      ];
      csvRows.push(row.join(','));
    });

    const csvString = csvRows.join('\n');
    const blob = new Blob(["\uFEFF" + csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `auditorias_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  return (
     <div className="container mx-auto py-8">
       <div className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary mb-2">Dashboard: Auditoría</h1>
          <p className="text-muted-foreground">Monitoree el estado de las auditorías y el cumplimiento general de los procesos.</p>
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

       <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Auditorías Completadas</CardTitle><ClipboardCheck className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{renderMetric(dashboardMetrics.auditoriasCompletadasCount, isLoadingAll, isComparing && comparisonMetrics ? getComparisonText(dashboardMetrics.auditoriasCompletadasCount, comparisonMetrics.auditoriasCompletadasCount) : undefined)}</div><p className="text-xs text-muted-foreground">En el periodo seleccionado</p></CardContent>
        </Card>
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Hallazgos No Conformes</CardTitle><AlertTriangle className="h-4 w-4 text-destructive" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{renderMetric(dashboardMetrics.hallazgosNoConformesCount, isLoadingAll, isComparing && comparisonMetrics ? getComparisonText(dashboardMetrics.hallazgosNoConformesCount, comparisonMetrics.hallazgosNoConformesCount) : undefined)}</div><p className="text-xs text-muted-foreground">De auditorías completadas</p></CardContent>
        </Card>
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Oportunidades de Mejora</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{renderMetric(dashboardMetrics.hallazgosOportunidadCount, isLoadingAll, isComparing && comparisonMetrics ? getComparisonText(dashboardMetrics.hallazgosOportunidadCount, comparisonMetrics.hallazgosOportunidadCount) : undefined)}</div><p className="text-xs text-muted-foreground">De auditorías completadas</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Análisis de Auditorías</CardTitle>
            <Select value={chartType} onValueChange={(v) => setChartType(v as ChartType)}>
              <SelectTrigger className="w-[250px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="evolucion">Evolución de Auditorías</SelectItem>
                <SelectItem value="distribucion">Distribución de Hallazgos</SelectItem>
              </SelectContent>
            </Select>
          </div>
            <CardDescription>
              {chartType === 'evolucion'
                ? 'Tendencia de las auditorías completadas en el periodo seleccionado.'
                : 'Proporción de los tipos de hallazgos en las auditorías completadas del periodo.'
              }
            </CardDescription>
        </CardHeader>
        <CardContent className="min-h-[300px]">
          {isLoadingAll ? <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin"/></div> :
            <>
              {chartType === 'evolucion' ? (
                lineChartData.length > 0 ? (
                  <ChartContainer config={lineChartConfig} className="min-h-[300px] w-full">
                    <ResponsiveContainer>
                      <LineChart data={lineChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip content={<ChartTooltipContent />} />
                        <Legend />
                        <Line type="monotone" dataKey="Auditorías Completadas" stroke="var(--color-Auditorías Completadas)" />
                        <Line type="monotone" dataKey="Hallazgos No Conformes" stroke="var(--color-Hallazgos No Conformes)" />
                        <Line type="monotone" dataKey="Oportunidades de Mejora" stroke="var(--color-Oportunidades de Mejora)" />
                        {isComparing && <Line type="monotone" dataKey="Auditorías Completadas (Comp)" stroke="var(--color-Auditorías Completadas (Comp))" strokeDasharray="5 5" />}
                        {isComparing && <Line type="monotone" dataKey="Hallazgos No Conformes (Comp)" stroke="var(--color-Hallazgos No Conformes (Comp))" strokeDasharray="5 5" />}
                        {isComparing && <Line type="monotone" dataKey="Oportunidades de Mejora (Comp)" stroke="var(--color-Oportunidades de Mejora (Comp))" strokeDasharray="5 5" />}
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                ) : (
                  <div className="flex items-center justify-center h-full bg-muted/30 rounded-lg min-h-[250px]">
                    <p className="text-muted-foreground">No hay datos de evolución para los filtros seleccionados.</p>
                  </div>
                )
              ) : (
                pieChartData.length > 0 ? (
                    <ChartContainer config={pieChartConfig} className="min-h-[300px] w-full">
                       <ResponsiveContainer>
                          <PieChart>
                              <Tooltip content={<ChartTooltipContent hideLabel />} />
                              <Pie data={pieChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                                  {pieChartData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.fill} />))}
                              </Pie>
                              <Legend />
                          </PieChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                ) : (
                   <div className="flex items-center justify-center h-full bg-muted/30 rounded-lg min-h-[250px]">
                    <p className="text-muted-foreground">No hay hallazgos para mostrar.</p>
                  </div>
                )
              )}
            </>
          }
        </CardContent>
      </Card>

       <Card className="mt-8">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Auditorías Recientes</CardTitle>
              <CardDescription>Lista de auditorías que cumplen con los filtros seleccionados.</CardDescription>
            </div>
            <Button variant="outline" onClick={handleExport} disabled={filteredAudits.length === 0}>
                <FileText className="mr-2 h-4 w-4" /> Exportar CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-[400px] overflow-y-auto">
             <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Objetivo</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Estado</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredAudits.length > 0 ? filteredAudits.map(audit => (
                        <TableRow key={audit.id}>
                            <TableCell>{format(parseISO(audit.auditDate), 'dd MMM yyyy', {locale: es})}</TableCell>
                            <TableCell>{audit.targetName}</TableCell>
                            <TableCell>{audit.auditType}</TableCell>
                            <TableCell>
                                <Badge className={cn("text-white border-transparent", {
                                    "bg-green-600 hover:bg-green-700": audit.status === "Completada",
                                    "bg-red-600 hover:bg-red-700": audit.status === "Cancelada",
                                    "bg-orange-500 hover:bg-orange-600": audit.status === "En Progreso",
                                })}>
                                    {audit.status}
                                </Badge>
                            </TableCell>
                        </TableRow>
                    )) : (
                        <TableRow><TableCell colSpan={4} className="text-center">No hay auditorías para mostrar.</TableCell></TableRow>
                    )}
                </TableBody>
            </Table>
          </div>
        </CardContent>
       </Card>
    </div>
  );
}
