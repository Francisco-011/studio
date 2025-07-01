
'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Lightbulb, Sparkles, AlertTriangle, Loader2, Send, Briefcase, CheckCircle, XCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { analyzeProcesses, type AnalyzeProcessesOutput } from '@/ai/flows/ai-powered-inefficiency-detection';
import { analyzeJobProfile, type JobProfileAnalysisOutput } from '@/ai/flows/job-profile-analysis-flow';

import { useProcesos } from '@/contexts/ProcesosContext';
import { useSistemasCostos, type Sistema, type SistemaCosto, type TipoMoneda } from '@/contexts/SistemasCostosContext';
import { useAcciones, type Accion, type AccionEstado, type Moneda, type TiempoUnidad } from '@/contexts/AccionesContext';
import { useActividades, type Actividad } from '@/contexts/ActividadesContext';
import { usePoliticas } from '@/contexts/PoliticasContext';
import { usePuestos } from '@/contexts/PuestosContext';
import { useProcedimientos } from '@/contexts/ProcedimientosContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

function formatMejorasCurrency(amount: number | undefined, currency: TipoMoneda | string = "USD"): string {
  if (amount === undefined || isNaN(amount)) return "N/A";
  try {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  } catch (e) {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function calculateSystemAnnualCost(
  systemId: string,
  allCosts: SistemaCosto[],
  allSistemas: Sistema[]
): { cost: number; currency: TipoMoneda | null, details: string[] } {
  const system = allSistemas.find(s => s.id === systemId);
  if (!system) return { cost: 0, currency: null, details: ["Sistema no encontrado"] };

  const costsForSystem = allCosts.filter(cost => cost.sistemaId === systemId);
  if (costsForSystem.length === 0) return { cost: 0, currency: 'USD', details: ["Sin costos registrados"] };
  
  let totalAnnualCost = 0;
  const displayCurrency = costsForSystem[0].moneda || 'USD'; 
  const costDetails: string[] = [];

  costsForSystem.forEach(cost => {
    const costFromUsage = cost.montoUso || 0;
    const costFromLicenses = (cost.costoPorLicencia || 0) * (cost.numeroLicencias || 0);
    const baseAmount = costFromUsage + costFromLicenses;
    let periodicCost = 0;

    if (cost.frecuencia === "Mensual") {
      periodicCost = baseAmount * 12;
    } else if (cost.frecuencia === "Anual") {
      periodicCost = baseAmount;
    } else { 
      periodicCost = baseAmount; 
    }
    
    if (cost.moneda === displayCurrency) {
        totalAnnualCost += periodicCost;
    }

    costDetails.push(
      `Descripción: ${cost.descripcion}, ` +
      (cost.montoUso ? `Uso: ${formatMejorasCurrency(cost.montoUso, cost.moneda)} ` : '') +
      (cost.numeroLicencias ? `Lic: ${cost.numeroLicencias}x${formatMejorasCurrency(cost.costoPorLicencia, cost.moneda)} ` : '') +
      `(${cost.frecuencia})`
    );
  });

  return { cost: totalAnnualCost, currency: displayCurrency, details: costDetails };
}


export default function MejorasPage() {
  const [inefficiencyAnalysisResult, setInefficiencyAnalysisResult] = useState<AnalyzeProcessesOutput | null>(null);
  const [isInefficiencyLoading, setIsInefficiencyLoading] = useState(false);
  const [inefficiencyError, setInefficiencyError] = useState<string | null>(null);

  const [jobProfileAnalysisResult, setJobProfileAnalysisResult] = useState<JobProfileAnalysisOutput | null>(null);
  const [isJobProfileLoading, setIsJobProfileLoading] = useState(false);
  const [jobProfileError, setJobProfileError] = useState<string | null>(null);
  const [selectedPuestoId, setSelectedPuestoId] = useState<string>('');


  const { sistemas, costosSistemas, isLoadingSistemasCostos } = useSistemasCostos();
  const { acciones: allAcciones, addAccion } = useAcciones();
  const { actividades, isLoadingActividades } = useActividades();
  const { politicas, isLoadingPoliticas } = usePoliticas();
  const { procedimientos, isLoadingProcedimientos } = useProcedimientos();
  const { puestos, isLoadingPuestos } = usePuestos();

  const [isSelectionDialogOpen, setIsSelectionDialogOpen] = useState(false);
  const { procesos, isLoadingProcesos } = useProcesos();

  const [selectedProcessIds, setSelectedProcessIds] = useState<string[]>([]);
  const [selectedActivityIds, setSelectedActivityIds] = useState<string[]>([]);
  const [selectedSystemIds, setSelectedSystemIds] = useState<string[]>([]);


  const runInefficiencyAnalysis = async () => {
    setIsInefficiencyLoading(true);
    setInefficiencyError(null);
    setInefficiencyAnalysisResult(null);
    setIsSelectionDialogOpen(false);

    if (selectedProcessIds.length === 0 && selectedActivityIds.length === 0 && selectedSystemIds.length === 0) {
        toast({
            title: "Nada seleccionado",
            description: "Por favor, seleccione al menos un elemento para analizar.",
            variant: "default",
        });
        setIsInefficiencyLoading(false);
        return;
    }
    
    try {
      const activeProcessesForAnalysis = procesos.filter(p => selectedProcessIds.includes(p.id));
      const activitiesForAnalysis = actividades.filter(a => selectedActivityIds.includes(a.id));
      const systemsForAnalysis = sistemas.filter(s => selectedSystemIds.includes(s.id));

      const relevantActions = allAcciones.filter(a => 
        ['Pendiente', 'En Progreso', 'En Revisión'].includes(a.estado)
      );
      const existingActionsText = relevantActions.length > 0
          ? relevantActions.map(a => `- Acción: "${a.nombre}". Descripción: ${a.descripcion}`).join('\n')
          : undefined;

      const processDescriptionsText = activeProcessesForAnalysis
        .map(p => {
          const deptoInfo = p.departamento ? `Departamento: ${p.departamento}\n` : '';
          const associatedActivitiesText = p.activityOrder?.map(actId => {
            const act = actividades.find(a => a.id === actId);
            if (!act) return null;
            return `    - Actividad (ID: ${act.id}): ${act.nombre}\n`;
          }).filter(Boolean).join('');
          
          return `Proceso (ID: ${p.id}): ${p.proceso}\n` +
                 `Área: ${p.area}\n` +
                 deptoInfo +
                 `Puesto Principal: ${p.puesto}\n` +
                 `Descripción: ${p.descripcion}\n` +
                 `Políticas Vinculadas (IDs): [${p.politicasAsociadas?.map(pol => pol.policyId).join(', ')}]\n` +
                 (associatedActivitiesText ? `  Actividades:\n${associatedActivitiesText}` : '  Actividades: Ninguna definida.');
        })
        .join('\n\n---\n\n');

      const systemUsageText = `Sistemas informáticos utilizados en los procesos seleccionados: ${
        systemsForAnalysis.length > 0 ? systemsForAnalysis.map(s => s.nombre).join(', ') : 'No se seleccionaron sistemas.'
      }`;

      const allActivitiesText = activitiesForAnalysis
        .map(act => {
          return `Actividad (ID: ${act.id}): "${act.nombre}"\n` +
                 `  Descripción: ${act.descripcionBreve || 'No disponible'}\n`
        })
        .join('\n\n---\n\n');
      
      let systemCostInformationText = "";
      if (systemsForAnalysis.length > 0) {
        systemCostInformationText = "Detalles de Costos de Sistemas:\n";
        systemsForAnalysis.forEach(sistema => {
          const { cost, currency, details } = calculateSystemAnnualCost(sistema.id, costosSistemas, sistemas);
          systemCostInformationText += `Sistema: ${sistema.nombre}\n`;
          if (currency) {
             systemCostInformationText += `  Costo Anual Estimado: ${formatMejorasCurrency(cost, currency)}\n`;
          } else {
             systemCostInformationText += `  Costo Anual Estimado: N/A (datos de costo incompletos o mixtos)\n`;
          }
          systemCostInformationText += `  Costos Registrados:\n    - ${details.join('\n    - ')}\n\n`;
        });
      }

      const policyDataText = politicas.map(p => 
        `Política (ID: ${p.id}): "${p.titulo}"\n` +
        `  Descripción: ${p.descripcion}\n` +
        `  Fecha de Revisión: ${p.fechaRevision}\n` +
        `  Vinculada a Procesos (IDs): [${p.procesosAsociadosIds?.join(', ')}]\n` +
        `  Vinculada a Procedimientos (IDs): [${p.procedimientosAsociadosIds?.join(', ')}]\n` +
        `  Vinculada a Actividades (IDs): [${p.actividadesAsociadasIds?.join(', ')}]`
      ).join('\n\n---\n\n');

      const result = await analyzeProcesses({
        processDescriptions: processDescriptionsText || "No se seleccionaron procesos para analizar.",
        systemUsage: systemUsageText,
        allActivities: allActivitiesText || "No se seleccionaron actividades para analizar.",
        systemCostInformation: systemCostInformationText || undefined,
        policyData: policyDataText || undefined,
        existingActions: existingActionsText,
      });

      setInefficiencyAnalysisResult(result);
      toast({
        title: "Análisis Completado",
        description: "Se han identificado posibles mejoras y redundancias.",
      });

    } catch (err) {
      console.error("Error during AI analysis:", err);
      const errorMessage = err instanceof Error ? err.message : "Ocurrió un error desconocido durante el análisis.";
      setInefficiencyError(`Error en el análisis con IA: ${errorMessage}`);
      toast({
        title: "Error en el Análisis",
        description: "No se pudo completar el análisis de mejoras. Intente de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsInefficiencyLoading(false);
    }
  };
  
  const handleRunJobProfileAnalysis = async () => {
    if (!selectedPuestoId) {
        toast({ title: 'Selección requerida', description: 'Por favor, seleccione un puesto para analizar.', variant: 'default' });
        return;
    }
    setIsJobProfileLoading(true);
    setJobProfileError(null);
    setJobProfileAnalysisResult(null);

    try {
        const puestoSeleccionado = puestos.find(p => p.id === selectedPuestoId);
        if (!puestoSeleccionado) {
            throw new Error('Puesto no encontrado.');
        }

        const procesosDelPuesto = procesos.filter(p => p.puesto === puestoSeleccionado.nombre);
        const procedimientosIds = procesosDelPuesto.flatMap(p => p.procedimientoOrder || []);
        const procedimientosDelPuesto = procedimientos.filter(p => procedimientosIds.includes(p.id));
        const actividadesIds = new Set(procedimientosDelPuesto.flatMap(p => p.activityOrder || []));
        
        const actividadesDelPuesto = actividades.filter(a => actividadesIds.has(a.id));

        if (actividadesDelPuesto.length === 0) {
            toast({ title: 'Sin actividades', description: 'El puesto seleccionado no tiene actividades asignadas para analizar.', variant: 'default' });
            setIsJobProfileLoading(false);
            return;
        }

        const actividadesContext = actividadesDelPuesto.map(a => `- ${a.nombre}: ${a.descripcionBreve || 'Sin descripción.'}`).join('\n');

        const result = await analyzeJobProfile({
            puestoNombre: puestoSeleccionado.nombre,
            actividades: actividadesContext,
        });

        setJobProfileAnalysisResult(result);

    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Ocurrió un error desconocido.";
        setJobProfileError(`Error en el análisis de perfil: ${errorMessage}`);
        toast({ title: "Error en el Análisis", description: "No se pudo completar el análisis del perfil.", variant: "destructive" });
    } finally {
        setIsJobProfileLoading(false);
    }
};


  const handleGenerateProposedActions = () => {
    if (!inefficiencyAnalysisResult) {
      toast({ title: "Sin Análisis", description: "No hay resultados de análisis para generar acciones.", variant: "default" });
      return;
    }

    let actionsGeneratedCount = 0;
    
    inefficiencyAnalysisResult.redundantSystems?.forEach(sys => {
      const title = `Evaluar Sistema Redundante: ${sys.systemName}`;
      const description = `Sugerencia de IA: ${sys.reason}. Ahorro anual estimado de ${formatMejorasCurrency(sys.annualCost, sys.currency as TipoMoneda)}.`;

      addAccion({
          nombre: title,
          descripcion: description,
          responsable: 'Por definir',
          estado: 'En Revisión' as AccionEstado,
          origenMejora: 'Análisis IA - Mejoras',
          area: sys.area,
          puesto: sys.puesto,
          procesoId: sys.processId,
          ahorroEstimado: sys.annualCost,
          monedaAhorro: sys.currency as Moneda,
      });
      actionsGeneratedCount++;
    });

    inefficiencyAnalysisResult.duplicateProcesses?.forEach(dup => {
      const title = `Revisar Procesos Duplicados: ${dup.processA} / ${dup.processB}`;
      const description = `Sugerencia de IA: ${dup.reason}. Se sugiere consolidar para ahorrar tiempo y estandarizar.`;
      
      addAccion({
          nombre: title,
          descripcion: description,
          responsable: 'Por definir',
          estado: 'En Revisión' as AccionEstado,
          origenMejora: 'Análisis IA - Mejoras',
          area: dup.areaA,
          puesto: dup.puestoA,
          procesoId: dup.processA_Id
      });
      actionsGeneratedCount++;
    });

    inefficiencyAnalysisResult.duplicateActivities?.forEach(dup => {
      const title = `Revisar Actividades Duplicadas: ${dup.activityA} / ${dup.activityB}`;
      const description = `Sugerencia de IA: ${dup.reason}. Se sugiere revisar y consolidar estas actividades para estandarizar la operación entre las áreas/puestos: (A: ${dup.areaA}/${dup.puestoA}, B: ${dup.areaB}/${dup.puestoB}).`;
      
      addAccion({
          nombre: title,
          descripcion: description,
          responsable: 'Por definir',
          estado: 'En Revisión' as AccionEstado,
          origenMejora: 'Análisis IA - Mejoras',
          actividadId: dup.activityA_Id,
          area: dup.areaA,
          puesto: dup.puestoA,
      });
      actionsGeneratedCount++;
    });

    inefficiencyAnalysisResult.criticalProcessesWithoutPolicies?.forEach(proc => {
        addAccion({
            nombre: `Crear Política para Proceso Crítico: ${proc.processName}`,
            descripcion: `Sugerencia de IA: ${proc.reason}. Se recomienda crear una política que regule este proceso.`,
            responsable: 'Por definir',
            estado: 'En Revisión',
            origenMejora: 'Análisis IA - Políticas',
            area: proc.area,
            puesto: proc.puesto,
            procesoId: proc.processId,
        });
        actionsGeneratedCount++;
    });

    inefficiencyAnalysisResult.obsoletePolicies?.forEach(pol => {
        addAccion({
            nombre: `Revisar Política Obsoleta: ${pol.policyName}`,
            descripcion: `Sugerencia de IA: ${pol.reason}. La fecha de revisión (${pol.reviewDate}) ha pasado.`,
            responsable: 'Por definir',
            estado: 'En Revisión',
            origenMejora: 'Análisis IA - Políticas',
        });
        actionsGeneratedCount++;
    });
    
    inefficiencyAnalysisResult.duplicatePolicySuggestions?.forEach(sug => {
        addAccion({
            nombre: `Consolidar Políticas: ${sug.policyA_Name} / ${sug.policyB_Name}`,
            descripcion: `Sugerencia de IA: ${sug.reason}.`,
            responsable: 'Por definir',
            estado: 'En Revisión',
            origenMejora: 'Análisis IA - Políticas',
        });
        actionsGeneratedCount++;
    });

    if (actionsGeneratedCount > 0) {
      toast({
        title: "Acciones Propuestas Generadas",
        description: `${actionsGeneratedCount} acciones han sido creadas con estado "En Revisión". Revíselas en el módulo de Acciones.`,
        duration: 6000,
      });
    } else {
      toast({
        title: "No se generaron nuevas acciones",
        description: "El análisis de IA no arrojó elementos claros o no cubiertos por acciones existentes.",
        variant: "default"
      });
    }
  };


  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center gap-2">
          <Lightbulb className="h-6 w-6 text-primary" />
          <CardTitle className="text-2xl font-headline">Análisis de Oportunidades con IA</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="ineficiencias">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="ineficiencias">Análisis de Ineficiencias</TabsTrigger>
              <TabsTrigger value="perfil_puesto">Análisis de Perfil de Puesto</TabsTrigger>
            </TabsList>
            <TabsContent value="ineficiencias" className="mt-4">
              <CardDescription className="mb-6">
                Utilice la IA para analizar procesos y sistemas y detectar duplicidades, redundancias y oportunidades de mejora.
              </CardDescription>
              <div className="mb-6 flex flex-wrap gap-2">
                <Button onClick={() => setIsSelectionDialogOpen(true)} disabled={isInefficiencyLoading} size="lg">
                  <Sparkles className="mr-2 h-5 w-5" />
                  Analizar Ineficiencias con IA
                </Button>
                {inefficiencyAnalysisResult && !isInefficiencyLoading && (
                     <Button onClick={handleGenerateProposedActions} variant="outline" size="lg">
                        <Send className="mr-2 h-5 w-5" />
                        Generar Acciones Propuestas
                    </Button>
                )}
              </div>
              
              {isInefficiencyLoading && (
                  <div className="flex items-center justify-center p-8">
                      <Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" />
                      <p className="text-lg text-muted-foreground">Analizando, por favor espere...</p>
                  </div>
              )}

              {inefficiencyError && (
                <Alert variant="destructive" className="mb-6">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Error en el Análisis</AlertTitle>
                  <AlertDescription>{inefficiencyError}</AlertDescription>
                </Alert>
              )}

              {inefficiencyAnalysisResult && !isInefficiencyLoading && (
                <div className="space-y-6">
                  <Card>
                    <CardHeader><CardTitle>Resumen del Análisis de IA</CardTitle></CardHeader>
                    <CardContent><p className="text-sm whitespace-pre-wrap">{inefficiencyAnalysisResult.summary || "No se generó un resumen."}</p></CardContent>
                  </Card>
                  {inefficiencyAnalysisResult.duplicateProcesses?.length > 0 && (
                    <Card><CardHeader><CardTitle>Procesos Duplicados Potenciales</CardTitle></CardHeader>
                      <CardContent><ul className="list-disc pl-5 space-y-2 text-sm">{inefficiencyAnalysisResult.duplicateProcesses.map((dup, index) => (<li key={index}><strong>{dup.processA} y {dup.processB}:</strong> {dup.reason}</li>))}</ul></CardContent>
                    </Card>
                  )}
                  {inefficiencyAnalysisResult.duplicateActivities?.length > 0 && (
                    <Card><CardHeader><CardTitle>Actividades Duplicadas Potenciales</CardTitle></CardHeader>
                      <CardContent><ul className="list-disc pl-5 space-y-2 text-sm">{inefficiencyAnalysisResult.duplicateActivities.map((dup, index) => (<li key={index}><strong>Actividad A:</strong> {dup.activityA} (en {dup.areaA || 'N/A'} / {dup.puestoA || 'N/A'})<br /><strong>Actividad B:</strong> {dup.activityB} (en {dup.areaB || 'N/A'} / {dup.puestoB || 'N/A'})<br /><strong>Razón:</strong> {dup.reason}</li>))}</ul></CardContent>
                    </Card>
                  )}
                  {inefficiencyAnalysisResult.redundantSystems?.length > 0 && (
                    <Card><CardHeader><CardTitle>Sistemas Redundantes Potenciales</CardTitle></CardHeader>
                      <CardContent><ul className="list-disc pl-5 space-y-2 text-sm">{inefficiencyAnalysisResult.redundantSystems.map((sys, index) => (<li key={index}><strong>{sys.systemName}:</strong> {sys.reason} {sys.annualCost && (<span className="text-muted-foreground text-xs block">Costo Anual Estimado: {formatMejorasCurrency(sys.annualCost, sys.currency as TipoMoneda)}</span>)}</li>))}</ul></CardContent>
                    </Card>
                  )}
                  {inefficiencyAnalysisResult.criticalProcessesWithoutPolicies?.length > 0 && (
                    <Card><CardHeader><CardTitle>Procesos Críticos sin Políticas</CardTitle></CardHeader>
                      <CardContent><ul className="list-disc pl-5 space-y-2 text-sm">{inefficiencyAnalysisResult.criticalProcessesWithoutPolicies.map((item, index) => (<li key={index}><strong>{item.processName}</strong> (en {item.area} / {item.puesto}): {item.reason}</li>))}</ul></CardContent>
                    </Card>
                  )}
                  {inefficiencyAnalysisResult.obsoletePolicies?.length > 0 && (
                    <Card><CardHeader><CardTitle>Políticas Obsoletas o por Vencer</CardTitle></CardHeader>
                      <CardContent><ul className="list-disc pl-5 space-y-2 text-sm">{inefficiencyAnalysisResult.obsoletePolicies.map((item, index) => (<li key={index}><strong>{item.policyName}</strong>: {item.reason} (Fecha de Revisión: {item.reviewDate})</li>))}</ul></CardContent>
                    </Card>
                  )}
                  {inefficiencyAnalysisResult.duplicatePolicySuggestions?.length > 0 && (
                    <Card><CardHeader><CardTitle>Sugerencias de Consolidación de Políticas</CardTitle></CardHeader>
                      <CardContent><ul className="list-disc pl-5 space-y-2 text-sm">{inefficiencyAnalysisResult.duplicatePolicySuggestions.map((item, index) => (<li key={index}><strong>{item.policyA_Name} / {item.policyB_Name}</strong>: {item.reason}</li>))}</ul></CardContent>
                    </Card>
                  )}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="perfil_puesto" className="mt-4">
              <CardDescription className="mb-6">
                Seleccione un puesto para generar un perfil de responsabilidades basado en sus actividades asignadas y validar su alineación.
              </CardDescription>
              <div className="flex flex-col sm:flex-row gap-4 items-center mb-6">
                <Select value={selectedPuestoId} onValueChange={setSelectedPuestoId} disabled={isLoadingPuestos}>
                    <SelectTrigger className="w-full sm:w-[300px]">
                        <SelectValue placeholder={isLoadingPuestos ? "Cargando..." : "Seleccione un puesto"}/>
                    </SelectTrigger>
                    <SelectContent>
                        {puestos.map(p => (<SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>))}
                    </SelectContent>
                </Select>
                <Button onClick={handleRunJobProfileAnalysis} disabled={isJobProfileLoading || !selectedPuestoId}>
                  {isJobProfileLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Briefcase className="mr-2 h-4 w-4"/>}
                  Analizar Perfil
                </Button>
              </div>
              {isJobProfileLoading && <div className="flex items-center justify-center p-8"><Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" /><p className="text-lg text-muted-foreground">Analizando perfil...</p></div>}
              {jobProfileError && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertTitle>Error en Análisis</AlertTitle><AlertDescription>{jobProfileError}</AlertDescription></Alert>}
              {jobProfileAnalysisResult && !isJobProfileLoading && (
                <div className="space-y-6">
                    <Card>
                        <CardHeader><CardTitle>Perfil del Puesto Generado por IA</CardTitle></CardHeader>
                        <CardContent><p className="text-sm whitespace-pre-wrap">{jobProfileAnalysisResult.perfilGenerado}</p></CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle>Resumen del Análisis de Alineación</CardTitle></CardHeader>
                        <CardContent><p className="text-sm whitespace-pre-wrap">{jobProfileAnalysisResult.resumenAnalisis}</p></CardContent>
                    </Card>
                    <div className="grid md:grid-cols-2 gap-6">
                        <Card><CardHeader><CardTitle className="flex items-center gap-2"><CheckCircle className="text-green-600"/>Actividades Alineadas</CardTitle></CardHeader>
                            <CardContent>
                                {jobProfileAnalysisResult.actividadesAlineadas?.length > 0 ? 
                                (<ul className="list-disc pl-5 text-sm space-y-1">{jobProfileAnalysisResult.actividadesAlineadas.map((act, i) => <li key={i}>{act}</li>)}</ul>) :
                                (<p className="text-sm text-muted-foreground">No se encontraron actividades claramente alineadas.</p>)}
                            </CardContent>
                        </Card>
                        <Card><CardHeader><CardTitle className="flex items-center gap-2"><XCircle className="text-amber-600"/>Actividades No Alineadas (Potencial de Reasignación)</CardTitle></CardHeader>
                            <CardContent>
                                {jobProfileAnalysisResult.actividadesNoAlineadas?.length > 0 ? 
                                (<ul className="list-disc pl-5 text-sm space-y-1">{jobProfileAnalysisResult.actividadesNoAlineadas.map((act, i) => <li key={i}>{act}</li>)}</ul>) :
                                (<p className="text-sm text-muted-foreground">Todas las actividades parecen estar alineadas.</p>)}
                            </CardContent>
                        </Card>
                    </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      
      <Dialog open={isSelectionDialogOpen} onOpenChange={setIsSelectionDialogOpen}>
          <DialogContent className="sm:max-w-3xl">
              <DialogHeader><DialogTitle>Seleccionar Elementos para Análisis de Ineficiencias</DialogTitle><DialogDescription>Elija qué procesos, actividades y sistemas desea incluir en el análisis.</DialogDescription></DialogHeader>
              <div className="py-4">
                  <Tabs defaultValue="procesos">
                      <TabsList className="grid w-full grid-cols-3"><TabsTrigger value="procesos">Procesos</TabsTrigger><TabsTrigger value="actividades">Actividades</TabsTrigger><TabsTrigger value="sistemas">Sistemas</TabsTrigger></TabsList>
                      <TabsContent value="procesos">
                          <div className="flex justify-end my-2"><Button variant="link" size="sm" onClick={() => setSelectedProcessIds(procesos.map(p => p.id))}>Sel. Todos</Button><Button variant="link" size="sm" onClick={() => setSelectedProcessIds([])}>Desel. Todos</Button></div>
                          <ScrollArea className="h-[400px] border rounded-md p-2"><div className="space-y-2">{procesos.map(proc => (<div key={proc.id} className="flex items-start space-x-2"><Checkbox id={`proc-${proc.id}`} checked={selectedProcessIds.includes(proc.id)} onCheckedChange={(checked) => setSelectedProcessIds(prev => checked ? [...prev, proc.id] : prev.filter(id => id !== proc.id))} className="mt-1"/><label htmlFor={`proc-${proc.id}`} className="text-sm font-medium leading-none cursor-pointer">{proc.proceso}<span className="block text-xs text-muted-foreground">{proc.area} / {proc.puesto}</span></label></div>))}</div></ScrollArea>
                      </TabsContent>
                       <TabsContent value="actividades">
                           <div className="flex justify-end my-2"><Button variant="link" size="sm" onClick={() => setSelectedActivityIds(actividades.filter(a=>a.activa).map(a => a.id))}>Sel. Todas</Button><Button variant="link" size="sm" onClick={() => setSelectedActivityIds([])}>Desel. Todas</Button></div>
                           <ScrollArea className="h-[400px] border rounded-md p-2"><div className="space-y-2">{actividades.filter(a => a.activa).map(act => (<div key={act.id} className="flex items-center space-x-2"><Checkbox id={`act-${act.id}`} checked={selectedActivityIds.includes(act.id)} onCheckedChange={(checked) => setSelectedActivityIds(prev => checked ? [...prev, act.id] : prev.filter(id => id !== act.id))}/><label htmlFor={`act-${act.id}`} className="text-sm font-medium leading-none cursor-pointer">{act.nombre}</label></div>))}</div></ScrollArea>
                      </TabsContent>
                      <TabsContent value="sistemas">
                          <div className="flex justify-end my-2"><Button variant="link" size="sm" onClick={() => setSelectedSystemIds(sistemas.map(s => s.id))}>Sel. Todos</Button><Button variant="link" size="sm" onClick={() => setSelectedSystemIds([])}>Desel. Todos</Button></div>
                           <ScrollArea className="h-[400px] border rounded-md p-2"><div className="space-y-2">{sistemas.map(sys => (<div key={sys.id} className="flex items-center space-x-2"><Checkbox id={`sys-${sys.id}`} checked={selectedSystemIds.includes(sys.id)} onCheckedChange={(checked) => setSelectedSystemIds(prev => checked ? [...prev, sys.id] : prev.filter(id => id !== sys.id))}/><label htmlFor={`sys-${sys.id}`} className="text-sm font-medium leading-none cursor-pointer">{sys.nombre}</label></div>))}</div></ScrollArea>
                      </TabsContent>
                  </Tabs>
              </div>
              <DialogFooter><DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose><Button onClick={runInefficiencyAnalysis}>Analizar Selección ({selectedProcessIds.length + selectedActivityIds.length + selectedSystemIds.length})</Button></DialogFooter>
          </DialogContent>
      </Dialog>
    </div>
  );
}
