
'use client';

import { useState, useEffect, useMemo } from 'react';
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";

import { useAcciones } from '@/contexts/AccionesContext';
import { useActividades, type Actividad } from '@/contexts/ActividadesContext';
import type { CapturedProcess } from '../procesos-y-flujos-registrados/page';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { ClipboardCheck, PlusCircle, Trash2, FileText, Send, AlertTriangle, Loader2, History } from "lucide-react";

const CAPTURED_DATA_LOCAL_STORAGE_KEY = 'proceza-captured-data';

const findingTypes = ["Conforme", "No Conforme", "Oportunidad de Mejora"] as const;
type FindingType = typeof findingTypes[number];

const auditFindingSchema = z.object({
  type: z.enum(findingTypes, { errorMap: () => ({ message: "Seleccione un tipo válido."})}),
  description: z.string().min(10, 'La descripción del hallazgo es requerida (mínimo 10 caracteres).'),
  proposedAction: z.string().optional(),
}).refine(data => {
    if (data.type === 'No Conforme' && (!data.proposedAction || data.proposedAction.length < 10)) {
        return false;
    }
    return true;
}, {
    message: "El plan de acción propuesto es requerido para hallazgos 'No Conforme' (mínimo 10 caracteres).",
    path: ["proposedAction"],
});
type AuditFindingFormData = z.infer<typeof auditFindingSchema>;

interface AuditFinding extends AuditFindingFormData {
  id: string;
  isActionCreated: boolean;
}

const escapeCsvCell = (cellData: string | number | undefined | null): string => {
  if (cellData === undefined || cellData === null) {
    return '';
  }
  const stringValue = String(cellData);
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};


