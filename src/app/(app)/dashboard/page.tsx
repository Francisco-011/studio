'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Factory, DollarSign, CheckCircle2, ClipboardCheck, AlertTriangle, Loader2, Clock, TrendingUp } from "lucide-react";
import { format, parseISO, isValid } from 'date-fns';
import { useSistemasCostos, type TipoMoneda } from '@/contexts/SistemasCostosContext';
import { useAcciones, type Accion } from '@/contexts/AccionesContext';
import type { CapturedProcess } from '../procesos-y-flujos-registrados/page';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

const CAPTURED_DATA_LOCAL_STORAGE_KEY = 'proceza-captured-data';
const LOCAL_STORAGE_AUDITS_KEY = 'proceza-audits';

interface AuditFinding {
  type: "Conforme" | "No Conforme" | "Oportunidad de Mejora";
}
interface Audit {
  id: string;
  auditDate: string;
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

const renderMetric = (value: number | string, loading: boolean) => {
  if (loading) {
    return <Loader2 className="h-5 w-5 animate-spin" />;
  }
  return value;
}

export default function DashboardPage() {
  const [allCapturedProcesses, setAllCapturedProcesses] = useState<CapturedProcess[]>([]);
  const [allAudits, setAllAudits] = useState<Audit[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const { isLoadingSistemasCostos } = useSistemasCostos();
  const { acciones: globalAcciones, isLoadingAcciones } = useAcciones();

  useEffect(() => {
    setIsLoadingData(true);
    try {
      const storedProcesses = localStorage.getItem(CAPTURED_DATA_LOCAL_STORAGE_KEY);
      if (storedProcesses) setAllCapturedProcesses(JSON.parse(storedProcesses));
      const storedAudits = localStorage.getItem(LOCAL_STORAGE_AUDITS_KEY);
      if (storedAudits) setAllAudits(JSON.parse(storedAudits));
    } catch (error) {
      console.error("Error loading data from localStorage:", error);
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  const dashboardMetrics = useMemo(() => {
    const processes = allCapturedProcesses.filter(p => p.activo !== false && !p.deletedAt);
    const completedActions = globalAcciones.filter(acc => acc.estado === 'Completada');
    const completedAudits = allAudits.filter(a => a.status === 'Completada');

    const ahorroCostosMap = new Map<string, number>();
    completedActions.forEach(a => {
      if (a.ahorroEstimado && a.monedaAhorro) {
        ahorroCostosMap.set(a.monedaAhorro, (ahorroCostosMap.get(a.monedaAhorro) || 0) + a.ahorroEstimado);
      }
    });
    const ahorroCostosRealizado = Array.from(ahorroCostosMap.entries())
      .map(([currency, total]) => formatDashboardCurrency(total, currency))
      .join(', ') || 'N/A';

    const ahorroTiempoMap = new Map<string, number>();
    completedActions.forEach(a => {
      if (a.ahorroTiempoEstimado && a.unidadTiempoAhorro) {
        ahorroTiempoMap.set(a.unidadTiempoAhorro, (ahorroTiempoMap.get(a.unidadTiempoAhorro) || 0) + a.ahorroTiempoEstimado);
      }
    });
    const ahorroTiempoRealizado = Array.from(ahorroTiempoMap.entries()).map(([unit, total]) => `${total} ${unit.split('/')[0]}`).join(', ') || 'N/A';

    return {
      procesosMapeadosCount: processes.length,
      accionesCompletadasCount: completedActions.length,
      auditoriasCompletadasCount: completedAudits.length,
      hallazgosNoConformesCount: completedAudits.reduce((sum, audit) => sum + audit.findings.filter(f => f.type === 'No Conforme').length, 0),
      ahorroCostosRealizado,
      ahorroTiempoRealizado,
    };
  }, [allCapturedProcesses, globalAcciones, allAudits]);

  const isLoadingAll = isLoadingData || isLoadingAcciones || isLoadingSistemasCostos;

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-headline font-bold text-primary mb-2">Resumen Ejecutivo</h1>
        <p className="text-muted-foreground">Una vista de alto nivel de los indicadores clave de rendimiento (KPIs) de toda la organización.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Procesos Mapeados</CardTitle><Factory className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{renderMetric(dashboardMetrics.procesosMapeadosCount, isLoadingAll)}</div><p className="text-xs text-muted-foreground">Total de procesos activos</p></CardContent>
        </Card>
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Acciones Completadas</CardTitle><CheckCircle2 className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{renderMetric(dashboardMetrics.accionesCompletadasCount, isLoadingAll)}</div><p className="text-xs text-muted-foreground">Total histórico</p></CardContent>
        </Card>
        <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Ahorro Anual Realizado</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader>
            <CardContent><div className="text-2xl font-bold">{renderMetric(dashboardMetrics.ahorroCostosRealizado, isLoadingAll)}</div><p className="text-xs text-muted-foreground">De acciones completadas</p></CardContent>
        </Card>
        <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Ahorro de Tiempo Realizado</CardTitle><Clock className="h-4 w-4 text-muted-foreground" /></CardHeader>
            <CardContent><div className="text-2xl font-bold">{renderMetric(dashboardMetrics.ahorroTiempoRealizado, isLoadingAll)}</div><p className="text-xs text-muted-foreground">De acciones completadas</p></CardContent>
        </Card>
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Auditorías Completadas</CardTitle><ClipboardCheck className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{renderMetric(dashboardMetrics.auditoriasCompletadasCount, isLoadingAll)}</div><p className="text-xs text-muted-foreground">Total histórico</p></CardContent>
        </Card>
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Hallazgos No Conformes</CardTitle><AlertTriangle className="h-4 w-4 text-destructive" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{renderMetric(dashboardMetrics.hallazgosNoConformesCount, isLoadingAll)}</div><p className="text-xs text-muted-foreground">De todas las auditorías</p></CardContent>
        </Card>
      </div>

       <Card>
        <CardHeader>
          <CardTitle>Explorar Dashboards Especializados</CardTitle>
          <CardDescription>
            Profundice en los datos utilizando los paneles especializados para un análisis más detallado.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/dashboard/procesos">
            <Button variant="outline" className="w-full h-24 flex-col gap-2">
                <Factory className="h-6 w-6 text-primary"/>
                <span className="text-base">Procesos y Eficiencia</span>
            </Button>
          </Link>
          <Link href="/dashboard/mejoras">
            <Button variant="outline" className="w-full h-24 flex-col gap-2">
                <TrendingUp className="h-6 w-6 text-primary"/>
                <span className="text-base">Impacto y Mejoras</span>
            </Button>
          </Link>
          <Link href="/dashboard/auditoria">
            <Button variant="outline" className="w-full h-24 flex-col gap-2">
                <ClipboardCheck className="h-6 w-6 text-primary"/>
                <span className="text-base">Cumplimiento y Auditoría</span>
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
