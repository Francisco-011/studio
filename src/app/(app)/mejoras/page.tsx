
'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Lightbulb, Sparkles, AlertTriangle, Loader2, Send } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { analyzeProcesses, type AnalyzeProcessesOutput } from '@/ai/flows/ai-powered-inefficiency-detection';
import type { CapturedProcess } from '../procesos-y-flujos-registrados/page';
import { useSistemasCostos, type Sistema, type SistemaCosto, type TipoMoneda } from '@/contexts/SistemasCostosContext';
import { useAcciones, type Accion, type AccionEstado, type Moneda, type TiempoUnidad } from '@/contexts/AccionesContext';
import { useActividades, type Actividad } from '@/contexts/ActividadesContext';
import { usePuestos } from '@/contexts/PuestosContext';

const CAPTURED_DATA_LOCAL_STORAGE_KEY = 'proceza-captured-data';


// Helper function to format currency (simplified for this context)
function formatMejorasCurrency(amount: number | undefined, currency: TipoMoneda | string = "USD"): string {
  if (amount === undefined || isNaN(amount)) return "N/A";
  try {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  } catch (e) {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

// Helper function to calculate annual cost (simplified for this context)
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
  const displayCurrency = costsForSystem[0].moneda; // Use first cost's currency as primary display
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
    } else { // "Otro" - assume it's an annual equivalent or a one-time for simplicity in summary
      periodicCost = baseAmount; 
    }
    
    if (cost.moneda === displayCurrency) {
        totalAnnualCost += periodicCost;
    }

    costDetails.push(
      `Tipo: ${cost.tipoCosto.join('/')}, ` +
      (cost.montoUso ? `Uso: ${formatMejorasCurrency(cost.montoUso, cost.moneda)} ` : '') +
      (cost.numeroLicencias ? `Lic: ${cost.numeroLicencias}x${formatMejorasCurrency(cost.costoPorLicencia, cost.moneda)} ` : '') +
      `(${cost.frecuencia})`
    );
  });

  return { cost: totalAnnualCost, currency: displayCurrency, details: costDetails };
}


