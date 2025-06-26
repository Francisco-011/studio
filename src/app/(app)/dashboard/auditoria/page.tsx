
'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardCheck, AlertTriangle, TrendingUp, Loader2, FileText } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, parseISO, isValid, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { DateRange } from "react-day-picker";
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { toast } from '@/hooks/use-toast';


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

const renderMetric = (value: number | string, loading: boolean) => {
  if (loading) return <Loader2 className="h-5 w-5 animate-spin" />;
  return value;
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
  defaultFromDate.setDate(defaultFromDate.getDate() - 90);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: defaultFromDate,
    to: defaultToDate,
  });

  useEffect(() => {
    setIsLoadingData(true);
    try {
      const storedAudits = localStorage.getItem(LOCAL_STORAGE_AUDITS_KEY);
      if (storedAudits) {
        const parsedAudits = JSON.parse(storedAudits);
        // Add a safeguard for missing 'findings' array
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
    if (!dateRange?.from) return allAudits;
    const from = startOfDay(dateRange.from);
    const to = dateRange.to ? endOfDay(dateRange.to) : endOfDay(new Date());
    
    return allAudits.filter(audit => {
        const auditDate = parseISO(audit.auditDate);
        return isValid(auditDate) && auditDate >= from && auditDate <= to;
    });
  }, [allAudits, dateRange]);


  const dashboardMetrics = useMemo(() => {
    const completedAudits = filteredAudits.filter(a => a.status === 'Completada');
    return {
      auditoriasCompletadasCount: completedAudits.length,
      hallazgosNoConformesCount: completedAudits.reduce((sum, audit) => sum + audit.findings.filter(f => f.type === 'No Conforme').length, 0),
      hallazgosOportunidadCount: completedAudits.reduce((sum, audit) => sum + audit.findings.filter(f => f.type === 'Oportunidad de Mejora').length, 0),
    };
  }, [filteredAudits]);

  const chartData = useMemo(() => {
    const dataByMonth: { [key: string]: { month: string; 'Auditorías Completadas': number; 'Hallazgos No Conformes': number; 'Oportunidades de Mejora': number } } = {};

    filteredAudits.filter(a => a.status === 'Completada').forEach(audit => {
        const monthKey = format(parseISO(audit.auditDate), 'MMM yyyy', { locale: es });
        if (!dataByMonth[monthKey]) {
            dataByMonth[monthKey] = {
                month: monthKey,
                'Auditorías Completadas': 0,
                'Hallazgos No Conformes': 0,
                'Oportunidades de Mejora': 0,
            };
        }
        dataByMonth[monthKey]['Auditorías Completadas']++;
        dataByMonth[monthKey]['Hallazgos No Conformes'] += audit.findings.filter(f => f.type === 'No Conforme').length;
        dataByMonth[monthKey]['Oportunidades de Mejora'] += audit.findings.filter(f => f.type === 'Oportunidad de Mejora').length;
    });

    return Object.values(dataByMonth).sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());
  }, [filteredAudits]);

  const chartConfig = {
    'Auditorías Completadas': { label: 'Auditorías Completadas', color: 'hsl(var(--chart-1))' },
    'Hallazgos No Conformes': { label: 'Hallazgos No Conformes', color: 'hsl(var(--chart-5))' },
    'Oportunidades de Mejora': { label: 'Oportunidades de Mejora', color: 'hsl(var(--chart-3))' },
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
        <DateRangePicker date={dateRange} setDate={setDateRange} />
      </div>

       <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Auditorías Completadas</CardTitle><ClipboardCheck className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{renderMetric(dashboardMetrics.auditoriasCompletadasCount, isLoadingAll)}</div><p className="text-xs text-muted-foreground">En el periodo seleccionado</p></CardContent>
        </Card>
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Hallazgos No Conformes</CardTitle><AlertTriangle className="h-4 w-4 text-destructive" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{renderMetric(dashboardMetrics.hallazgosNoConformesCount, isLoadingAll)}</div><p className="text-xs text-muted-foreground">De auditorías completadas</p></CardContent>
        </Card>
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Oportunidades de Mejora</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{renderMetric(dashboardMetrics.hallazgosOportunidadCount, isLoadingAll)}</div><p className="text-xs text-muted-foreground">De auditorías completadas</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
            <CardTitle>Evolución de Auditorías y Hallazgos</CardTitle>
            <CardDescription>Tendencia mensual de las auditorías completadas en el periodo seleccionado.</CardDescription>
        </CardHeader>
        <CardContent className="min-h-[300px]">
          {isLoadingAll ? <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin"/></div> :
           chartData.length > 0 ? (
            <ChartContainer config={chartConfig} className="min-h-[300px] w-full">
              <ResponsiveContainer>
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Line type="monotone" dataKey="Auditorías Completadas" stroke="var(--color-Auditorías Completadas)" />
                  <Line type="monotone" dataKey="Hallazgos No Conformes" stroke="var(--color-Hallazgos No Conformes)" />
                  <Line type="monotone" dataKey="Oportunidades de Mejora" stroke="var(--color-Oportunidades de Mejora)" />
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
                            <TableCell><Badge>{audit.status}</Badge></TableCell>
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
