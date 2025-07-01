
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, FileText, BarChart, Percent, CalendarX, AlertTriangle } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from '@/components/ui/button';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';

import { usePoliticas } from '@/contexts/PoliticasContext';
import { useProcesos } from '@/contexts/ProcesosContext';
import { useAreas } from '@/contexts/AreasContext';

import { format, parseISO, isValid, addDays } from 'date-fns';
import { es } from 'date-fns/locale';

const renderMetric = (value: number | string, loading: boolean) => {
  if (loading) {
    return <Loader2 className="h-5 w-5 animate-spin" />;
  }
  return value;
}

export default function PoliticasDashboardPage() {
  const { politicas, isLoadingPoliticas } = usePoliticas();
  const { procesos, isLoadingProcesos } = useProcesos();
  const { areas, isLoading: isLoadingAreas } = useAreas();

  const isLoading = isLoadingPoliticas || isLoadingProcesos || isLoadingAreas;

  const dashboardMetrics = useMemo(() => {
    if (isLoading) {
      return {
        totalPoliticas: 0,
        coberturaProcesos: 0,
        politicasPorVencer: 0,
      };
    }
    const ninetyDaysFromNow = addDays(new Date(), 90);
    const politicasAprobadas = politicas.filter(p => p.estado === 'Aprobada');

    const politicasPorVencer = politicasAprobadas.filter(p => {
      const fechaRevision = parseISO(p.fechaRevision);
      return isValid(fechaRevision) && fechaRevision <= ninetyDaysFromNow;
    }).length;

    const politicasAprobadasIds = new Set(politicasAprobadas.map(p => p.id));
    const procesosConPoliticasAprobadas = procesos.filter(p => 
        p.politicasAsociadasIds && p.politicasAsociadasIds.some(id => politicasAprobadasIds.has(id))
    ).length;
    
    const coberturaProcesos = procesos.length > 0 ? (procesosConPoliticasAprobadas / procesos.length) * 100 : 0;
    
    return {
      totalPoliticas: politicasAprobadas.length,
      coberturaProcesos: coberturaProcesos,
      politicasPorVencer: politicasPorVencer,
    };
  }, [politicas, procesos, isLoading]);


  const complianceChartData = useMemo(() => {
    if (isLoading) return [];
    const complianceCount = politicas.filter(p => p.estado === 'Aprobada').reduce((acc, p) => {
      acc[p.nivelCompliance] = (acc[p.nivelCompliance] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(complianceCount).map(([name, value], index) => ({
      name,
      value,
      fill: `hsl(var(--chart-${index + 1}))`
    }));
  }, [politicas, isLoading]);

  const complianceChartConfig = useMemo(() => {
    return complianceChartData.reduce((acc, entry) => {
        acc[entry.name] = { label: entry.name, color: entry.fill };
        return acc;
    }, {} as ChartConfig);
  }, [complianceChartData]);


  const areaChartData = useMemo(() => {
    if (isLoading) return [];
    const areaCount = politicas.filter(p => p.estado === 'Aprobada').reduce((acc, p) => {
      const areaName = p.areaResponsable || 'Sin Área';
      acc[areaName] = (acc[areaName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(areaCount).map(([name, value]) => ({ name, value }));
  }, [politicas, isLoading]);

  const areaChartConfig = {
    value: { label: "Políticas", color: "hsl(var(--chart-1))" },
  } satisfies ChartConfig;


  const expiringPolicies = useMemo(() => {
    if (isLoading) return [];
    const ninetyDaysFromNow = addDays(new Date(), 90);
    return politicas
      .filter(p => p.estado === 'Aprobada')
      .filter(p => {
        const fechaRevision = parseISO(p.fechaRevision);
        return isValid(fechaRevision) && fechaRevision <= ninetyDaysFromNow;
      }).sort((a,b) => parseISO(a.fechaRevision).getTime() - parseISO(b.fechaRevision).getTime());
  }, [politicas, isLoading]);


  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-headline font-bold text-primary mb-2">Dashboard: Políticas y Cumplimiento</h1>
        <p className="text-muted-foreground">Análisis sobre la cobertura, estado y distribución de las políticas de la organización.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total de Políticas Aprobadas</CardTitle><FileText className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{renderMetric(dashboardMetrics.totalPoliticas, isLoading)}</div></CardContent>
        </Card>
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Cobertura de Procesos</CardTitle><Percent className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{renderMetric(`${dashboardMetrics.coberturaProcesos.toFixed(1)}%`, isLoading)}</div></CardContent>
        </Card>
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Políticas Próximas a Vencer</CardTitle><CalendarX className="h-4 w-4 text-destructive" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{renderMetric(dashboardMetrics.politicasPorVencer, isLoading)}</div></CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Distribución por Nivel de Cumplimiento</CardTitle>
          </CardHeader>
          <CardContent className="min-h-[300px]">
            {isLoading ? <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin"/></div> :
            complianceChartData.length > 0 ? (
                <ChartContainer config={complianceChartConfig} className="min-h-[250px] w-full">
                    <ResponsiveContainer>
                        <PieChart>
                            <Tooltip content={<ChartTooltipContent hideLabel />} />
                            <Pie data={complianceChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                                {complianceChartData.map((entry) => (<Cell key={entry.name} fill={entry.fill} />))}
                            </Pie>
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </ChartContainer>
            ) : (<div className="flex items-center justify-center h-full"><p className="text-muted-foreground">No hay datos para mostrar.</p></div>)}
          </CardContent>
        </Card>
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Distribución por Área Responsable</CardTitle>
          </CardHeader>
          <CardContent className="min-h-[300px]">
            {isLoading ? <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin"/></div> :
             areaChartData.length > 0 ? (
                <ChartContainer config={areaChartConfig} className="min-h-[250px] w-full">
                    <ResponsiveContainer>
                        <BarChart data={areaChartData} layout="vertical" margin={{ left: 20 }}>
                            <CartesianGrid horizontal={false} />
                            <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={100} />
                            <XAxis type="number" hide />
                            <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} content={<ChartTooltipContent />} />
                            <Bar dataKey="value" layout="vertical" radius={4}>
                               {areaChartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={`hsl(var(--chart-${index + 1}))`} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </ChartContainer>
             ) : (<div className="flex items-center justify-center h-full"><p className="text-muted-foreground">No hay datos para mostrar.</p></div>)}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
            <CardTitle>Alertas: Políticas Próximas a Vencer</CardTitle>
            <CardDescription>Políticas aprobadas cuya fecha de revisión es en los próximos 90 días.</CardDescription>
        </CardHeader>
        <CardContent>
             {isLoading ? <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin"/></div> :
             expiringPolicies.length > 0 ? (
                <div className="max-h-[400px] overflow-y-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Código</TableHead>
                                <TableHead>Título de Política</TableHead>
                                <TableHead>Área Responsable</TableHead>
                                <TableHead className="text-right">Fecha de Revisión</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {expiringPolicies.map(p => (
                                <TableRow key={p.id}>
                                    <TableCell className="font-mono text-xs">{p.codigo}</TableCell>
                                    <TableCell>{p.titulo}</TableCell>
                                    <TableCell>{p.areaResponsable}</TableCell>
                                    <TableCell className="text-right">
                                        <Badge variant="destructive">
                                            {format(parseISO(p.fechaRevision), 'dd MMM, yyyy', {locale: es})}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
             ) : (<div className="text-center p-8 bg-muted/30 rounded-lg"><p className="text-muted-foreground">¡Excelente! No hay políticas próximas a vencer.</p></div>)}
        </CardContent>
      </Card>

    </div>
  );
}
