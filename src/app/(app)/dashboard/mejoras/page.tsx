
'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, CheckCircle2, TrendingUp, Activity as ActivityIcon, FileSearch2, Clock, Loader2, Settings2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { useSistemasCostos, type Sistema, type SistemaCosto, type TipoMoneda } from '@/contexts/SistemasCostosContext';
import { useAcciones, type Accion } from '@/contexts/AccionesContext';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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
}
interface CalculatedSystemCost {
    id: string;
    name: string;
    costsByCurrency: CostByCurrency[];
    descriptions: string[];
}

function calculateAllSystemAnnualCosts(
  systemsToCalculate: Sistema[],
  allCostos: SistemaCosto[]
): CalculatedSystemCost[] {
  return systemsToCalculate.map(system => {
    const costsForSystem = allCostos.filter(cost => cost.sistemaId === system.id);
    const costsByCurrency = new Map<TipoMoneda | string, { annualUsageCost: number; annualLicenseCost: number }>();
    const descriptions: string[] = [];

    costsForSystem.forEach(cost => {
      if (cost.descripcion) descriptions.push(cost.descripcion);
      const multiplier = cost.frecuencia === 'Mensual' ? 12 : 1;
      
      const usageCost = (cost.montoUso || 0) * multiplier;
      const licenseCost = ((cost.costoPorLicencia || 0) * (cost.numeroLicencias || 0)) * multiplier;

      const currency = cost.moneda || 'MXN';
      const currentCosts = costsByCurrency.get(currency) || { annualUsageCost: 0, annualLicenseCost: 0 };
      
      costsByCurrency.set(currency, {
          annualUsageCost: currentCosts.annualUsageCost + usageCost,
          annualLicenseCost: currentCosts.annualLicenseCost + licenseCost
      });
    });

    return {
      id: system.id,
      name: system.nombre,
      costsByCurrency: Array.from(costsByCurrency.entries()).map(([currency, { annualUsageCost, annualLicenseCost }]) => ({ currency, annualUsageCost, annualLicenseCost })),
      descriptions,
    };
  });
}


const renderMetric = (value: number | string, loading: boolean) => {
  if (loading) return <Loader2 className="h-5 w-5 animate-spin" />;
  return value;
}

