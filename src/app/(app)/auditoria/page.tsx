
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { History, Loader2, AlertTriangle, Sparkles } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { generateProcessAudit, type GenerateProcessAuditOutput } from '@/ai/flows/process-audit-generator';

export default function AuditoriaPage() {
  const [processChangesInput, setProcessChangesInput] = useState('');
  const [auditResult, setAuditResult] = useState<GenerateProcessAuditOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateAudit = async () => {
    if (!processChangesInput.trim()) {
      toast({
        title: "Entrada Vacía",
        description: "Por favor, describa los cambios en el proceso para generar la auditoría.",
        variant: "default",
      });
      return;
    }

    setIsLoading(true);
    setError(null);
    setAuditResult(null);

    try {
      const result = await generateProcessAudit({ processChanges: processChangesInput });
      setAuditResult(result);
      toast({
        title: "Auditoría Generada",
        description: "El resumen de auditoría ha sido generado por la IA.",
      });
    } catch (err) {
      console.error("Error during AI audit generation:", err);
      const errorMessage = err instanceof Error ? err.message : "Ocurrió un error desconocido.";
      setError(`Error en la generación de auditoría: ${errorMessage}`);
      toast({
        title: "Error en Auditoría",
        description: "No se pudo generar el resumen de auditoría.",
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
          <History className="h-6 w-6 text-primary" />
          <CardTitle className="text-2xl font-headline">Módulo de Auditoría (Demostración IA)</CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription className="mb-6">
            Esta sección demuestra cómo la IA puede generar un resumen de auditoría textual basado en la descripción de cambios en procesos.
            Ingrese los detalles de los cambios y la IA generará un registro.
          </CardDescription>

          <div className="space-y-4">
            <div>
              <label htmlFor="processChanges" className="block text-sm font-medium text-foreground mb-1">
                Descripción de Cambios en el Proceso:
              </label>
              <Textarea
                id="processChanges"
                placeholder="Ej: El usuario 'Admin' actualizó el proceso 'Incorporación de Clientes' el 01/08/2024, añadiendo un paso de verificación de crédito y eliminando la aprobación manual del gerente de ventas."
                value={processChangesInput}
                onChange={(e) => setProcessChangesInput(e.target.value)}
                className="min-h-[120px]"
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Describa qué proceso cambió, quién hizo el cambio (si se conoce), cuándo ocurrió y qué se modificó.
              </p>
            </div>

            <Button onClick={handleGenerateAudit} disabled={isLoading || !processChangesInput.trim()}>
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {isLoading ? "Generando..." : "Generar Resumen de Auditoría con IA"}
            </Button>

            {error && (
              <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-md text-destructive">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  <h3 className="font-semibold">Error</h3>
                </div>
                <p className="text-sm mt-1">{error}</p>
              </div>
            )}

            {auditResult && !isLoading && (
              <Card>
                <CardHeader>
                  <CardTitle>Resumen de Auditoría Generado por IA</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="whitespace-pre-wrap text-sm bg-muted/50 p-4 rounded-md overflow-x-auto">
                    {auditResult.auditLog || "La IA no generó un resumen de auditoría."}
                  </pre>
                </CardContent>
              </Card>
            )}
             {!auditResult && !isLoading && !error && !processChangesInput.trim() && (
                <div className="mt-6 p-8 border border-dashed border-border rounded-lg flex flex-col items-center justify-center min-h-[200px] bg-muted/20">
                    <History className="h-16 w-16 text-muted-foreground mb-4" />
                    <p className="text-lg font-semibold text-foreground">Listo para generar auditoría</p>
                    <p className="text-sm text-muted-foreground text-center">Ingrese una descripción de los cambios en el proceso para comenzar.</p>
                </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
