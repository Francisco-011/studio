
'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardCheck, AlertTriangle, TrendingUp, Loader2 } from "lucide-react";
import { format, parseISO, isValid } from 'date-fns';

interface AuditFinding {
  type: "Conforme" | "No Conforme" | "Oportunidad de Mejora";
}
interface Audit {
  id: string;
  auditDate: string;
  status: 'En Progreso' | 'Completada' | 'Cancelada';
  findings: AuditFinding[];
}

const LOCAL_STORAGE_AUDITS_KEY = 'proceza-audits';

const renderMetric = (value: number | string, loading: boolean) => {
  if (loading) return <Loader2 className="h-5 w-5 animate-spin" />;
  return value;
}

export default function AuditoriaDashboardPage() {
  const [allAudits, setAllAudits] = useState<Audit[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    setIsLoadingData(true);
    try {
      const storedAudits = localStorage.getItem(LOCAL_STORAGE_AUDITS_KEY);
      if (storedAudits) setAllAudits(JSON.parse(storedAudits));
    } catch (error) {
      console.error("Error loading data from localStorage:", error);
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  const dashboardMetrics = useMemo(() => {
    const completedAudits = allAudits.filter(a => a.status === 'Completada');
    return {
      auditoriasCompletadasCount: completedAudits.length,
      hallazgosNoConformesCount: completedAudits.reduce((sum, audit) => sum + audit.findings.filter(f => f.type === 'No Conforme').length, 0),
      hallazgosOportunidadCount: completedAudits.reduce((sum, audit) => sum + audit.findings.filter(f => f.type === 'Oportunidad de Mejora').length, 0),
    };
  }, [allAudits]);

  const isLoadingAll = isLoadingData;

  return (
     <div className="container mx-auto py-8">
       <div className="mb-6">
        <h1 className="text-3xl font-headline font-bold text-primary mb-2">Dashboard: Cumplimiento y Auditoría</h1>
        <p className="text-muted-foreground">Monitoree el estado de las auditorías y el cumplimiento general de los procesos.</p>
      </div>

       <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Auditorías Completadas</CardTitle><ClipboardCheck className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{renderMetric(dashboardMetrics.auditoriasCompletadasCount, isLoadingAll)}</div><p className="text-xs text-muted-foreground">Total histórico</p></CardContent>
        </Card>
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Hallazgos No Conformes</CardTitle><AlertTriangle className="h-4 w-4 text-destructive" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{renderMetric(dashboardMetrics.hallazgosNoConformesCount, isLoadingAll)}</div><p className="text-xs text-muted-foreground">De todas las auditorías</p></CardContent>
        </Card>
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Oportunidades de Mejora</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{renderMetric(dashboardMetrics.hallazgosOportunidadCount, isLoadingAll)}</div><p className="text-xs text-muted-foreground">De todas las auditorías</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
            <CardTitle>Próximamente: Gráficos de Evolución</CardTitle>
            <CardDescription>Esta sección mostrará gráficos sobre la evolución de las auditorías y hallazgos a lo largo del tiempo.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center min-h-[300px] bg-muted/30 rounded-lg">
            <p className="text-muted-foreground">Visualizaciones de datos de auditoría aparecerán aquí en una futura actualización.</p>
        </CardContent>
      </Card>
    </div>
  );
}
