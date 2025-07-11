
'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Factory, DollarSign, CheckCircle2, ClipboardCheck, AlertTriangle, Loader2, Clock, TrendingUp, FileText, HardDrive } from "lucide-react";
import { useAcciones } from '@/contexts/AccionesContext';
import { useProcesos } from '@/contexts/ProcesosContext';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { formatMinutesToHours } from '@/lib/utils';
import { usePermissions } from '@/contexts/PermissionsContext';
import { useAudits, type AuditFinding } from '@/contexts/AuditsContext';

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
  const { audits, isLoadingAudits } = useAudits();
  const { procesos, isLoadingProcesos } = useProcesos();
  const { acciones: globalAcciones, isLoadingAcciones } = useAcciones();
  const { hasPermission } = usePermissions();

  const dashboardMetrics = useMemo(() => {
    const activeProcesses = procesos.filter(p => p.activo !== false && !p.deletedAt);
    const completedActions = globalAcciones.filter(acc => acc.estado === 'Completada');
    const completedAudits = audits.filter(a => a.status === 'Completada');

    const ahorroCostosMap = new Map<string, number>();
    let totalMinutesSaved = 0;

    completedActions.forEach(action => {
      // Check for real savings in history first
      const historyCostSavings = action.historialDeCambios?.reduce((acc, cambio) => {
        if (cambio.field.toLowerCase().includes('costo')) {
          const ahorro = (Number(cambio.before) || 0) - (Number(cambio.after) || 0);
          return acc + (ahorro > 0 ? ahorro : 0);
        }
        return acc;
      }, 0) || 0;

      const historyTimeSavings = action.historialDeCambios?.reduce((acc, cambio) => {
        if (cambio.field.toLowerCase().includes('tiempo')) {
          const ahorro = (Number(cambio.before) || 0) - (Number(cambio.after) || 0);
          return acc + (ahorro > 0 ? ahorro : 0);
        }
        return acc;
      }, 0) || 0;

      // Calculate cost savings
      let costoRealizado = 0;
      if (historyCostSavings > 0) {
        costoRealizado = historyCostSavings;
      } else if (action.ahorroEstimado && action.ahorroEstimado > 0) {
        costoRealizado = action.ahorroEstimado;
      }

      if (costoRealizado > 0) {
        const moneda = action.monedaAhorro || 'MXN';
        ahorroCostosMap.set(moneda, (ahorroCostosMap.get(moneda) || 0) + costoRealizado);
      }
      
      // Calculate time savings
      let tiempoRealizado = 0;
       if (historyTimeSavings > 0) {
        tiempoRealizado = historyTimeSavings;
      } else if (action.ahorroTiempoEstimado && action.ahorroTiempoEstimado > 0) {
        tiempoRealizado = action.ahorroTiempoEstimado;
      }
      totalMinutesSaved += tiempoRealizado;
    });

    const ahorroCostosRealizado = Array.from(ahorroCostosMap.entries())
      .map(([currency, total]) => formatDashboardCurrency(total, currency))
      .join(', ') || formatDashboardCurrency(0, "MXN");

    const ahorroTiempoRealizado = totalMinutesSaved > 0 ? formatMinutesToHours(totalMinutesSaved) : '0 min';
    
    return {
      procesosMapeadosCount: activeProcesses.length,
      accionesCompletadasCount: completedActions.length,
      auditoriasCompletadasCount: completedAudits.length,
      hallazgosNoConformesCount: completedAudits.reduce((sum, audit) => sum + audit.findings.filter(f => f.type === 'No Conforme').length, 0),
      ahorroCostosRealizado,
      ahorroTiempoRealizado,
    };
  }, [procesos, globalAcciones, audits]);

  const isLoadingAll = isLoadingAudits || isLoadingAcciones || isLoadingProcesos;

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
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {hasPermission('dashboard:view_procesos') && (
            <Link href="/dashboard/procesos">
              <Button variant="outline" className="w-full h-24 flex-col gap-2">
                  <Factory className="h-6 w-6 text-primary"/>
                  <span className="text-base">Procesos y Eficiencia</span>
              </Button>
            </Link>
          )}
          {hasPermission('dashboard:view_mejoras') && (
            <Link href="/dashboard/mejoras">
              <Button variant="outline" className="w-full h-24 flex-col gap-2">
                  <TrendingUp className="h-6 w-6 text-primary"/>
                  <span className="text-base">Impacto y Mejoras</span>
              </Button>
            </Link>
          )}
          {hasPermission('dashboard:view_sistemas') && (
            <Link href="/dashboard/sistemas">
              <Button variant="outline" className="w-full h-24 flex-col gap-2">
                  <HardDrive className="h-6 w-6 text-primary"/>
                  <span className="text-base">Sistemas y Costos</span>
              </Button>
            </Link>
          )}
          {hasPermission('dashboard:view_politicas') && (
            <Link href="/dashboard/politicas">
              <Button variant="outline" className="w-full h-24 flex-col gap-2">
                  <FileText className="h-6 w-6 text-primary"/>
                  <span className="text-base">Políticas y Cumplimiento</span>
              </Button>
            </Link>
          )}
          {hasPermission('dashboard:view_auditoria') && (
            <Link href="/dashboard/auditoria">
              <Button variant="outline" className="w-full h-24 flex-col gap-2">
                  <ClipboardCheck className="h-6 w-6 text-primary"/>
                  <span className="text-base">Auditoría</span>
              </Button>
            </Link>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