export default function MejorasDashboardPage() {
  const [isLoadingData, setIsLoadingData] = useState(true);
  const { sistemas, costosSistemas, isLoadingSistemasCostos } = useSistemasCostos();
  const { acciones: globalAcciones, isLoadingAcciones } = useAcciones();
  const [calculatedSystemCosts, setCalculatedSystemCosts] = useState<CalculatedSystemCost[]>([]);

  useEffect(() => {
    setIsLoadingData(isLoadingSistemasCostos || isLoadingAcciones);
  }, [isLoadingSistemasCostos, isLoadingAcciones]);
  
  useEffect(() => {
    if (!isLoadingSistemasCostos && sistemas && costosSistemas) {
      setCalculatedSystemCosts(calculateAllSystemAnnualCosts(sistemas, costosSistemas));
    }
  }, [sistemas, costosSistemas, isLoadingSistemasCostos]);

  const dashboardMetrics = useMemo(() => {
    if (isLoadingAcciones) {
      return {
        accionesCompletadasCount: 0,
        accionesEnRevisionCount: 0,
        accionesEnProgresoCount: 0,
        ahorroCostosRealizado: 'N/A',
        ahorroTiempoRealizado: 'N/A',
      };
    }
    const completedActions = globalAcciones.filter(acc => acc.estado === 'Completada');
    const ahorroCostosMap = new Map<string, number>();
    completedActions.forEach(a => {
      if (a.ahorroEstimado && a.monedaAhorro) {
        ahorroCostosMap.set(a.monedaAhorro, (ahorroCostosMap.get(a.monedaAhorro) || 0) + a.ahorroEstimado);
      }
    });
    const ahorroTiempoMap = new Map<string, number>();
    completedActions.forEach(a => {
      if (a.ahorroTiempoEstimado && a.unidadTiempoAhorro) {
        ahorroTiempoMap.set(a.unidadTiempoAhorro, (ahorroTiempoMap.get(a.unidadTiempoAhorro) || 0) + a.ahorroTiempoEstimado);
      }
    });
    return {
      accionesCompletadasCount: completedActions.length,
      accionesEnRevisionCount: globalAcciones.filter(acc => acc.estado === 'En Revisión').length,
      accionesEnProgresoCount: globalAcciones.filter(acc => acc.estado === 'En Progreso').length,
      ahorroCostosRealizado: Array.from(ahorroCostosMap.entries()).map(([currency, total]) => formatDashboardCurrency(total, currency)).join(', ') || 'N/A',
      ahorroTiempoRealizado: Array.from(ahorroTiempoMap.entries()).map(([unit, total]) => `${total} ${unit.split('/')[0]}`).join(', ') || 'N/A',
    };
  }, [globalAcciones, isLoadingAcciones]);

  const isLoadingAll = isLoadingData || isLoadingAcciones || isLoadingSistemasCostos;

  return (
    <div className="container mx-auto py-8">
       <div className="mb-6">
        <h1 className="text-3xl font-headline font-bold text-primary mb-2">Dashboard: Impacto y Mejoras</h1>
        <p className="text-muted-foreground">Mida los resultados, ahorros y costos generados por las acciones de mejora y los sistemas.</p>
      </div>

       <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Ahorro Anual Realizado</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{renderMetric(dashboardMetrics.ahorroCostosRealizado, isLoadingAll)}</div><p className="text-xs text-muted-foreground">De acciones completadas</p></CardContent>
        </Card>
        <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Ahorro de Tiempo</CardTitle><Clock className="h-4 w-4 text-muted-foreground" /></CardHeader>
            <CardContent><div className="text-2xl font-bold">{renderMetric(dashboardMetrics.ahorroTiempoRealizado, isLoadingAll)}</div><p className="text-xs text-muted-foreground">De acciones completadas</p></CardContent>
        </Card>
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Acciones Completadas</CardTitle><CheckCircle2 className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{renderMetric(dashboardMetrics.accionesCompletadasCount, isLoadingAll)}</div><p className="text-xs text-muted-foreground">Total histórico</p></CardContent>
        </Card>
        <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Acciones en Progreso</CardTitle><ActivityIcon className="h-4 w-4 text-muted-foreground" /></CardHeader>
            <CardContent><div className="text-2xl font-bold">{renderMetric(dashboardMetrics.accionesEnProgresoCount, isLoadingAll)}</div><p className="text-xs text-muted-foreground">Activas actualmente</p></CardContent>
        </Card>
        <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Acciones en Revisión</CardTitle><FileSearch2 className="h-4 w-4 text-muted-foreground" /></CardHeader>
            <CardContent><div className="text-2xl font-bold">{renderMetric(dashboardMetrics.accionesEnRevisionCount, isLoadingAll)}</div><p className="text-xs text-muted-foreground">Pendientes de aprobación</p></CardContent>
        </Card>
      </div>

       <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center gap-2">
             <DollarSign className="h-5 w-5 text-primary" />
            <CardTitle>Costos de Sistemas</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="mb-4 text-xs">Costos anuales estimados de todos los sistemas configurados.</CardDescription>
            {isLoadingAll ? (
                <div className="flex items-center justify-center p-4"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : calculatedSystemCosts.length === 0 ? (
                <p className="text-muted-foreground text-sm">No hay datos de costos de sistemas.</p>
            ) : (
                <div className="max-h-[400px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                        <TableRow>
                        <TableHead>Sistema</TableHead>
                        <TableHead className="text-right">Costo Anual (Uso)</TableHead>
                        <TableHead className="text-right">Costo Anual (Licencias)</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {calculatedSystemCosts.map((system) => (
                        <TableRow key={system.id}>
                            <TableCell className="font-medium">
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <span className="cursor-default">{system.name}</span>
                                        </TooltipTrigger>
                                        {system.descriptions.length > 0 && (
                                        <TooltipContent><p className="font-bold">Detalle de Costos:</p><ul className="list-disc pl-4 text-left">{system.descriptions.map((d, i) => <li key={i}>{d}</li>)}</ul></TooltipContent>
                                        )}
                                    </Tooltip>
                                </TooltipProvider>
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                                {system.costsByCurrency.length > 0 ? 
                                    system.costsByCurrency.map(c => <div key={c.currency}>{formatDashboardCurrency(c.annualUsageCost, c.currency)}</div>) 
                                    : <span>-</span>
                                }
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                                {system.costsByCurrency.length > 0 ? 
                                    system.costsByCurrency.map(c => <div key={c.currency}>{formatDashboardCurrency(c.annualLicenseCost, c.currency)}</div>) 
                                    : <span>-</span>
                                }
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
  );
}
