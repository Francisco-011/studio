
'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Users, TrendingUp, CheckCircle2, Factory, DollarSign, ListChecks, PackageX, Loader2, Layers, CopyCheck } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CapturedProcess } from '../procesos-y-flujos-registrados/page';
import { useActividades, type Actividad } from '@/contexts/ActividadesContext';
import { useSistemasCostos, type Sistema, type SistemaCosto, type TipoMoneda } from '@/contexts/SistemasCostosContext';
import { useAcciones, type Accion } from '@/contexts/AccionesContext';


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
    currency: TipoMoneda | string;
}

function calculateAllSystemAnnualCosts(
  allSistemas: Sistema[],
  allCostos: SistemaCosto[]
): CalculatedSystemCost[] {
  if (!allSistemas || !allCostos) return [];

  return allSistemas.map(system => {
    const costsForSystem = allCostos.filter(cost => cost.sistemaId === system.id);
    let totalAnnualUsage = 0;
    let totalAnnualLicense = 0;
    let systemCurrency: TipoMoneda | string = 'USD';

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
          }

          if (cost.frecuencia === "Mensual") {
            totalAnnualUsage += periodicUsage * 12;
            totalAnnualLicense += periodicLicense * 12;
          } else if (cost.frecuencia === "Anual") {
            totalAnnualUsage += periodicUsage;
            totalAnnualLicense += periodicLicense;
          } else {
            totalAnnualUsage += periodicUsage;
            totalAnnualLicense += periodicLicense;
          }
        }
      });
    }
    return {
      id: system.id,
      name: system.nombre,
      annualUsageCost: totalAnnualUsage,
      annualLicenseCost: totalAnnualLicense,
      totalAnnualCost: totalAnnualUsage + totalAnnualLicense,
      currency: systemCurrency,
    };
  });
}


