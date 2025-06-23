
'use client';

import { useState, useEffect, useMemo } from 'react';
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
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
  DialogClose,
  DialogTrigger
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { useAreas } from '@/contexts/AreasContext';
import { usePuestos, type Puesto } from '@/contexts/PuestosContext';
import { useActividades, type Actividad } from '@/contexts/ActividadesContext';
import { useAcciones } from '@/contexts/AccionesContext';
import type { CapturedProcess } from '../procesos-y-flujos-registrados/page';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { cn } from '@/lib/utils';

import { ClipboardCheck, PlusCircle, Trash2, FileText, Send, AlertTriangle, Loader2, History, Edit, ArrowRight, Save, XCircle } from "lucide-react";

const CAPTURED_DATA_LOCAL_STORAGE_KEY = 'proceza-captured-data';
const LOCAL_STORAGE_AUDITS_KEY = 'proceza-audits';

const findingTypes = ["Conforme", "No Conforme", "Oportunidad de Mejora"] as const;
type FindingType = typeof findingTypes[number];

const auditStatuses = ["En Progreso", "Completada", "Cancelada", "Pendiente"] as const;
type AuditStatus = typeof auditStatuses[number];


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
  status: AuditStatus;
  findings: AuditFinding[];
}

const DetailDisplay = ({ title, value, isList = false, isTextarea = false }: { title: string, value?: string | string[] | number | null, isList?: boolean, isTextarea?: boolean }) => {
  if (value === undefined || value === null || (isList && Array.isArray(value) && value.length === 0) || (typeof value === 'string' && value.trim() === '' && !isTextarea && !isList)) {
    return null;
  }
  return (
    <div className="text-sm">
      <strong className="font-semibold text-foreground/90">{title}:</strong>
      {isList && Array.isArray(value) ? (
        <div className="flex flex-wrap gap-1 mt-1">
          {value.map((item, idx) => (
            <Badge key={idx} variant="secondary">{item}</Badge>
          ))}
        </div>
      ) : (
        <p className={cn("text-muted-foreground", isTextarea && "whitespace-pre-wrap mt-1")}>{typeof value === 'number' ? value.toString() : value}</p>
      )}
    </div>
  );
};

