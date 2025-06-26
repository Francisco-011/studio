
'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Layers, CopyCheck, PackageX, Brain, AreaChart, UserSquare2, Users, Factory } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import type { CapturedProcess } from '../../procesos-y-flujos-registrados/page';
import { useActividades, type Actividad } from '@/contexts/ActividadesContext';
import { useAreas } from '@/contexts/AreasContext';
import { useDepartamentos } from '@/contexts/DepartamentosContext';
import { usePuestos } from '@/contexts/PuestosContext';
import { summarizeEntity, type SummarizeEntityOutput } from '@/ai/flows/ai-powered-inefficiency-detection';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from '@/components/ui/button';

const CAPTURED_DATA_LOCAL_STORAGE_KEY = 'proceza-captured-data';

const renderMetric = (value: number | string, loading: boolean) => {
  if (loading) {
    return <Loader2 className={`h-5 w-5 animate-spin`} />;
  }
  return value;
}


export default function ProcesosDashboardPage() {
  const [allCapturedProcesses, setAllCapturedProcesses] = useState<CapturedProcess[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const { actividades: globalActividades, isLoadingActividades } = useActividades();
  const { areas, isLoading: isLoadingAreas } = useAreas();
  const { departamentos, isLoading: isLoadingDepartamentos } = useDepartamentos();
  const { puestos, isLoadingPuestos } = usePuestos();
  
  const [selectedEntityType, setSelectedEntityType] = useState<'area' | 'puesto' | 'none'>('none');
  const [selectedEntityName, setSelectedEntityName] = useState<string>('');
  const [generatedSummary, setGeneratedSummary] = useState<string>('');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState<boolean>(false);
  const [entityList, setEntityList] = useState<{id: string, name: string}[]>([]);
  
   useEffect(() => {
    setIsLoadingData(true);
    try {
      const storedProcesses = localStorage.getItem(CAPTURED_DATA_LOCAL_STORAGE_KEY);
      if (storedProcesses) {
        setAllCapturedProcesses(JSON.parse(storedProcesses));
      }
    } catch (error) {
      console.error("Error loading data from localStorage:", error);
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (selectedEntityType === 'area' && !isLoadingAreas) {
      setEntityList(areas.map(a => ({ id: a.id, name: a.nombre })).sort((a,b) => a.name.localeCompare(b.name)));
      setSelectedEntityName('');
    } else if (selectedEntityType === 'puesto' && !isLoadingPuestos) {
      setEntityList(puestos.map(p => ({ id: p.id, name: p.nombre })).sort((a,b) => a.name.localeCompare(b.name)));
      setSelectedEntityName('');
    } else {
      setEntityList([]);
      setSelectedEntityName('');
    }
  }, [selectedEntityType, areas, puestos, isLoadingAreas, isLoadingPuestos]);


  const dashboardMetrics = useMemo(() => {
    if (isLoadingData || isLoadingActividades) {
      return {
        procesosMapeadosCount: 0,
        procesosConVariacionesCount: 0,
        actividadesDuplicadasCount: 0,
        procesosSinActividadesCount: 0,
      };
    }
    const processes = allCapturedProcesses.filter(p => p.activo !== false && !p.deletedAt);
    const activeActivities = globalActividades.filter(a => a.activa);

    const processContexts = new Map<string, Set<string>>();
    processes.forEach(proc => {
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

    return {
      procesosMapeadosCount: processes.length,
      actividadesDuplicadasCount: activeActivities.filter(act => (act.procesosAsociadosCount || 0) > 1).length,
      procesosSinActividadesCount: processes.filter(proc => !proc.activityOrder || proc.activityOrder.length === 0).length,
      procesosConVariacionesCount,
    };
  }, [allCapturedProcesses, globalActividades, isLoadingData, isLoadingActividades]);

  const staffSummary = useMemo(() => {
    if (isLoadingAreas || isLoadingPuestos || isLoadingDepartamentos) {
        return { total: 0, breakdown: [] };
    }

    const total = puestos.reduce((acc, puesto) => acc + (puesto.numeroPersonas || 0), 0);
    const breakdownByArea: Map<string, { areaName: string; totalInArea: number; deptos: { deptoName: string, deptoId: string, totalInDepto: number, puestos: { puestoName: string; puestoId: string; count: number }[] }[] }> = new Map();

    areas.forEach(area => {
        breakdownByArea.set(area.id, { areaName: area.nombre, totalInArea: 0, deptos: [] });
    });

    puestos.forEach(puesto => {
        const areaId = puesto.areaId;
        const areaData = breakdownByArea.get(areaId);
        if (areaData) {
            areaData.totalInArea += (puesto.numeroPersonas || 0);
            let deptoData = areaData.deptos.find(d => d.deptoId === (puesto.departamentoId || 'unassigned'));
            if (!deptoData) {
                const deptoName = departamentos.find(d => d.id === puesto.departamentoId)?.nombre || "Sin Departamento Asignado";
                deptoData = { deptoName, deptoId: puesto.departamentoId || 'unassigned', totalInDepto: 0, puestos: [] };
                areaData.deptos.push(deptoData);
            }
            deptoData.totalInDepto += (puesto.numeroPersonas || 0);
            deptoData.puestos.push({ puestoName: puesto.nombre, puestoId: puesto.id, count: puesto.numeroPersonas || 0 });
        }
    });
    
    const finalBreakdown = Array.from(breakdownByArea.values()).filter(area => area.totalInArea > 0).sort((a,b) => b.totalInArea - a.totalInArea);
    finalBreakdown.forEach(area => {
        area.deptos.sort((a, b) => b.totalInDepto - a.totalInDepto);
        area.deptos.forEach(depto => depto.puestos.sort((a,b) => b.count - a.count));
    });
    return { total, breakdown: finalBreakdown };
  }, [areas, departamentos, puestos, isLoadingAreas, isLoadingDepartamentos, isLoadingPuestos]);

  const handleGenerateSummary = async () => {
    if (selectedEntityType === 'none' || !selectedEntityName) {
      toast({ title: "Selección Incompleta", description: "Por favor, seleccione un tipo de entidad y un nombre.", variant: "default" });
      return;
    }
    setIsGeneratingSummary(true);
    setGeneratedSummary('');

    try {
      let relevantProcesses: CapturedProcess[];
      if (selectedEntityType === 'area') {
        relevantProcesses = allCapturedProcesses.filter(p => !p.deletedAt && p.area === selectedEntityName);
      } else {
        relevantProcesses = allCapturedProcesses.filter(p => !p.deletedAt && p.puesto === selectedEntityName);
      }

      if (relevantProcesses.length === 0) {
        setGeneratedSummary(`No se encontraron procesos capturados para ${selectedEntityType === 'area' ? 'el área' : 'el puesto'} "${selectedEntityName}".`);
        setIsGeneratingSummary(false);
        return;
      }

      const processDataString = relevantProcesses.map(proc => {
        const activitiesString = (proc.activityOrder || []).map(actId => globalActividades.find(a => a.id === actId)?.nombre).filter(Boolean).join(', ');
        return `Proceso: ${proc.proceso}\nDescripción: ${proc.descripcion}\n` + (activitiesString ? `Actividades Clave: ${activitiesString}\n` : '');
      }).join('\n---\n');

      const result: SummarizeEntityOutput = await summarizeEntity({
        entityType: selectedEntityType,
        entityName: selectedEntityName,
        processData: processDataString,
      });
      setGeneratedSummary(result.summary);

    } catch (error) {
      console.error("Error generating summary:", error);
      toast({ title: "Error al generar resumen", variant: "destructive" });
      setGeneratedSummary("Error al generar el resumen. Intente nuevamente.");
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const isLoadingAll = isLoadingData || isLoadingActividades || isLoadingAreas || isLoadingPuestos || isLoadingDepartamentos;

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-headline font-bold text-primary mb-2">Dashboard: Procesos y Eficiencia</h1>
        <p className="text-muted-foreground">Analice la salud, estructura y eficiencia de sus procesos operativos y personal.</p>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Procesos Mapeados</CardTitle><Factory className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{renderMetric(dashboardMetrics.procesosMapeadosCount, isLoadingAll)}</div></CardContent>
        </Card>
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Procesos con Variaciones</CardTitle><Layers className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{renderMetric(dashboardMetrics.procesosConVariacionesCount, isLoadingAll)}</div></CardContent>
        </Card>
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Actividades Duplicadas</CardTitle><CopyCheck className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{renderMetric(dashboardMetrics.actividadesDuplicadasCount, isLoadingAll)}</div></CardContent>
        </Card>
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Procesos sin Actividades</CardTitle><PackageX className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{renderMetric(dashboardMetrics.procesosSinActividadesCount, isLoadingAll)}</div></CardContent>
        </Card>
      </div>

       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
         <Card className="shadow-lg">
          <CardHeader className="flex flex-row items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle>Distribución de Personal</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="mb-4">Resumen del personal total y desglose por área y puesto.</CardDescription>
            <div className="text-2xl font-bold mb-4">Total: {renderMetric(staffSummary.total, isLoadingAll)} personas</div>
            {isLoadingAll ? (<div className="flex items-center justify-center p-4"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>) : 
             staffSummary.breakdown.length === 0 ? (<p className="text-muted-foreground text-sm">No hay datos de personal.</p>) : (
                <Accordion type="multiple" className="w-full max-h-[400px] overflow-y-auto">
                {staffSummary.breakdown.map(areaData => (
                    <AccordionItem value={areaData.areaName} key={areaData.areaName}>
                        <AccordionTrigger><div className="flex justify-between w-full pr-4 items-center"><span className="font-semibold">{areaData.areaName}</span><Badge>{areaData.totalInArea} personas</Badge></div></AccordionTrigger>
                        <AccordionContent>
                           {areaData.deptos.length > 0 ? (
                            <Accordion type="multiple" className="w-full pl-4" collapsible>
                                {areaData.deptos.map(deptoData => (
                                    <AccordionItem value={deptoData.deptoId} key={deptoData.deptoId}>
                                        <AccordionTrigger className="text-sm"><div className="flex justify-between w-full pr-4 items-center"><span className="font-medium">{deptoData.deptoName}</span><Badge variant="secondary">{deptoData.totalInDepto} personas</Badge></div></AccordionTrigger>
                                        <AccordionContent>
                                            <Table><TableHeader><TableRow><TableHead>Puesto</TableHead><TableHead className="text-right w-[150px]">Nº Personas</TableHead></TableRow></TableHeader>
                                                <TableBody>{deptoData.puestos.map(puesto => (<TableRow key={puesto.puestoId}><TableCell>{puesto.puestoName}</TableCell><TableCell className="text-right">{puesto.count}</TableCell></TableRow>))}</TableBody>
                                            </Table>
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                           ) : ( <p className="text-sm text-muted-foreground p-4">No hay departamentos con personal asignado en esta área.</p> )}
                        </AccordionContent>
                    </AccordionItem>
                ))}
                </Accordion>
            )}
          </CardContent>
        </Card>
        <Card className="shadow-lg">
          <CardHeader><div className="flex items-center gap-2"><Brain className="h-6 w-6 text-primary" /><CardTitle>Análisis de Entidad por IA</CardTitle></div><CardDescription>Seleccione un área o puesto para obtener un resumen de sus funciones.</CardDescription></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 items-end">
                <div><label htmlFor="entityTypeSelect" className="text-sm font-medium">Tipo</label><Select value={selectedEntityType} onValueChange={(v: 'area'|'puesto'|'none') => { setSelectedEntityType(v); setSelectedEntityName(''); setGeneratedSummary(''); }}><SelectTrigger id="entityTypeSelect"><SelectValue placeholder="Seleccione..." /></SelectTrigger><SelectContent><SelectItem value="none" disabled>Seleccione tipo...</SelectItem><SelectItem value="area"><AreaChart className="inline-block h-4 w-4 mr-2" />Área</SelectItem><SelectItem value="puesto"><UserSquare2 className="inline-block h-4 w-4 mr-2" />Puesto</SelectItem></SelectContent></Select></div>
                <div className="md:col-span-2"><label htmlFor="entityNameSelect" className="text-sm font-medium">Nombre</label><Select value={selectedEntityName} onValueChange={setSelectedEntityName} disabled={selectedEntityType === 'none' || isLoadingAll || entityList.length === 0}><SelectTrigger id="entityNameSelect"><SelectValue placeholder={selectedEntityType === 'none' ? "Seleccione tipo" : "Seleccione nombre..."} /></SelectTrigger><SelectContent>{entityList.map(e => (<SelectItem key={e.id} value={e.name}>{e.name}</SelectItem>))}</SelectContent></Select></div>
            </div>
            <Button onClick={handleGenerateSummary} disabled={isGeneratingSummary || selectedEntityType === 'none' || !selectedEntityName} className="w-full mb-4">{isGeneratingSummary ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Brain className="mr-2 h-4 w-4" />}Generar Resumen</Button>
            {isGeneratingSummary && (<div className="flex items-center justify-center p-4"><Loader2 className="h-6 w-6 animate-spin text-primary" /><p className="ml-2">Generando...</p></div>)}
            {generatedSummary && !isGeneratingSummary && (
                <div><h4 className="font-semibold mb-2">Resumen Generado:</h4><Textarea value={generatedSummary} readOnly className="min-h-[150px] bg-muted/50" rows={8}/></div>
            )}
          </CardContent>
        </Card>
       </div>
    </div>
  );
}
