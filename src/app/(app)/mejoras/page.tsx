
'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Lightbulb, Sparkles, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { analyzeProcesses, type AnalyzeProcessesOutput } from '@/ai/flows/ai-powered-inefficiency-detection';
import type { CapturedProcess } from '../procesos-y-flujos-registrados/page';
import { useSistemasCostos, type Sistema, type SistemaCosto, type TipoMoneda } from '@/contexts/SistemasCostosContext';

const CAPTURED_DATA_LOCAL_STORAGE_KEY = 'proceza-captured-data';


// Helper function to format currency (simplified for this context)
function formatMejorasCurrency(amount: number | undefined, currency: TipoMoneda = "USD"): string {
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

  const handleAnalyzeInefficiencies = async () => {
    setIsLoading(true);
    setError(null);
    setAnalysisResult(null);

    if (isLoadingSistemasCostos) {
        toast({
            title: "Cargando datos de configuración",
            description: "Espere un momento mientras se cargan los datos de sistemas y costos.",
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

      const processDescriptionsText = activeProcessesForAnalysis
        .map(p =>
          `Proceso: ${p.proceso}\n` +
          `Área: ${p.area}\n` +
          `Puesto Principal: ${p.puesto}\n` +
          `Descripción: ${p.descripcion}\n` +
          `Frecuencia: ${p.frecuencia}\n` +
          `Tiempo Estimado: ${p.tiempoEstimado !== undefined ? p.tiempoEstimado + ' minutos' : 'No especificado'}\n`+
          `Sistemas Involucrados: ${p.sistemas && p.sistemas.length > 0 ? p.sistemas.join(', ') : 'Ninguno especificado'}`
        )
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
        systemCostInformation: systemCostInformationText,
      });

      setAnalysisResult(result);
      toast({
        title: "Análisis Completado",
        description: "Se han identificado posibles mejoras y redundancias, considerando la información de costos.",
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

  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center gap-2">
          <Lightbulb className="h-6 w-6 text-primary" />
          <CardTitle className="text-2xl font-headline">Oportunidades de Mejora</CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription className="mb-6">
            Utilice la IA para analizar los procesos y sistemas registrados, incluyendo sus costos, para detectar automáticamente ineficiencias, duplicidades y oportunidades de mejora. Solo se considerarán procesos marcados como activos.
          </CardDescription>

          <div className="mb-6">
            <Button onClick={handleAnalyzeInefficiencies} disabled={isLoading || isLoadingSistemasCostos} size="lg">
              {isLoading || isLoadingSistemasCostos ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-5 w-5" />
              )}
              {isLoading || isLoadingSistemasCostos ? "Analizando..." : "Analizar Ineficiencias con IA"}
            </Button>
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

              <Card>
                <CardHeader>
                  <CardTitle>Procesos Duplicados Potenciales</CardTitle>
                </CardHeader>
                <CardContent>
                  {analysisResult.duplicateProcesses && analysisResult.duplicateProcesses.trim() !== "" ? (
                    <p className="text-sm whitespace-pre-wrap">{analysisResult.duplicateProcesses}</p>
                  ): (
                    <p className="text-sm text-muted-foreground">No se identificaron procesos duplicados potenciales claros.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Sistemas Redundantes Potenciales (considerando costos)</CardTitle>
                </CardHeader>
                <CardContent>
                 {analysisResult.redundantSystems && analysisResult.redundantSystems.trim() !== "" ? (
                    <p className="text-sm whitespace-pre-wrap">{analysisResult.redundantSystems}</p>
                  ): (
                    <p className="text-sm text-muted-foreground">No se identificaron sistemas redundantes potenciales claros.</p>
                  )}
                </CardContent>
              </Card>
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