export default function MejorasPage() {
  const [analysisResult, setAnalysisResult] = useState<AnalyzeProcessesOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { sistemas, costosSistemas, isLoadingSistemasCostos } = useSistemasCostos();
  const { acciones: allAcciones, addAccion } = useAcciones();
  const { actividades, isLoadingActividades } = useActividades();
  const { puestos, isLoadingPuestos } = usePuestos();


  const handleAnalyzeInefficiencies = async () => {
    setIsLoading(true);
    setError(null);
    setAnalysisResult(null);

    if (isLoadingSistemasCostos || isLoadingActividades || isLoadingPuestos) {
        toast({
            title: "Cargando datos de configuración",
            description: "Espere un momento mientras se cargan los datos de sistemas, puestos y costos.",
            variant: "default",
        });
        setIsLoading(false);
        return;
    }

    try {
      // Load captured processes
      const storedProcessesData = localStorage.getItem(CAPTURED_DATA_LOCAL_STORAGE_KEY);
      const allCapturedProcesses: CapturedProcess[] = storedProcessesData ? JSON.parse(storedProcessesData) : [];
      // Filter for non-deleted and active processes
      const activeProcessesForAnalysis = allCapturedProcesses.filter(p => !p.deletedAt && p.activo !== false);


      if (activeProcessesForAnalysis.length === 0) {
        toast({
          title: "No hay procesos activos para analizar",
          description: "Por favor, asegúrese de tener procesos activos registrados en 'Procesos y Flujos Registrados'.",
          variant: "default",
        });
        setIsLoading(false);
        return;
      }
      
      const relevantActions = allAcciones.filter(a => 
        ['Pendiente', 'En Progreso', 'En Revisión'].includes(a.estado)
      );
      const existingActionsText = relevantActions.length > 0
          ? relevantActions.map(a => `- Acción: "${a.nombre}". Descripción: ${a.descripcion}`).join('\n')
          : undefined;

      const processDescriptionsText = activeProcessesForAnalysis
        .map(p => {
          const puestoData = puestos.find(pst => pst.nombre === p.puesto);
          const puestoInfo = puestoData ? `${p.puesto} (Número de Personas: ${puestoData.numeroPersonas || 'No especificado'})` : p.puesto;

          const associatedActivitiesText = p.activityOrder?.map(actId => {
            const act = actividades.find(a => a.id === actId);
            if (!act) return null;
            return `    - Actividad (ID: ${act.id}): ${act.nombre}\n`;
          }).filter(Boolean).join('');
          
          return `Proceso (ID: ${p.id}): ${p.proceso}\n` +
                 `Área: ${p.area}\n` +
                 `Puesto Principal: ${puestoInfo}\n` +
                 `Descripción: ${p.descripcion}\n` +
                 `Frecuencia: ${p.frecuencia}\n` +
                 `Tiempo Estimado: ${p.tiempoEstimado !== undefined ? p.tiempoEstimado + ' minutos' : 'No especificado'}\n` +
                 `Tiempo Ideal: ${p.tiempoIdeal !== undefined ? p.tiempoIdeal + ' minutos' : 'No especificado'}\n` +
                 `Costo Estimado: ${p.costoEstimado !== undefined ? `${p.costoEstimado} ${p.monedaCosto || ''}` : 'No especificado'}\n`+
                 `Costo Ideal: ${p.costoIdeal !== undefined ? `${p.costoIdeal} ${p.monedaCosto || ''}` : 'No especificado'}\n` +
                 `Sistemas Involucrados: ${p.sistemas && p.sistemas.length > 0 ? p.sistemas.join(', ') : 'Ninguno especificado'}\n` +
                 (associatedActivitiesText ? `  Actividades:\n${associatedActivitiesText}` : '  Actividades: Ninguna definida.');
        })
        .join('\n\n---\n\n');

      const allSystemsUsedInProcesses = new Set<string>();
      activeProcessesForAnalysis.forEach(p => {
        if (p.sistemas) {
          p.sistemas.forEach(sys => allSystemsUsedInProcesses.add(sys));
        }
      });
      const systemUsageText = `Sistemas informáticos utilizados en los procesos documentados: ${
        allSystemsUsedInProcesses.size > 0 ? Array.from(allSystemsUsedInProcesses).join(', ') : 'No se especificaron sistemas en los procesos.'
      }`;

      const allActivitiesText = actividades
        .map(act => {
          const associatedContexts = new Set<string>();
          act.procesosAsociadosIds?.forEach(procId => {
            const proc = activeProcessesForAnalysis.find(p => p.id === procId);
            if (proc) {
              associatedContexts.add(`Proceso: "${proc.proceso}" (Área: ${proc.area}, Puesto: ${proc.puesto})`);
            }
          });

          return `Actividad (ID: ${act.id}): "${act.nombre}"\n` +
                 `  Descripción: ${act.descripcionBreve || 'No disponible'}\n` +
                 `  Contexto de Uso:\n    - ${associatedContexts.size > 0 ? Array.from(associatedContexts).join('\n    - ') : 'No asociada a procesos activos o ninguno especificado.'}`;
        })
        .join('\n\n---\n\n');
      
      let systemCostInformationText = "";
      if (sistemas.length > 0) {
        systemCostInformationText = "Detalles de Costos de Sistemas:\n";
        sistemas.forEach(sistema => {
          const { cost, currency, details } = calculateSystemAnnualCost(sistema.id, costosSistemas, sistemas);
          systemCostInformationText += `Sistema: ${sistema.nombre}\n`;
          if (currency) {
             systemCostInformationText += `  Costo Anual Estimado: ${formatMejorasCurrency(cost, currency)}\n`;
          } else {
             systemCostInformationText += `  Costo Anual Estimado: N/A (datos de costo incompletos o mixtos)\n`;
          }
          systemCostInformationText += `  Costos Registrados:\n    - ${details.join('\n    - ')}\n\n`;
        });
      } else {
        systemCostInformationText = "No se encontró información de costos de sistemas configurada.";
      }

      const result = await analyzeProcesses({
        processDescriptions: processDescriptionsText,
        systemUsage: systemUsageText,
        allActivities: allActivitiesText,
        systemCostInformation: systemCostInformationText,
        existingActions: existingActionsText,
      });

      setAnalysisResult(result);
      toast({
        title: "Análisis Completado",
        description: "Se han identificado posibles mejoras y redundancias, considerando la información de costos y acciones existentes.",
      });

    } catch (err) {
      console.error("Error during AI analysis:", err);
      const errorMessage = err instanceof Error ? err.message : "Ocurrió un error desconocido durante el análisis.";
      setError(`Error en el análisis con IA: ${errorMessage}`);
      toast({
        title: "Error en el Análisis",
        description: "No se pudo completar el análisis de mejoras. Intente de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateProposedActions = () => {
    if (!analysisResult) {
      toast({ title: "Sin Análisis", description: "No hay resultados de análisis para generar acciones.", variant: "default" });
      return;
    }

    let actionsGeneratedCount = 0;
    
    analysisResult.redundantSystems?.forEach(sys => {
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

    analysisResult.duplicateProcesses?.forEach(dup => {
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

    analysisResult.duplicateActivities?.forEach(dup => {
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
          <CardTitle className="text-2xl font-headline">Oportunidades de Mejora</CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription className="mb-6">
            Utilice la IA para analizar los procesos y sistemas registrados para detectar automáticamente duplicidades y oportunidades de mejora. Solo se considerarán procesos marcados como activos y se ignorarán temas ya cubiertos por acciones en revisión/progreso.
          </CardDescription>

          <div className="mb-6 flex flex-wrap gap-2">
            <Button onClick={handleAnalyzeInefficiencies} disabled={isLoading || isLoadingSistemasCostos || isLoadingActividades || isLoadingPuestos} size="lg">
              {isLoading || isLoadingSistemasCostos || isLoadingActividades || isLoadingPuestos ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-5 w-5" />
              )}
              {isLoading || isLoadingSistemasCostos || isLoadingActividades || isLoadingPuestos ? "Analizando..." : "Analizar Ineficiencias con IA"}
            </Button>
            {analysisResult && !isLoading && (
                 <Button onClick={handleGenerateProposedActions} variant="outline" size="lg">
                    <Send className="mr-2 h-5 w-5" />
                    Generar Acciones Propuestas
                </Button>
            )}
          </div>

          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error en el Análisis</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {analysisResult && !isLoading && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Resumen del Análisis de IA</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{analysisResult.summary || "No se generó un resumen."}</p>
                </CardContent>
              </Card>

              {analysisResult.duplicateProcesses && analysisResult.duplicateProcesses.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Procesos Duplicados Potenciales</CardTitle>
                  </CardHeader>
                  <CardContent>
                     <ul className="list-disc pl-5 space-y-2 text-sm">
                        {analysisResult.duplicateProcesses.map((dup, index) => (
                          <li key={index}>
                            <strong>{dup.processA} y {dup.processB}:</strong> {dup.reason}
                          </li>
                        ))}
                      </ul>
                  </CardContent>
                </Card>
              )}

              {analysisResult.duplicateActivities && analysisResult.duplicateActivities.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Actividades Duplicadas Potenciales</CardTitle>
                  </CardHeader>
                  <CardContent>
                     <ul className="list-disc pl-5 space-y-2 text-sm">
                        {analysisResult.duplicateActivities.map((dup, index) => (
                          <li key={index}>
                            <strong>Actividad A:</strong> {dup.activityA} (en {dup.areaA || 'N/A'} / {dup.puestoA || 'N/A'})<br />
                            <strong>Actividad B:</strong> {dup.activityB} (en {dup.areaB || 'N/A'} / {dup.puestoB || 'N/A'})<br />
                            <strong>Razón:</strong> {dup.reason}
                          </li>
                        ))}
                      </ul>
                  </CardContent>
                </Card>
              )}
              
              {analysisResult.redundantSystems && analysisResult.redundantSystems.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Sistemas Redundantes Potenciales</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc pl-5 space-y-2 text-sm">
                      {analysisResult.redundantSystems.map((sys, index) => (
                        <li key={index}>
                          <strong>{sys.systemName}:</strong> {sys.reason}
                           {sys.annualCost && (
                            <span className="text-muted-foreground text-xs block">
                              Costo Anual Estimado: {formatMejorasCurrency(sys.annualCost, sys.currency as TipoMoneda)}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

            </div>
          )}

          {!analysisResult && !isLoading && !error && (
             <div className="mt-10 p-8 border border-dashed border-border rounded-lg flex flex-col items-center justify-center min-h-[200px] bg-muted/20">
                <Sparkles className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-lg font-semibold text-foreground">Listo para el Análisis</p>
                <p className="text-sm text-muted-foreground text-center">Haga clic en el botón "Analizar Ineficiencias con IA" para comenzar.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