export default function AuditoriaPage() {
  const { actividades, isLoadingActividades } = useActividades();
  const { addAccion, isLoadingAcciones } = useAcciones();
  const { puestos, isLoadingPuestos } = usePuestos();
  const { areas } = useAreas();

  const [allProcesses, setAllProcesses] = useState<CapturedProcess[]>([]);
  const [pastAudits, setPastAudits] = useState<Audit[]>([]);
  const [currentAuditSession, setCurrentAuditSession] = useState<Audit | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isStartAuditDialogOpen, setIsStartAuditDialogOpen] = useState(false);
  
  const [newAuditType, setNewAuditType] = useState<'proceso' | 'puesto' | ''>('');
  const [newAuditTargetId, setNewAuditTargetId] = useState<string>('');
  const [newAuditorName, setNewAuditorName] = useState<string>('Auditor Principal');

  const [isFindingDialogOpen, setIsFindingDialogOpen] = useState(false);
  const [editingFinding, setEditingFinding] = useState<AuditFinding | null>(null);
  
  const [isConfirmDeleteFindingOpen, setIsConfirmDeleteFindingOpen] = useState(false);
  const [findingToDelete, setFindingToDelete] = useState<AuditFinding | null>(null);
  const [isConfirmCancelDialogOpen, setIsConfirmCancelDialogOpen] = useState(false);


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

  useEffect(() => {
    if (currentAuditSession && !isLoading) {
        const existingIndex = pastAudits.findIndex(a => a.id === currentAuditSession.id);
        if (existingIndex !== -1) {
            const updatedAudits = [...pastAudits];
            updatedAudits[existingIndex] = currentAuditSession;
            setPastAudits(updatedAudits);
        } else if (currentAuditSession.findings.length > 0 || currentAuditSession.status === 'En Progreso') {
            setPastAudits(prev => [...prev, currentAuditSession]);
        }
    }
  }, [currentAuditSession, isLoading]);
  
  const auditTargetDetails = useMemo(() => {
    if (!currentAuditSession) return null;

    if (currentAuditSession.auditType === 'proceso') {
      const process = allProcesses.find(p => p.id === currentAuditSession.targetId);
      if (!process) return { name: "Proceso no encontrado", process: null, activities: [], puesto: null, relatedProcesses: [] };
      const processActivities = (process.activityOrder || [])
        .map(actId => actividades.find(a => a.id === actId))
        .filter((act): act is Actividad => !!act);

      return {
        name: process.proceso,
        process,
        activities: processActivities,
        puesto: null,
        relatedProcesses: [],
      };
    } else { // Puesto
      const puesto = puestos.find(p => p.id === currentAuditSession.targetId);
      if (!puesto) return { name: "Puesto no encontrado", process: null, activities: [], puesto: null, relatedProcesses: [] };
      const relatedProcessesData = allProcesses
        .filter(proc => proc.puesto === puesto.nombre)
        .map(proc => {
            const processActivities = (proc.activityOrder || [])
                .map(actId => actividades.find(a => a.id === actId))
                .filter((act): act is Actividad => !!act);
            return { process: proc, activities: processActivities };
        });
      
      return {
        name: puesto.nombre,
        process: null,
        activities: [],
        puesto,
        relatedProcesses: relatedProcessesData,
      };
    }
  }, [currentAuditSession, allProcesses, actividades, puestos, areas]);

  useEffect(() => {
    if (isFindingDialogOpen) {
        if (editingFinding) {
            findingForm.reset(editingFinding);
        } else {
            findingForm.reset({ type: undefined, description: '', proposedAction: '' });
        }
    }
  }, [isFindingDialogOpen, editingFinding, findingForm]);


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
      status: 'Pendiente',
      findings: [],
    };
    setCurrentAuditSession(newAudit);
    setIsStartAuditDialogOpen(false);
    setNewAuditType('');
    setNewAuditTargetId('');
  };
  
  const handleFindingSubmit = (data: AuditFindingFormData) => {
    if (!currentAuditSession) return;
    
    if (editingFinding) {
      // Update existing finding
      const updatedFindings = currentAuditSession.findings.map(f =>
        f.id === editingFinding.id ? { ...f, ...data } : f
      );
      setCurrentAuditSession(prev => prev ? { ...prev, findings: updatedFindings } : null);
    } else {
      // Add new finding
      const newFinding: AuditFinding = { ...data, id: Date.now().toString(), isActionCreated: false };
      setCurrentAuditSession(prev => prev ? { ...prev, findings: [...prev.findings, newFinding] } : null);
    }
    
    setIsFindingDialogOpen(false);
    setEditingFinding(null);
    findingForm.reset();
  };
  
  function promptDeleteFinding(finding: AuditFinding) {
    setFindingToDelete(finding);
    setIsConfirmDeleteFindingOpen(true);
  }

  function executeDeleteFinding() {
    if (!currentAuditSession || !findingToDelete) return;
    
    setCurrentAuditSession(prev => prev ? { ...prev, findings: prev.findings.filter(f => f.id !== findingToDelete.id) } : null);

    toast({ title: "Hallazgo Eliminado", description: "El hallazgo ha sido eliminado de la auditoría.", variant: "destructive" });
    
    setFindingToDelete(null);
    setIsConfirmDeleteFindingOpen(false);
  }

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

  const promptCancelAudit = () => {
    setIsConfirmCancelDialogOpen(true);
  };
  
  const handleCancelAudit = () => {
    if (!currentAuditSession) return;
    const cancelledAudit = { ...currentAuditSession, status: 'Cancelada' as const };
    setPastAudits(prev => {
        const existingIndex = prev.findIndex(a => a.id === cancelledAudit.id);
        if (existingIndex > -1) {
            const newAudits = [...prev];
            newAudits[existingIndex] = cancelledAudit;
            return newAudits;
        }
        return [...prev, cancelledAudit];
    });
    setCurrentAuditSession(null);
    toast({ title: "Auditoría Cancelada", description: "La auditoría ha sido guardada en estado 'Cancelada'." });
    setIsConfirmCancelDialogOpen(false);
  };
  
  const handleEditAudit = (audit: Audit) => {
    setCurrentAuditSession({ ...audit, status: 'En Progreso' });
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
                        <Button variant="secondary" onClick={() => setCurrentAuditSession(null)}>Volver a la Lista</Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <Card className="bg-muted/30">
                        <CardHeader>
                            <CardTitle className="text-lg">Objetivo de la Auditoría: {auditTargetDetails?.name}</CardTitle>
                        </CardHeader>
                         <CardContent className="space-y-4">
                            {auditTargetDetails?.process && (
                                <>
                                <Card>
                                    <CardHeader><CardTitle className="text-lg">Detalles del Proceso</CardTitle></CardHeader>
                                    <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        <DetailDisplay title="Descripción" value={auditTargetDetails.process.descripcion} isTextarea />
                                        <DetailDisplay title="Área" value={auditTargetDetails.process.area} />
                                        <DetailDisplay title="Puesto" value={auditTargetDetails.process.puesto} />
                                        <DetailDisplay title="Frecuencia" value={auditTargetDetails.process.frecuencia} />
                                        <DetailDisplay title="Tiempo Estimado" value={auditTargetDetails.process.tiempoEstimado !== undefined ? `${auditTargetDetails.process.tiempoEstimado} min` : null} />
                                        <DetailDisplay title="Tiempo Ideal" value={auditTargetDetails.process.tiempoIdeal !== undefined ? `${auditTargetDetails.process.tiempoIdeal} min` : null} />
                                        <DetailDisplay title="Costo Estimado" value={auditTargetDetails.process.costoEstimado !== undefined ? `${auditTargetDetails.process.costoEstimado} ${auditTargetDetails.process.monedaCosto || ''}`: null} />
                                        <DetailDisplay title="Costo Ideal" value={auditTargetDetails.process.costoIdeal !== undefined ? `${auditTargetDetails.process.costoIdeal} ${auditTargetDetails.process.monedaCosto || ''}`: null} />
                                        <DetailDisplay title="Sistemas" value={auditTargetDetails.process.sistemas} isList />
                                        <DetailDisplay title="Entradas" value={auditTargetDetails.process.informacionRecibe} isTextarea />
                                        <DetailDisplay title="Salidas" value={auditTargetDetails.process.informacionEntrega} isTextarea />
                                        <DetailDisplay title="Procesos de Entrada" value={auditTargetDetails.process.procesosEntrada} isList />
                                        <DetailDisplay title="Procesos de Salida" value={auditTargetDetails.process.procesosSalida} isList />
                                    </CardContent>
                                </Card>
                                
                                <div>
                                    <h4 className="font-semibold text-lg mb-2">Actividades en Orden</h4>
                                        {(auditTargetDetails.activities && auditTargetDetails.activities.length > 0) ? (
                                        <div className="space-y-3">
                                            {auditTargetDetails.activities.map((act, index) => (
                                            <Card key={act.id} className="bg-background">
                                                <CardHeader className="flex-row items-center gap-4 space-y-0 p-4">
                                                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">{index + 1}</span>
                                                <CardTitle className="text-base">{act.nombre}</CardTitle>
                                                </CardHeader>
                                                <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4 pt-0 pl-16">
                                                <DetailDisplay title="Descripción" value={act.descripcionBreve} isTextarea />
                                                <DetailDisplay title="Tiempo Estimado" value={act.tiempoEstimadoActividad !== undefined ? `${act.tiempoEstimadoActividad} min` : null} />
                                                <DetailDisplay title="Tiempo Ideal" value={act.tiempoIdealActividad !== undefined ? `${act.tiempoIdealActividad} min` : null} />
                                                <DetailDisplay title="Costo Estimado" value={act.costoEstimadoActividad !== undefined ? `${act.costoEstimadoActividad} ${act.monedaCostoActividad || ''}` : null} />
                                                <DetailDisplay title="Costo Ideal" value={act.costoIdealActividad !== undefined ? `${act.costoIdealActividad} ${act.monedaCostoActividad || ''}` : null} />
                                                <DetailDisplay title="Sistema Utilizado" value={act.sistemaUtilizado} />
                                                <DetailDisplay title="Frecuencia" value={act.frecuenciaActividad} />
                                                </CardContent>
                                            </Card>
                                            ))}
                                        </div>
                                        ) : (
                                        <p className="text-sm text-muted-foreground italic">Este proceso no tiene actividades definidas en orden.</p>
                                        )}
                                </div>
                                </>
                            )}
                            {auditTargetDetails?.puesto && (
                                <Card>
                                    <CardHeader><CardTitle className="text-lg">Detalles del Puesto</CardTitle></CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            <DetailDisplay title="Área" value={areas.find(a => a.id === auditTargetDetails.puesto?.areaId)?.nombre || 'No asignada'} />
                                            <DetailDisplay title="Nivel Organizacional" value={auditTargetDetails.puesto.nivelOrganizacional} />
                                            <DetailDisplay title="Número de Personas" value={auditTargetDetails.puesto.numeroPersonas} />
                                        </div>
                                        {auditTargetDetails.relatedProcesses && auditTargetDetails.relatedProcesses.length > 0 && (
                                            <div>
                                                <Separator className="my-4" />
                                                <h4 className="font-semibold text-md mb-2">Procesos Asociados al Puesto</h4>
                                                <Accordion type="multiple" className="w-full">
                                                    {auditTargetDetails.relatedProcesses.map(({ process, activities }) => (
                                                        <AccordionItem value={process.id} key={process.id}>
                                                            <AccordionTrigger>{process.proceso}</AccordionTrigger>
                                                            <AccordionContent className="space-y-4 p-2 bg-background">
                                                                <Card>
                                                                    <CardHeader className="pb-2"><CardTitle className="text-base">Detalles del Proceso</CardTitle></CardHeader>
                                                                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                                                        <DetailDisplay title="Descripción" value={process.descripcion} isTextarea />
                                                                        <DetailDisplay title="Frecuencia" value={process.frecuencia} />
                                                                        <DetailDisplay title="Tiempo Est./Ideal" value={`${process.tiempoEstimado ?? '-'} / ${process.tiempoIdeal ?? '-'} min`} />
                                                                        <DetailDisplay title="Costo Est./Ideal" value={`${process.costoEstimado ?? '-'} / ${process.costoIdeal ?? '-'} ${process.monedaCosto || ''}`} />
                                                                        <DetailDisplay title="Sistemas" value={process.sistemas} isList />
                                                                    </CardContent>
                                                                </Card>
                                                                
                                                                <div>
                                                                    <h4 className="font-semibold text-base mb-2">Actividades</h4>
                                                                    {activities && activities.length > 0 ? (
                                                                        <div className="space-y-3">
                                                                            {activities.map((act, index) => (
                                                                            <Card key={act.id} className="bg-background">
                                                                                <CardHeader className="flex-row items-center gap-4 space-y-0 p-4">
                                                                                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">{index + 1}</span>
                                                                                <CardTitle className="text-base">{act.nombre}</CardTitle>
                                                                                </CardHeader>
                                                                                <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4 pt-0 pl-16">
                                                                                    <DetailDisplay title="Descripción" value={act.descripcionBreve} isTextarea />
                                                                                    <DetailDisplay title="Tiempo Estimado" value={act.tiempoEstimadoActividad !== undefined ? `${act.tiempoEstimadoActividad} min` : null} />
                                                                                    <DetailDisplay title="Tiempo Ideal" value={act.tiempoIdealActividad !== undefined ? `${act.tiempoIdealActividad} min` : null} />
                                                                                    <DetailDisplay title="Costo Estimado" value={act.costoEstimadoActividad !== undefined ? `${act.costoEstimadoActividad} ${act.monedaCostoActividad || ''}` : null} />
                                                                                    <DetailDisplay title="Costo Ideal" value={act.costoIdealActividad !== undefined ? `${act.costoIdealActividad} ${act.monedaCostoActividad || ''}` : null} />
                                                                                    <DetailDisplay title="Sistema Utilizado" value={act.sistemaUtilizado} />
                                                                                    <DetailDisplay title="Frecuencia" value={act.frecuenciaActividad} />
                                                                                </CardContent>
                                                                            </Card>
                                                                            ))}
                                                                        </div>
                                                                    ) : (
                                                                        <p className="text-sm text-muted-foreground italic p-2">Este proceso no tiene actividades definidas.</p>
                                                                    )}
                                                                </div>
                                                            </AccordionContent>
                                                        </AccordionItem>
                                                    ))}
                                                </Accordion>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            )}
                        </CardContent>
                    </Card>

                    <div>
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-xl font-semibold">Registro de Hallazgos</h3>
                          <Button onClick={() => { setEditingFinding(null); setIsFindingDialogOpen(true); }}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Agregar Hallazgo
                          </Button>
                        </div>
                        <div className="space-y-4">
                            {currentAuditSession.findings.length > 0 ? currentAuditSession.findings.map((finding) => (
                                <Card key={finding.id} className="bg-muted/20">
                                <CardHeader className="flex flex-row items-center justify-between pb-2">
                                    <CardTitle className="text-base flex items-center gap-2">
                                    <Badge variant={finding.type === 'No Conforme' ? 'destructive' : (finding.type === 'Oportunidad de Mejora' ? 'secondary' : 'default')}>{finding.type}</Badge>
                                    Hallazgo #{finding.id.slice(-4)}
                                    </CardTitle>
                                    <div>
                                      <Button variant="ghost" size="icon" onClick={() => { setEditingFinding(finding); setIsFindingDialogOpen(true); }} className="text-muted-foreground hover:text-foreground h-7 w-7"><Edit className="h-4 w-4"/></Button>
                                      <Button variant="ghost" size="icon" onClick={() => promptDeleteFinding(finding)} className="text-destructive hover:text-destructive h-7 w-7"><Trash2 className="h-4 w-4"/></Button>
                                    </div>
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
                    <div className="flex justify-end pt-4 space-x-2">
                        <Button variant="destructive" onClick={promptCancelAudit}> <XCircle className="mr-2 h-4 w-4"/> Cancelar Auditoría</Button>
                        <Button size="lg" onClick={handleFinalizeAudit}> <Save className="mr-2 h-4 w-4"/> Finalizar y Guardar Auditoría</Button>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={isFindingDialogOpen} onOpenChange={setIsFindingDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingFinding ? "Editar Hallazgo" : "Agregar Nuevo Hallazgo"}</DialogTitle>
                </DialogHeader>
                 <Form {...findingForm}>
                    <form onSubmit={findingForm.handleSubmit(handleFindingSubmit)} className="space-y-4 py-4">
                        <FormField control={findingForm.control} name="type" render={({ field }) => (
                            <FormItem>
                            <FormLabel>Tipo de Hallazgo</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione..." /></SelectTrigger></FormControl>
                                <SelectContent>{findingTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
                            </Select><FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={findingForm.control} name="description" render={({ field }) => (
                            <FormItem>
                            <FormLabel>Descripción del Hallazgo</FormLabel>
                            <FormControl><Textarea placeholder="Describa la evidencia encontrada..." {...field} /></FormControl><FormMessage />
                            </FormItem>
                        )} />
                        {(findingForm.watch('type') === 'No Conforme' || findingForm.watch('type') === 'Oportunidad de Mejora') && (
                        <FormField control={findingForm.control} name="proposedAction" render={({ field }) => (
                            <FormItem>
                            <FormLabel>Plan de Acción Propuesto</FormLabel>
                            <FormControl><Textarea placeholder="Describa la acción correctiva o de mejora que se debe tomar..." {...field} value={field.value ?? ''}/></FormControl><FormMessage />
                            </FormItem>
                        )} />
                        )}
                        <DialogFooter>
                            <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
                            <Button type="submit">{editingFinding ? "Guardar Cambios" : "Agregar Hallazgo"}</Button>
                        </DialogFooter>
                    </form>
                </Form>
              </DialogContent>
            </Dialog>

            <AlertDialog open={isConfirmDeleteFindingOpen} onOpenChange={setIsConfirmDeleteFindingOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                      <div className="flex items-center">
                          <AlertTriangle className="h-5 w-5 mr-2 text-destructive" />
                          Confirmar Eliminación
                      </div>
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    ¿Está seguro de que desea eliminar este hallazgo? Esta acción no se puede deshacer.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setFindingToDelete(null)}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={executeDeleteFinding} className={buttonVariants({variant: "destructive"})}>Eliminar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <AlertDialog open={isConfirmCancelDialogOpen} onOpenChange={setIsConfirmCancelDialogOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                      <div className="flex items-center">
                          <AlertTriangle className="h-5 w-5 mr-2 text-amber-500" />
                          Confirmar Cancelación de Auditoría
                      </div>
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    ¿Está seguro de que desea cancelar esta auditoría? El progreso se guardará con el estado "Cancelada" y podrá consultarla más tarde.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Volver</AlertDialogCancel>
                  <AlertDialogAction onClick={handleCancelAudit} className={buttonVariants({variant: "destructive"})}>Sí, Cancelar Auditoría</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
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
                             <TableHead>Estado</TableHead>
                            <TableHead>Hallazgos</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {pastAudits.sort((a,b) => parseISO(b.auditDate).getTime() - parseISO(a.auditDate).getTime()).map(audit => (
                            <TableRow key={audit.id}>
                                <TableCell className="font-medium">{audit.targetName}</TableCell>
                                <TableCell>{audit.auditType === 'proceso' ? 'Proceso' : 'Puesto'}</TableCell>
                                <TableCell>{audit.auditorName}</TableCell>
                                <TableCell>{format(parseISO(audit.auditDate), 'dd/MM/yyyy')}</TableCell>
                                 <TableCell>
                                  <Badge variant={
                                      audit.status === "Completada" ? "default" :
                                      audit.status === "Cancelada" ? "destructive" :
                                      audit.status === "Pendiente" ? "outline" :
                                      "secondary" // En Progreso
                                  }>{audit.status}</Badge>
                                </TableCell>
                                <TableCell>{audit.findings.length}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="outline" size="sm" onClick={() => handleEditAudit(audit)}>
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