export default function DashboardPage() {
  const [capturedProcesses, setCapturedProcesses] = useState<CapturedProcess[]>([]);
  const [isLoadingProcessData, setIsLoadingProcessData] = useState(true);
  
  const { actividades, isLoadingActividades } = useActividades();
  const { sistemas, costosSistemas, isLoadingSistemasCostos } = useSistemasCostos();
  const { acciones, isLoadingAcciones } = useAcciones();

  const [calculatedSystemCosts, setCalculatedSystemCosts] = useState<CalculatedSystemCost[]>([]);

  useEffect(() => {
    setIsLoadingProcessData(true);
    try {
      const storedProcesses = localStorage.getItem(CAPTURED_DATA_LOCAL_STORAGE_KEY);
      if (storedProcesses) {
        const parsedProcesses: CapturedProcess[] = JSON.parse(storedProcesses);
        setCapturedProcesses(parsedProcesses);
      }
    } catch (error) {
      console.error("Error loading process data from localStorage:", error);
    } finally {
      setIsLoadingProcessData(false);
    }
  }, []);
  
  useEffect(() => {
    if (!isLoadingSistemasCostos) {
        setCalculatedSystemCosts(calculateAllSystemAnnualCosts(sistemas, costosSistemas));
    }
  }, [sistemas, costosSistemas, isLoadingSistemasCostos]);

  const dashboardMetrics = useMemo(() => {
    if (isLoadingProcessData || isLoadingActividades || isLoadingAcciones) {
      return {
        procesosMapeadosCount: 0,
        actividadesActivasCount: 0,
        actividadesSinUsoCount: 0,
        accionesCompletadasCount: 0,
        procesosConVariacionesCount: 0,
        actividadesDuplicadasCount: 0,
      };
    }

    const activeProcesses = capturedProcesses.filter(p => !p.deletedAt && p.activo !== false);
    const procesosMapeadosCount = activeProcesses.length;

    const actividadesActivasCount = actividades.filter(a => a.activa).length;
    const actividadesSinUsoCount = actividades.filter(a => a.activa && a.procesosAsociadosCount === 0).length;
    
    const accionesCompletadasCount = acciones.filter(acc => acc.estado === 'Completada').length;

    const processContexts = new Map<string, Set<string>>();
    activeProcesses.forEach(proc => {
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

    const actividadesDuplicadasCount = actividades.filter(act => act.activa && (act.procesosAsociadosCount || 0) > 1).length;

    return {
      procesosMapeadosCount,
      actividadesActivasCount,
      actividadesSinUsoCount,
      accionesCompletadasCount,
      procesosConVariacionesCount,
      actividadesDuplicadasCount,
    };
  }, [capturedProcesses, actividades, acciones, isLoadingProcessData, isLoadingActividades, isLoadingAcciones]);


  const isLoadingAllData = isLoadingProcessData || isLoadingActividades || isLoadingAcciones || isLoadingSistemasCostos;

  const renderMetric = (value: number | string, loading: boolean, icon?: React.ReactNode) => {
    if (loading) {
      return <Loader2 className={`h-5 w-5 animate-spin ${icon ? 'mr-2' : ''}`} />;
    }
    return <>{icon}{value}</>;
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-headline font-bold mb-8 text-primary">Dashboard Ejecutivo</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Procesos Activos Mapeados</CardTitle>
            <Factory className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {renderMetric(dashboardMetrics.procesosMapeadosCount, isLoadingProcessData || isLoadingActividades)}
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
              {renderMetric(dashboardMetrics.procesosConVariacionesCount, isLoadingProcessData)}
            </div>
             <p className="text-xs text-muted-foreground">Mismo nombre de proceso en &gt;1 Área/Puesto.</p>
          </CardContent>
        </Card>
         <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Actividades Duplicadas</CardTitle>
            <CopyCheck className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
                 {renderMetric(dashboardMetrics.actividadesDuplicadasCount, isLoadingActividades)}
            </div>
            <p className="text-xs text-muted-foreground">Actividades asignadas a más de un proceso.</p>
          </CardContent>
        </Card>
        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Acciones Completadas</CardTitle>
            <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {renderMetric(dashboardMetrics.accionesCompletadasCount, isLoadingAcciones)}
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Actividades Activas</CardTitle>
            <ListChecks className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {renderMetric(dashboardMetrics.actividadesActivasCount, isLoadingActividades)}
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Actividades Activas Sin Uso</CardTitle>
            <PackageX className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
               {renderMetric(dashboardMetrics.actividadesSinUsoCount, isLoadingActividades)}
            </div>
          </CardContent>
        </Card>
         <Card className="shadow-lg hover:shadow-xl transition-shadow col-span-1 md:col-span-2 lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ahorro Potencial (Ejemplo)</CardTitle>
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">18%</div>
            <p className="text-xs text-muted-foreground">Estimado $12,500 USD/mes</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-lg">
          <CardHeader>
            <CardTitle>Evolución de Optimización de Procesos</CardTitle>
            <CardDescription>Seguimiento mensual de métricas clave.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center">
            <BarChart3 className="w-24 h-24 text-muted-foreground" />
            <p className="text-muted-foreground ml-4">Gráfico de evolución de procesos (Próximamente)</p>
          </CardContent>
        </Card>
        <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center gap-2">
             <DollarSign className="h-5 w-5 text-primary" />
            <CardTitle>Costos de Sistemas</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="mb-4">Resumen de costos anuales estimados por uso y licencias.</CardDescription>
            {isLoadingAllData ? (
                <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" /> Cargando costos...
                </div>
            ) : calculatedSystemCosts.length === 0 ? (
                <p className="text-muted-foreground text-sm">No hay datos de costos de sistemas configurados.</p>
            ) : (
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead className="w-[30%]">Sistema</TableHead>
                    <TableHead className="text-right">Uso Anual</TableHead>
                    <TableHead className="text-right">Licencias Anual</TableHead>
                    <TableHead className="text-right">Total Anual</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {calculatedSystemCosts.map((cost) => (
                    <TableRow key={cost.id}>
                        <TableCell className="font-medium">{cost.name}</TableCell>
                        <TableCell className="text-right">{formatDashboardCurrency(cost.annualUsageCost, cost.currency)}</TableCell>
                        <TableCell className="text-right">{formatDashboardCurrency(cost.annualLicenseCost, cost.currency)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatDashboardCurrency(cost.totalAnnualCost, cost.currency)}</TableCell>
                    </TableRow>
                    ))}
                </TableBody>
                </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
