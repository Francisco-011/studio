
'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { History, Loader2, AlertTriangle, Sparkles, ListOrdered } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { generateProcessAudit, type GenerateProcessAuditOutput } from '@/ai/flows/process-audit-generator';

interface SimulatedAuditEntry {
  id: string;
  timestamp: string; 
  user: string;
  module: string;
  action: string; 
  details: string; 
}

const mockAuditLog: SimulatedAuditEntry[] = [
  { id: '1', timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), user: 'ana.perez@example.com', module: 'Procesos y Flujos Registrados', action: 'Creación', details: 'Se creó el proceso "Incorporación de Nuevos Clientes" (ID: proc_123).' },
  { id: '2', timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), user: 'luis.fernandez@example.com', module: 'Actividades', action: 'Actualización', details: 'La actividad "Aprobación de Crédito" (ID: act_456) fue marcada como "Inactiva".' },
  { id: '3', timestamp: new Date(Date.now() - 0.5 * 60 * 60 * 1000).toISOString(), user: 'ana.perez@example.com', module: 'Usuarios', action: 'Actualización', details: 'El rol del usuario "carlos.sanchez@example.com" cambió de "Usuario Final" a "Consultor".' },
  { id: '4', timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), user: 'sistema', module: 'Sistema', action: 'Mantenimiento', details: 'Respaldo de base de datos programado completado exitosamente.' },
  { id: '5', timestamp: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString(), user: 'sofia.martinez@example.com', module: 'Acciones', action: 'Eliminación', details: 'Se eliminó la acción de mejora "Optimizar CRM" (ID: acc_789).' },
];


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
          <CardTitle className="text-2xl font-headline">Módulo de Auditoría</CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription className="mb-6">
            Herramientas y registros para el seguimiento de cambios y actividades en el sistema.
          </CardDescription>

          <Tabs defaultValue="ai-generator" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="ai-generator">
                <Sparkles className="mr-2 h-4 w-4" /> Generador de Auditoría IA
              </TabsTrigger>
              <TabsTrigger value="simulated-log">
                <ListOrdered className="mr-2 h-4 w-4" /> Registro de Actividad (Simulado)
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ai-generator">
              <Card>
                <CardHeader>
                  <CardTitle>Generador de Resumen de Auditoría con IA</CardTitle>
                  <CardDescription>
                    Esta herramienta utiliza IA para generar un resumen de auditoría textual basado en la descripción de cambios que usted proporcione.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
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
                    {isLoading ? "Generando..." : "Generar Resumen de Auditoría"}
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
                        <CardTitle>Resumen de Auditoría Generado</CardTitle>
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
                          <Sparkles className="h-16 w-16 text-muted-foreground mb-4" />
                          <p className="text-lg font-semibold text-foreground">Listo para generar auditoría</p>
                          <p className="text-sm text-muted-foreground text-center">Ingrese una descripción de los cambios en el proceso para comenzar.</p>
                      </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="simulated-log">
              <Card>
                <CardHeader>
                  <CardTitle>Registro de Actividad del Sistema (Simulado)</CardTitle>
                  <CardDescription>
                    Esta es una vista simulada de cómo se vería un registro de auditoría de actividades. Los datos son de ejemplo.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {mockAuditLog.length > 0 ? (
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[180px]">Fecha y Hora</TableHead>
                            <TableHead>Usuario</TableHead>
                            <TableHead>Módulo</TableHead>
                            <TableHead>Acción</TableHead>
                            <TableHead>Detalles</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {mockAuditLog.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map((entry) => (
                            <TableRow key={entry.id}>
                              <TableCell className="text-xs text-muted-foreground">
                                {format(new Date(entry.timestamp), 'dd/MM/yyyy HH:mm:ss', { locale: es })}
                              </TableCell>
                              <TableCell>{entry.user}</TableCell>
                              <TableCell>{entry.module}</TableCell>
                              <TableCell>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                  entry.action === 'Creación' ? 'bg-green-100 text-green-800 dark:bg-green-800/30 dark:text-green-300' :
                                  entry.action === 'Actualización' ? 'bg-blue-100 text-blue-800 dark:bg-blue-800/30 dark:text-blue-300' :
                                  entry.action === 'Eliminación' ? 'bg-red-100 text-red-800 dark:bg-red-800/30 dark:text-red-300' :
                                  'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                                }`}>
                                  {entry.action}
                                </span>
                              </TableCell>
                              <TableCell className="text-sm">{entry.details}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="mt-6 p-8 border border-dashed border-border rounded-lg flex flex-col items-center justify-center min-h-[200px] bg-muted/20">
                        <ListOrdered className="h-16 w-16 text-muted-foreground mb-4" />
                        <p className="text-lg font-semibold text-foreground">No hay entradas de auditoría simuladas</p>
                        <p className="text-sm text-muted-foreground text-center">Este es un ejemplo y no hay datos para mostrar actualmente.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
