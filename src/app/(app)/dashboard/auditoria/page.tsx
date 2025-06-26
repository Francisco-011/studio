
'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardCheck, AlertTriangle, TrendingUp, Loader2, FileText, CalendarRange } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
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


interface AuditFinding {
  type: "Conforme" | "No Conforme" | "Oportunidad de Mejora";
}
interface Audit {
  id: string;
  auditDate: string;
  status: 'En Progreso' | 'Completada' | 'Cancelada';
  findings: AuditFinding[];
  targetName: string;
  auditType: string;
}

const LOCAL_STORAGE_AUDITS_KEY = 'proceza-audits';

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


export default function AuditoriaDashboardPage() {
  const [allAudits, setAllAudits] = useState<Audit[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  
  const defaultToDate = new Date();
  const defaultFromDate = new Date();
  defaultFromDate.setDate(defaultFromDate.getDate() - 29); // Default to last 30 days
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: defaultFromDate,
    to: defaultToDate,
  });

  const [isComparing, setIsComparing] = useState(false);
  const [comparisonDateRange, setComparisonDateRange] = useState<DateRange | undefined>(undefined);

  useEffect(() => {
    setIsLoadingData(true);
    try {
      const storedAudits = localStorage.getItem(LOCAL_STORAGE_AUDITS_KEY);
      if (storedAudits) {
        const parsedAudits = JSON.parse(storedAudits);
        const sanitizedAudits = parsedAudits.map((audit: any) => ({
            ...audit,
            findings: audit.findings || [],
        }));
        setAllAudits(sanitizedAudits);
      }
    } catch (error) {
      console.error("Error loading data from localStorage:", error);
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  const filteredAudits = useMemo(() => {
    if (!dateRange?.from) return [];
    const from = startOfDay(dateRange.from);
    const to = dateRange.to ? endOfDay(dateRange.to) : endOfDay(new Date());
    
    return allAudits.filter(audit => {
        const auditDate = parseISO(audit.auditDate);
        return isValid(auditDate) && auditDate >= from && auditDate <= to;
    });
  }, [allAudits, dateRange]);

  const comparisonAudits = useMemo(() => {
    if (!isComparing || !comparisonDateRange?.from) return [];
    const from = startOfDay(comparisonDateRange.from);
    const to = comparisonDateRange.to ? endOfDay(comparisonDateRange.to) : endOfDay(new Date());

    return allAudits.filter(audit => {
        const auditDate = parseISO(audit.auditDate);
        return isValid(auditDate) && auditDate >= from && auditDate <= to;
    });
}, [allAudits, comparisonDateRange, isComparing]);


  const dashboardMetrics = useMemo(() => {
    const completedAudits = filteredAudits.filter(a => a.status === 'Completada');
    return {
      auditoriasCompletadasCount: completedAudits.length,
      hallazgosNoConformesCount: completedAudits.reduce((sum, audit) => sum + audit.findings.filter(f => f.type === 'No Conforme').length, 0),
      hallazgosOportunidadCount: completedAudits.reduce((sum, audit) => sum + audit.findings.filter(f => f.type === 'Oportunidad de Mejora').length, 0),
    };
  }, [filteredAudits]);

  const comparisonMetrics = useMemo(() => {
    if (!isComparing) return null;
    const completedAudits = comparisonAudits.filter(a => a.status === 'Completada');
    return {
      auditoriasCompletadasCount: completedAudits.length,
      hallazgosNoConformesCount: completedAudits.reduce((sum, audit) => sum + audit.findings.filter(f => f.type === 'No Conforme').length, 0),
      hallazgosOportunidadCount: completedAudits.reduce((sum, audit) => sum + audit.findings.filter(f => f.type === 'Oportunidad de Mejora').length, 0),
    };
  }, [comparisonAudits, isComparing]);

  const chartData = useMemo(() => {
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

  const chartConfig: ChartConfig = {
    'Auditorías Completadas': { label: 'Auditorías Completadas', color: 'hsl(var(--chart-1))' },
    'Hallazgos No Conformes': { label: 'Hallazgos No Conformes', color: 'hsl(var(--chart-5))' },
    'Oportunidades de Mejora': { label: 'Oportunidades de Mejora', color: 'hsl(var(--chart-3))' },
    'Auditorías Completadas (Comp)': { label: 'Auditorías (Comp)', color: 'hsl(var(--chart-1))' },
    'Hallazgos No Conformes (Comp)': { label: 'Hallazgos NC (Comp)', color: 'hsl(var(--chart-5))' },
    'Oportunidades de Mejora (Comp)': { label: 'Oportunidades (Comp)', color: 'hsl(var(--chart-3))' },
  };

  const isLoadingAll = isLoadingData;

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
          <h1 className="text-3xl font-headline font-bold text-primary mb-2">Dashboard: Cumplimiento y Auditoría</h1>
          <p className="text-muted-foreground">Monitoree el estado de las auditorías y el cumplimiento general de los procesos.</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
            <DateRangePicker date={dateRange} setDate={setDateRange} />
             <Button variant="outline" onClick={() => setIsComparing(!isComparing)}>
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
            <CardTitle>Evolución de Auditorías y Hallazgos</CardTitle>
            <CardDescription>Tendencia de las auditorías completadas en el periodo seleccionado.</CardDescription>
        </CardHeader>
        <CardContent className="min-h-[300px]">
          {isLoadingAll ? <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin"/></div> :
           chartData.length > 0 ? (
            <ChartContainer config={chartConfig} className="min-h-[300px] w-full">
              <ResponsiveContainer>
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
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
              <p className="text-muted-foreground">No hay datos de auditoría en el rango de fechas seleccionado.</p>
            </div>
          )}
        </CardContent>
      </Card>

       <Card className="mt-8">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Auditorías Recientes</CardTitle>
              <CardDescription>Lista de auditorías en el periodo seleccionado.</CardDescription>
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