export default function AuditoriaGeneralPage() {
  const { actividades, isLoadingActividades } = useActividades();
  const { addAccion } = useAcciones();

  const [allProcesses, setAllProcesses] = useState<CapturedProcess[]>([]);
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null);
  const [auditFindings, setAuditFindings] = useState<AuditFinding[]>([]);
  const [auditorName, setAuditorName] = useState<string>('Auditor Principal');
  const [auditDate, setAuditDate] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState(true);

  const findingForm = useForm<AuditFindingFormData>({
    resolver: zodResolver(auditFindingSchema),
    defaultValues: {
      type: undefined,
      description: '',
      proposedAction: '',
    },
  });

  useEffect(() => {
    setIsLoading(true);
    try {
      const storedData = localStorage.getItem(CAPTURED_DATA_LOCAL_STORAGE_KEY);
      if (storedData) {
        setAllProcesses(JSON.parse(storedData).filter((p: any) => !p.deletedAt && p.activo !== false));
      }
    } catch (e) {
      console.error("Error loading processes for audit:", e);
      toast({ title: "Error al cargar procesos", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const selectedProcess = useMemo(() => {
    if (!selectedProcessId) return null;
    return allProcesses.find(p => p.id === selectedProcessId) || null;
  }, [selectedProcessId, allProcesses]);
  
  const processActivities = useMemo(() => {
    if (!selectedProcess || !selectedProcess.activityOrder) return [];
    return selectedProcess.activityOrder
        .map(actId => actividades.find(a => a.id === actId))
        .filter((act): act is Actividad => !!act);
  }, [selectedProcess, actividades]);


  const handleProcessSelect = (processId: string) => {
    if (auditFindings.length > 0) {
        if (!window.confirm("Tiene hallazgos sin guardar. ¿Está seguro que desea cambiar de proceso? Se perderán los hallazgos actuales.")) {
            return;
        }
    }
    setSelectedProcessId(processId);
    setAuditFindings([]);
    findingForm.reset();
  };

  const handleAddFinding = (data: AuditFindingFormData) => {
    const newFinding: AuditFinding = {
      ...data,
      id: `${Date.now()}`,
      isActionCreated: false,
    };
    setAuditFindings(prev => [...prev, newFinding]);
    findingForm.reset();
  };
  
  const handleDeleteFinding = (findingId: string) => {
    setAuditFindings(prev => prev.filter(f => f.id !== findingId));
  };
  
  const handleCreateActionPlan = (finding: AuditFinding) => {
    if (!selectedProcess) return;

    addAccion({
      nombre: `Hallazgo en Proceso: ${selectedProcess.proceso}`,
      descripcion: `Descripción del Hallazgo: ${finding.description}\n\nPlan de Acción Propuesto: ${finding.proposedAction}`,
      responsable: 'Por Asignar',
      estado: 'Pendiente',
      origenMejora: `Auditoría - ${auditorName}`,
      procesoId: selectedProcess.id,
      area: selectedProcess.area,
      puesto: selectedProcess.puesto,
    });
    
    setAuditFindings(prev => prev.map(f => f.id === finding.id ? {...f, isActionCreated: true} : f));

    toast({
      title: "Plan de Acción Registrado",
      description: "La acción ha sido creada y puede ser gestionada en el módulo de 'Acciones'.",
    });
  };

  const handleExportReport = () => {
    if (!selectedProcess) {
      toast({ title: "Seleccione un proceso", description: "Debe seleccionar un proceso para auditar antes de exportar.", variant: "default" });
      return;
    }
    if (auditFindings.length === 0) {
      toast({ title: "Sin hallazgos", description: "No hay hallazgos para reportar.", variant: "default" });
      return;
    }

    const headers = ["Sección", "Detalle", "Valor"];
    const csvRows = [
      ["Informe de Auditoría de Proceso"],
      [],
      ["Información General"],
      ["Proceso Auditado", selectedProcess.proceso],
      ["ID del Proceso", selectedProcess.id],
      ["Área", selectedProcess.area],
      ["Puesto", selectedProcess.puesto],
      ["Auditor", auditorName],
      ["Fecha de Auditoría", format(auditDate, 'yyyy-MM-dd')],
      [],
      ["Hallazgos de la Auditoría"],
      ["ID Hallazgo", "Tipo", "Descripción", "Plan de Acción Propuesto", "Plan de Acción Creado"],
      ...auditFindings.map(f => [
        escapeCsvCell(f.id),
        escapeCsvCell(f.type),
        escapeCsvCell(f.description),
        escapeCsvCell(f.proposedAction),
        escapeCsvCell(f.isActionCreated ? 'Sí' : 'No')
      ])
    ];

    const csvString = csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob(["\uFEFF" + csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', `auditoria_${selectedProcess.proceso.replace(/\s+/g, '_')}_${format(auditDate, 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    toast({ title: "Informe Exportado", description: "El informe de auditoría se está descargando." });
  };

  if (isLoading || isLoadingActividades) {
    return (
      <div className="container mx-auto py-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-16 w-16 text-primary animate-spin" />
        <p className="ml-4 text-lg text-muted-foreground">Cargando datos para auditoría...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center gap-2">
          <ClipboardCheck className="h-6 w-6 text-primary" />
          <CardTitle className="text-2xl font-headline">Auditoría y Registro</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="proceso">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="proceso">Auditoría de Procesos</TabsTrigger>
              <TabsTrigger value="actividad">Registro de Actividad del Sistema</TabsTrigger>
            </TabsList>
            
            <TabsContent value="proceso" className="mt-4">
              <CardDescription className="mb-6">
                Realice auditorías de cumplimiento y calidad a los procesos registrados. Seleccione un proceso, revise sus detalles y registre hallazgos. Genere planes de acción para las no conformidades.
              </CardDescription>

              <Card className="mb-6 bg-muted/30">
                <CardHeader>
                  <CardTitle className="text-lg">1. Selección del Proceso a Auditar</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-1">
                    <div className="space-y-2">
                      <div>
                        <Label htmlFor="auditorName">Nombre del Auditor</Label>
                        <Input id="auditorName" value={auditorName} onChange={(e) => setAuditorName(e.target.value)} />
                      </div>
                      <div>
                        <Label htmlFor="processSelect">Proceso a Auditar</Label>
                        <Select onValueChange={handleProcessSelect} value={selectedProcessId || ""}>
                          <SelectTrigger id="processSelect">
                            <SelectValue placeholder="Seleccione un proceso..." />
                          </SelectTrigger>
                          <SelectContent>
                            {allProcesses.length === 0 ? (
                              <SelectItem value="no-proc" disabled>No hay procesos activos para auditar</SelectItem>
                            ): allProcesses.map(p => (
                              <SelectItem key={p.id} value={p.id}>{p.proceso}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    {selectedProcess ? (
                      <div className="space-y-4 p-4 border rounded-md bg-background">
                        <h4 className="font-semibold">{selectedProcess.proceso}</h4>
                        <p className="text-sm text-muted-foreground">{selectedProcess.descripcion}</p>
                        <div className="text-xs">
                            <strong>Área:</strong> {selectedProcess.area} &nbsp;|&nbsp; <strong>Puesto:</strong> {selectedProcess.puesto}
                        </div>
                        <div>
                            <h5 className="font-semibold text-sm mb-2">Actividades del Proceso:</h5>
                            {processActivities.length > 0 ? (
                                <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                                    {processActivities.map(act => <li key={act.id}>{act.nombre}</li>)}
                                </ol>
                            ) : (
                                <p className="text-sm text-muted-foreground italic">Este proceso no tiene actividades detalladas.</p>
                            )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full p-4 border rounded-md border-dashed">
                        <p className="text-muted-foreground">Seleccione un proceso para ver sus detalles.</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {selectedProcess && (
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle className="text-lg">2. Registro de Hallazgos</CardTitle>
                        <Button onClick={handleExportReport} variant="outline" disabled={auditFindings.length === 0}>
                            <FileText className="mr-2 h-4 w-4" /> Exportar Informe
                        </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Form {...findingForm}>
                      <form onSubmit={findingForm.handleSubmit(handleAddFinding)} className="p-4 border rounded-md space-y-4 mb-6">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <FormField
                            control={findingForm.control}
                            name="type"
                            render={({ field }) => (
                              <FormItem className="md:col-span-1">
                                <FormLabel>Tipo de Hallazgo</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl><SelectTrigger><SelectValue placeholder="Seleccione..." /></SelectTrigger></FormControl>
                                  <SelectContent>
                                    {findingTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={findingForm.control}
                            name="description"
                            render={({ field }) => (
                              <FormItem className="md:col-span-3">
                                <FormLabel>Descripción del Hallazgo</FormLabel>
                                <FormControl><Textarea placeholder="Describa la evidencia encontrada durante la auditoría..." {...field} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        {findingForm.watch('type') === 'No Conforme' && (
                            <FormField
                                control={findingForm.control}
                                name="proposedAction"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Plan de Acción Propuesto</FormLabel>
                                    <FormControl><Textarea placeholder="Describa la acción correctiva o de mejora que se debe tomar..." {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                        )}
                        <div className="flex justify-end">
                          <Button type="submit">
                            <PlusCircle className="mr-2 h-4 w-4" /> Agregar Hallazgo
                          </Button>
                        </div>
                      </form>
                    </Form>
                    
                    <Separator className="my-6" />

                    <h4 className="text-md font-semibold mb-4">Hallazgos Registrados en esta Sesión ({auditFindings.length})</h4>
                    <div className="space-y-4">
                      {auditFindings.length > 0 ? auditFindings.map((finding) => (
                        <Card key={finding.id} className="bg-muted/20">
                          <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-base flex items-center gap-2">
                              <Badge variant={finding.type === 'No Conforme' ? 'destructive' : (finding.type === 'Oportunidad de Mejora' ? 'secondary' : 'default')}>
                                {finding.type}
                              </Badge>
                              Hallazgo #{finding.id.slice(-4)}
                            </CardTitle>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteFinding(finding.id)} className="text-destructive hover:text-destructive h-7 w-7">
                                <Trash2 className="h-4 w-4"/>
                            </Button>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm mb-2 whitespace-pre-wrap"><strong>Descripción:</strong> {finding.description}</p>
                            {finding.type === 'No Conforme' && (
                              <div className="p-3 border rounded-md bg-background space-y-2">
                                    <p className="text-sm font-semibold">Plan de Acción Propuesto:</p>
                                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{finding.proposedAction}</p>
                                    <div className="flex justify-end pt-2">
                                    <Button 
                                        size="sm" 
                                        onClick={() => handleCreateActionPlan(finding)}
                                        disabled={finding.isActionCreated}
                                    >
                                        <Send className="mr-2 h-4 w-4" />
                                        {finding.isActionCreated ? 'Plan de Acción Creado' : 'Registrar Plan de Acción'}
                                    </Button>
                                    </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )) : (
                        <div className="text-center text-muted-foreground py-6">No hay hallazgos registrados para esta auditoría.</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
            
            <TabsContent value="actividad" className="mt-4">
              <CardDescription className="mb-6">
                Registro histórico de cambios y eventos en el sistema. Esta es una vista de solo lectura de las actividades del sistema.
              </CardDescription>
               <div className="mt-6 p-8 border border-dashed border-border rounded-lg flex flex-col items-center justify-center min-h-[300px] bg-muted/20">
                    <History className="h-16 w-16 text-muted-foreground mb-4" />
                    <p className="text-lg font-semibold text-foreground">Registro de Actividad del Sistema (Conceptual)</p>
                    <p className="text-sm text-muted-foreground text-center max-w-md">
                        Esta sección está diseñada para mostrar un registro detallado de todas las acciones importantes realizadas en el sistema,
                        como la creación o modificación de procesos, actividades y acciones de mejora.
                    </p>
                     <p className="text-xs text-muted-foreground mt-2">
                        La implementación de un registro de eventos detallado requiere una arquitectura más compleja que la actual (basada en localStorage)
                        y está fuera del alcance de las modificaciones actuales.
                    </p>
                </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
