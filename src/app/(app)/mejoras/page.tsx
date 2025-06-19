
'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Lightbulb, Sparkles, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { analyzeProcesses, type AnalyzeProcessesOutput } from '@/ai/flows/ai-powered-inefficiency-detection';
import type { CapturedProcess } from '../procesos-y-flujos-registrados/page';

const CAPTURED_DATA_LOCAL_STORAGE_KEY = 'proceza-captured-data';

export default function MejorasPage() {
  const [analysisResult, setAnalysisResult] = useState<AnalyzeProcessesOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyzeInefficiencies = async () => {
    setIsLoading(true);
    setError(null);
    setAnalysisResult(null);

    try {
      const storedData = localStorage.getItem(CAPTURED_DATA_LOCAL_STORAGE_KEY);
      const allCapturedProcesses: CapturedProcess[] = storedData ? JSON.parse(storedData) : [];
      const activeProcesses = allCapturedProcesses.filter(p => !p.deletedAt);

      if (activeProcesses.length === 0) {
        toast({
          title: "No hay procesos para analizar",
          description: "Por favor, registre algunos procesos en el módulo 'Procesos y Flujos Registrados' primero.",
          variant: "default",
        });
        setIsLoading(false);
        return;
      }

      const processDescriptionsText = activeProcesses
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

      const allSystemsUsed = new Set<string>();
      activeProcesses.forEach(p => {
        if (p.sistemas) {
          p.sistemas.forEach(sys => allSystemsUsed.add(sys));
        }
      });
      const systemUsageText = `Sistemas informáticos utilizados en los procesos documentados: ${
        allSystemsUsed.size > 0 ? Array.from(allSystemsUsed).join(', ') : 'No se especificaron sistemas en los procesos.'
      }`;

      const result = await analyzeProcesses({
        processDescriptions: processDescriptionsText,
        systemUsage: systemUsageText,
      });

      setAnalysisResult(result);
      toast({
        title: "Análisis Completado",
        description: "Se han identificado posibles mejoras y redundancias.",
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
            Utilice la IA para analizar los procesos y sistemas registrados, detectando automáticamente ineficiencias, duplicidades y oportunidades de mejora.
          </CardDescription>

          <div className="mb-6">
            <Button onClick={handleAnalyzeInefficiencies} disabled={isLoading} size="lg">
              {isLoading ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-5 w-5" />
              )}
              {isLoading ? "Analizando..." : "Analizar Ineficiencias con IA"}
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
                  <CardTitle>Sistemas Redundantes Potenciales</CardTitle>
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
