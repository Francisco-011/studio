
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";

import { useAcciones } from '@/contexts/AccionesContext';
import { useActividades, type Actividad } from '@/contexts/ActividadesContext';
import { usePuestos, type Puesto } from '@/contexts/PuestosContext';
import type { CapturedProcess } from '../procesos-y-flujos-registrados/page';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { ClipboardCheck, PlusCircle, Trash2, FileText, Send, AlertTriangle, Loader2, History, Edit, ArrowRight } from "lucide-react";

const CAPTURED_DATA_LOCAL_STORAGE_KEY = 'proceza-captured-data';
const LOCAL_STORAGE_AUDITS_KEY = 'proceza-audits';

const findingTypes = ["Conforme", "No Conforme", "Oportunidad de Mejora"] as const;
type FindingType = typeof findingTypes[number];

const auditFindingSchema = z.object({
  type: z.enum(findingTypes, { errorMap: () => ({ message: "Seleccione un tipo válido."})}),
  description: z.string().min(10, 'La descripción del hallazgo es requerida (mínimo 10 caracteres).'),
  proposedAction: z.string().optional(),
}).refine(data => {
    if ((data.type === 'No Conforme' || data.type === 'Oportunidad de Mejora') && (!data.proposedAction || data.proposedAction.length < 10)) {
        return false;
    }
    return true;
}, {
    message: "El plan de acción propuesto es requerido para hallazgos de 'No Conforme' u 'Oportunidad de Mejora' (mínimo 10 caracteres).",
    path: ["proposedAction"],
});
type AuditFindingFormData = z.infer<typeof auditFindingSchema>;

interface AuditFinding extends AuditFindingFormData {
  id: string;
  isActionCreated: boolean;
}

interface Audit {
  id: string;
  auditType: 'proceso' | 'puesto';
  targetId: string;
  targetName: string;
  auditorName: string;
  auditDate: string; // ISO string
  status: 'En Progreso' | 'Completada';
  findings: AuditFinding[];
}

export default function AuditoriaPage() {
  const { actividades, isLoadingActividades } = useActividades();
  const { addAccion, isLoadingAcciones } = useAcciones();
  const { puestos, isLoadingPuestos } = usePuestos();

  const [allProcesses, setAllProcesses] = useState<CapturedProcess[]>([]);
  const [pastAudits, setPastAudits] = useState<Audit[]>([]);
  const [currentAuditSession, setCurrentAuditSession] = useState<Audit | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isStartAuditDialogOpen, setIsStartAuditDialogOpen] = useState(false);
  
  const [newAuditType, setNewAuditType] = useState<'proceso' | 'puesto' | ''>('');
  const [newAuditTargetId, setNewAuditTargetId] = useState<string>('');
  const [newAuditorName, setNewAuditorName] = useState<string>('Auditor Principal');

  const findingForm = useForm<AuditFindingFormData>({
    resolver: zodResolver(auditFindingSchema),
    defaultValues: { type: undefined, description: '', proposedAction: '' },
  });

  useEffect(() => {
    setIsLoading(true);
    try {
      const storedProcesses = localStorage.getItem(CAPTURED_DATA_LOCAL_STORAGE_KEY);
      if (storedProcesses) {
        setAllProcesses(JSON.parse(storedProcesses).filter((p: any) => !p.deletedAt && p.activo !== false));
      }
      const storedAudits = localStorage.getItem(LOCAL_STORAGE_AUDITS_KEY);
      if (storedAudits) {
        setPastAudits(JSON.parse(storedAudits));
      }
    } catch (e) {
      console.error("Error loading data for audit:", e);
      toast({ title: "Error al cargar datos", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(LOCAL_STORAGE_AUDITS_KEY, JSON.stringify(pastAudits));
    }
  }, [pastAudits, isLoading]);
  
  const auditTargetDetails = useMemo(() => {
    if (!currentAuditSession) return null;

    if (currentAuditSession.auditType === 'proceso') {
      const process = allProcesses.find(p => p.id === currentAuditSession.targetId);
      if (!process) return { name: "Proceso no encontrado", details: [] };
      const processActivities = (process.activityOrder || [])
        .map(actId => actividades.find(a => a.id === actId))
        .filter((act): act is Actividad => !!act);

      return {
        name: process.proceso,
        details: [
          `Área: ${process.area}`,
          `Puesto: ${process.puesto}`,
          `Descripción: ${process.descripcion}`,
        ],
        activities: processActivities,
      };
    } else { // Puesto
      const puesto = puestos.find(p => p.id === currentAuditSession.targetId);
      if (!puesto) return { name: "Puesto no encontrado", details: [] };
      const relatedProcesses = allProcesses.filter(proc => proc.puesto === puesto.nombre);
      return {
        name: puesto.nombre,
        details: [
          `Nivel: ${puesto.nivelOrganizacional}`,
          `Personas: ${puesto.numeroPersonas || 'N/A'}`
        ],
        processes: relatedProcesses,
      };
    }
  }, [currentAuditSession, allProcesses, actividades, puestos]);


  const handleStartNewAudit = () => {
    if (!newAuditType || !newAuditTargetId) {
      toast({ title: "Información incompleta", description: "Debe seleccionar un tipo y un objetivo para la auditoría." });
      return;
    }
    const targetName = newAuditType === 'proceso'
      ? allProcesses.find(p => p.id === newAuditTargetId)?.proceso
      : puestos.find(p => p.id === newAuditTargetId)?.nombre;

    if (!targetName) {
        toast({ title: "Error", description: "No se encontró el nombre del objetivo seleccionado." });
        return;
    }

    const newAudit: Audit = {
      id: Date.now().toString(),
      auditType: newAuditType,
      targetId: newAuditTargetId,
      targetName: targetName,
      auditorName: newAuditorName,
      auditDate: new Date().toISOString(),
      status: 'En Progreso',
      findings: [],
    };
    setCurrentAuditSession(newAudit);
    setIsStartAuditDialogOpen(false);
    setNewAuditType('');
    setNewAuditTargetId('');
  };
  
  const handleAddFinding = (data: AuditFindingFormData) => {
    if (!currentAuditSession) return;
    const newFinding: AuditFinding = { ...data, id: Date.now().toString(), isActionCreated: false };
    setCurrentAuditSession(prev => prev ? { ...prev, findings: [...prev.findings, newFinding] } : null);
    findingForm.reset();
  };
  
  const handleDeleteFinding = (findingId: string) => {
    if (!currentAuditSession) return;
    setCurrentAuditSession(prev => prev ? { ...prev, findings: prev.findings.filter(f => f.id !== findingId) } : null);
  };
  
  const handleCreateActionPlan = (finding: AuditFinding) => {
    if (!currentAuditSession) return;
    const target = currentAuditSession.auditType === 'proceso'
      ? allProcesses.find(p => p.id === currentAuditSession.targetId)
      : puestos.find(p => p.id === currentAuditSession.targetId);
    
    if (!target) return;
    
    let actionData: any = {
      nombre: `Hallazgo en ${currentAuditSession.auditType}: ${currentAuditSession.targetName}`,
      descripcion: `Descripción del Hallazgo: ${finding.description}\n\nPlan de Acción Propuesto: ${finding.proposedAction}`,
      responsable: 'Por Asignar',
      estado: 'Pendiente',
      origenMejora: `Auditoría - ${currentAuditSession.auditorName}`,
    };

    if (currentAuditSession.auditType === 'proceso') {
      actionData.procesoId = target.id;
      actionData.area = (target as CapturedProcess).area;
      actionData.puesto = (target as CapturedProcess).puesto;
    } else {
      actionData.puesto = (target as Puesto).nombre;
      actionData.area = areas.find(a => a.id === (target as Puesto).areaId)?.nombre;
    }

    addAccion(actionData);
    
    if (currentAuditSession) {
      const updatedFindings = currentAuditSession.findings.map(f => f.id === finding.id ? {...f, isActionCreated: true} : f);
      setCurrentAuditSession({ ...currentAuditSession, findings: updatedFindings });
    }
    
    toast({ title: "Plan de Acción Registrado", description: "La acción ha sido creada en el módulo de 'Acciones'." });
  };
  
  const handleFinalizeAudit = () => {
    if (!currentAuditSession) return;
    const finalAudit = { ...currentAuditSession, status: 'Completada' as const };
    setPastAudits(prev => {
        const existingIndex = prev.findIndex(a => a.id === finalAudit.id);
        if (existingIndex > -1) {
            const newAudits = [...prev];
            newAudits[existingIndex] = finalAudit;
            return newAudits;
        }
        return [...prev, finalAudit];
    });
    setCurrentAuditSession(null);
    toast({ title: "Auditoría Finalizada", description: "La auditoría ha sido guardada." });
  };

  if (isLoading || isLoadingActividades || isLoadingPuestos) {
    return (
      <div className="container mx-auto py-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-16 w-16 text-primary animate-spin" />
        <p className="ml-4 text-lg text-muted-foreground">Cargando datos de auditoría...</p>
      </div>
    );
  }

  if (currentAuditSession) {
    // AUDIT WORKSPACE VIEW
    return (
        <div className="container mx-auto py-8">
            <Card className="shadow-lg">
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="text-2xl font-headline">Auditoría en Progreso</CardTitle>
                            <CardDescription>
                                Auditor: {currentAuditSession.auditorName} | Fecha: {format(parseISO(currentAuditSession.auditDate), 'dd/MM/yyyy')}
                            </CardDescription>
                        </div>
                        <Button variant="destructive" onClick={() => setCurrentAuditSession(null)}>Cancelar Auditoría</Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <Card className="bg-muted/30">
                        <CardHeader>
                            <CardTitle className="text-lg">Objetivo de la Auditoría: {auditTargetDetails?.name}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {auditTargetDetails?.details && auditTargetDetails.details.length > 0 &&
                                <div className="text-sm space-y-1 mb-4">
                                    {auditTargetDetails.details.map((detail, i) => <p key={i}>{detail}</p>)}
                                </div>
                            }
                            {auditTargetDetails?.activities && (
                                <>
                                    <h4 className="font-semibold text-md mb-2">Actividades del Proceso</h4>
                                    {auditTargetDetails.activities.length > 0 ? (
                                    <ul className="list-decimal list-inside space-y-2 text-sm">
                                        {auditTargetDetails.activities.map(act => (
                                        <li key={act.id}>
                                            <strong>{act.nombre}</strong> (Tiempo Est: {act.tiempoEstimadoActividad ?? 'N/A'} min, Costo Est: {act.costoEstimadoActividad ?? 'N/A'} {act.monedaCostoActividad || ''})
                                            <p className="pl-4 text-xs text-muted-foreground">{act.descripcionBreve || 'Sin descripción.'}</p>
                                        </li>
                                        ))}
                                    </ul>
                                    ) : <p className="text-sm text-muted-foreground">Sin actividades detalladas.</p>}
                                </>
                            )}
                            {auditTargetDetails?.processes && (
                                <>
                                    <h4 className="font-semibold text-md mb-2">Procesos del Puesto</h4>
                                    {auditTargetDetails.processes.length > 0 ? (
                                    <ul className="list-decimal list-inside space-y-1 text-sm">
                                        {auditTargetDetails.processes.map(proc => <li key={proc.id}>{proc.proceso}</li>)}
                                    </ul>
                                    ) : <p className="text-sm text-muted-foreground">Sin procesos asociados.</p>}
                                </>
                            )}
                        </CardContent>
                    </Card>

                    <div>
                        <h3 className="text-xl font-semibold mb-2">Registro de Hallazgos</h3>
                        <Form {...findingForm}>
                            <form onSubmit={findingForm.handleSubmit(handleAddFinding)} className="p-4 border rounded-md space-y-4 mb-6">
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <FormField control={findingForm.control} name="type" render={({ field }) => (
                                    <FormItem className="md:col-span-1">
                                    <FormLabel>Tipo de Hallazgo</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione..." /></SelectTrigger></FormControl>
                                        <SelectContent>{findingTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
                                    </Select><FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={findingForm.control} name="description" render={({ field }) => (
                                    <FormItem className="md:col-span-3">
                                    <FormLabel>Descripción del Hallazgo</FormLabel>
                                    <FormControl><Textarea placeholder="Describa la evidencia encontrada..." {...field} /></FormControl><FormMessage />
                                    </FormItem>
                                )} />
                                </div>
                                {(findingForm.watch('type') === 'No Conforme' || findingForm.watch('type') === 'Oportunidad de Mejora') && (
                                <FormField control={findingForm.control} name="proposedAction" render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Plan de Acción Propuesto</FormLabel>
                                    <FormControl><Textarea placeholder="Describa la acción correctiva o de mejora que se debe tomar..." {...field} value={field.value ?? ''}/></FormControl><FormMessage />
                                    </FormItem>
                                )} />
                                )}
                                <div className="flex justify-end"><Button type="submit"><PlusCircle className="mr-2 h-4 w-4" /> Agregar Hallazgo</Button></div>
                            </form>
                        </Form>
                        <Separator className="my-6" />
                        <div className="space-y-4">
                            {currentAuditSession.findings.length > 0 ? currentAuditSession.findings.map((finding) => (
                                <Card key={finding.id} className="bg-muted/20">
                                <CardHeader className="flex flex-row items-center justify-between pb-2">
                                    <CardTitle className="text-base flex items-center gap-2">
                                    <Badge variant={finding.type === 'No Conforme' ? 'destructive' : (finding.type === 'Oportunidad de Mejora' ? 'secondary' : 'default')}>{finding.type}</Badge>
                                    Hallazgo #{finding.id.slice(-4)}
                                    </CardTitle>
                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteFinding(finding.id)} className="text-destructive hover:text-destructive h-7 w-7"><Trash2 className="h-4 w-4"/></Button>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm mb-2 whitespace-pre-wrap"><strong>Descripción:</strong> {finding.description}</p>
                                    {(finding.type === 'No Conforme' || finding.type === 'Oportunidad de Mejora') && finding.proposedAction && (
                                    <div className="p-3 border rounded-md bg-background space-y-2">
                                        <p className="text-sm font-semibold">Plan de Acción Propuesto:</p>
                                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{finding.proposedAction}</p>
                                        <div className="flex justify-end pt-2">
                                        <Button size="sm" onClick={() => handleCreateActionPlan(finding)} disabled={finding.isActionCreated}>
                                            <Send className="mr-2 h-4 w-4" /> {finding.isActionCreated ? 'Plan de Acción Creado' : 'Registrar Plan de Acción'}
                                        </Button>
                                        </div>
                                    </div>
                                    )}
                                </CardContent>
                                </Card>
                            )) : (<div className="text-center text-muted-foreground py-6">No hay hallazgos registrados.</div>)}
                        </div>
                    </div>
                    <div className="flex justify-end pt-4">
                        <Button size="lg" onClick={handleFinalizeAudit}>Finalizar y Guardar Auditoría</Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
  }

  // MAIN LIST VIEW
  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
                <div className="flex items-center gap-2">
                    <ClipboardCheck className="h-6 w-6 text-primary" />
                    <CardTitle className="text-2xl font-headline">Auditoría y Cumplimiento</CardTitle>
                </div>
                <CardDescription>
                    Inicie nuevas auditorías a procesos o puestos, o consulte el historial de auditorías completadas.
                </CardDescription>
            </div>
            <Dialog open={isStartAuditDialogOpen} onOpenChange={setIsStartAuditDialogOpen}>
                <DialogTrigger asChild>
                    <Button size="lg"><PlusCircle className="mr-2 h-4 w-4" /> Iniciar Nueva Auditoría</Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Iniciar Nueva Auditoría</DialogTitle>
                        <DialogDescription>Seleccione qué desea auditar y quién es el auditor.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <Label htmlFor="auditorNameInput">Nombre del Auditor</Label>
                            <Input id="auditorNameInput" value={newAuditorName} onChange={e => setNewAuditorName(e.target.value)} />
                        </div>
                        <div>
                            <Label htmlFor="auditTypeSelect">Tipo de Auditoría</Label>
                            <Select value={newAuditType} onValueChange={(v: 'proceso' | 'puesto' | '') => { setNewAuditType(v); setNewAuditTargetId(''); }}>
                                <SelectTrigger id="auditTypeSelect"><SelectValue placeholder="Seleccione un tipo..." /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="proceso">Proceso</SelectItem>
                                    <SelectItem value="puesto">Puesto</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {newAuditType && (
                        <div>
                            <Label htmlFor="auditTargetSelect">Objetivo Específico</Label>
                            <Select value={newAuditTargetId} onValueChange={setNewAuditTargetId}>
                                <SelectTrigger id="auditTargetSelect"><SelectValue placeholder="Seleccione un objetivo..." /></SelectTrigger>
                                <SelectContent>
                                    {newAuditType === 'proceso' ? (
                                        allProcesses.map(p => <SelectItem key={p.id} value={p.id}>{p.proceso}</SelectItem>)
                                    ) : (
                                        puestos.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                        )}
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                        <Button onClick={handleStartNewAudit} disabled={!newAuditType || !newAuditTargetId}>Iniciar Auditoría <ArrowRight className="ml-2 h-4 w-4"/></Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="historial">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="historial">Historial de Auditorías</TabsTrigger>
              <TabsTrigger value="actividad">Registro de Actividad del Sistema</TabsTrigger>
            </TabsList>
            <TabsContent value="historial" className="mt-4">
                {pastAudits.length > 0 ? (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Objetivo Auditado</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Auditor</TableHead>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Hallazgos</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {pastAudits.map(audit => (
                            <TableRow key={audit.id}>
                                <TableCell className="font-medium">{audit.targetName}</TableCell>
                                <TableCell>{audit.auditType === 'proceso' ? 'Proceso' : 'Puesto'}</TableCell>
                                <TableCell>{audit.auditorName}</TableCell>
                                <TableCell>{format(parseISO(audit.auditDate), 'dd/MM/yyyy')}</TableCell>
                                <TableCell>{audit.findings.length}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="outline" size="sm" onClick={() => setCurrentAuditSession(audit)}>
                                        <Edit className="mr-2 h-4 w-4" /> Ver / Editar
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                ) : (
                <div className="text-center p-8 text-muted-foreground">No hay auditorías completadas.</div>
                )}
            </TabsContent>
            <TabsContent value="actividad" className="mt-4">
              <div className="mt-6 p-8 border border-dashed border-border rounded-lg flex flex-col items-center justify-center min-h-[300px] bg-muted/20">
                    <History className="h-16 w-16 text-muted-foreground mb-4" />
                    <p className="text-lg font-semibold text-foreground">Registro de Actividad del Sistema (Conceptual)</p>
                    <p className="text-sm text-muted-foreground text-center max-w-md">
                        Esta sección está diseñada para mostrar un registro detallado de las acciones importantes realizadas en el sistema.
                        La implementación de un registro de eventos completo requiere una arquitectura más compleja y está fuera del alcance actual.
                    </p>
                </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

    