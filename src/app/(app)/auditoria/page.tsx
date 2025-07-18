
'use client';

import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { format, parseISO, isValid, differenceInDays, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { useRouter } from 'next/navigation';

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
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { useAreas } from '@/contexts/AreasContext';
import { useDepartamentos, type Departamento } from '@/contexts/DepartamentosContext';
import { usePuestos, type Puesto } from '@/contexts/PuestosContext';
import { useActividades, type Actividad } from '@/contexts/ActividadesContext';
import { useAcciones } from '@/contexts/AccionesContext';
import { useSistemasCostos, type Sistema, type SistemaCosto } from '@/contexts/SistemasCostosContext';
import { useActivityLog, type ActivityLogEntry, type LogAction } from '@/contexts/ActivityLogContext';
import { useProcesos, type CapturedProcess, auditFrequencyOptions } from '@/contexts/ProcesosContext';
import { useProcedimientos, type Procedimiento } from '@/contexts/ProcedimientosContext';
import { usePoliticas, type Politica } from '@/contexts/PoliticasContext';
import { useAudits, type Audit, type AuditFinding, type AuditCreationData } from '@/contexts/AuditsContext';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { cn, formatMinutesToHours } from '@/lib/utils';
import { CheckCircle, Workflow as WorkflowIcon } from 'lucide-react';
import { MultiSelect } from "@/components/ui/multi-select";


import { ClipboardCheck, PlusCircle, Trash2, FileText, Send, AlertTriangle, Loader2, History, Edit, ArrowRight, Save, XCircle, User, ChevronDown, Laptop, Search, ArrowUp, ArrowDown, ChevronsUpDown, Eye, Info, PlayCircle, Workflow, CheckSquare } from "lucide-react";
import { Checkbox } from '@/components/ui/checkbox';

const findingTypes = ["Conforme", "No Conforme", "Oportunidad de Mejora"] as const;
type FindingType = typeof findingTypes[number];

const auditStatuses = ["En Progreso", "Completada", "Cancelada"] as const;
type AuditStatus = typeof auditStatuses[number];
const auditTypes = ["proceso", "puesto", "sistema", "politica", "procedimiento"] as const;
type AuditType = typeof auditTypes[number];

const auditFindingSchema = z.object({
  type: z.enum(findingTypes, { errorMap: () => ({ message: "Seleccione un tipo válido."})}),
  description: z.string().min(10, 'La descripción del hallazgo es requerida (mínimo 10 caracteres).'),
  proposedAction: z.string().optional(),
}).refine(data => {
    if ((data.type === 'No Conforme' || data.type === 'Oportunidad de Mejora')) {
        return !!data.proposedAction && data.proposedAction.length >= 10;
    }
    return true;
}, {
    message: "El plan de acción propuesto es requerido para hallazgos de 'No Conforme' u 'Oportunidad de Mejora' (mínimo 10 caracteres).",
    path: ["proposedAction"],
});
type AuditFindingFormData = z.infer<typeof auditFindingSchema>;

type SortableAuditKeys = 'codigo' | 'targetName' | 'auditType' | 'auditorName' | 'auditDate' | 'status' | 'numFindings' | 'pendingActions';
type SortableLogKeys = 'timestamp' | 'user' | 'entityType' | 'entityName' | 'action';
type SortableAuditAlertKeys = 'name' | 'type' | 'daysOverdue';
type SortDirection = 'ascending' | 'descending';
type AuditTab = 'alertas' | 'historial' | 'log';


interface SortConfig<T> {
  key: T;
  direction: SortDirection;
}

const AUDIT_ITEMS_PER_PAGE = 10;
const LOG_ITEMS_PER_PAGE = 20;
const AUDIT_ALERT_ITEMS_PER_PAGE = 10;


const DetailDisplay = ({ title, value, isList = false, isTextarea = false }: { title: string, value?: string | string[] | number | null, isList?: boolean, isTextarea?: boolean }) => {
  const isValueEmpty = value === undefined || value === null || (isList && Array.isArray(value) && value.length === 0) || (typeof value === 'string' && value.trim() === '');
  
  return (
    <div className="text-sm">
      <strong className="font-semibold text-foreground/90">{title}:</strong>
      {isValueEmpty ? (
        <div className="text-muted-foreground italic">No especificado</div>
      ) : isList && Array.isArray(value) ? (
        <div className="flex flex-wrap gap-1 mt-1">
          {value.map((item, idx) => (
            <Badge key={idx} variant="secondary">{item}</Badge>
          ))}
        </div>
      ) : (
        <div className={cn("text-muted-foreground", isTextarea && "whitespace-pre-wrap mt-1")}>{typeof value === 'number' ? value.toString() : value}</div>
      )}
    </div>
  );
};

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


export default function AuditoriaPage() {
  const router = useRouter();
  const { actividades, isLoadingActividades } = useActividades();
  const { addAccion, isLoadingAcciones } = useAcciones();
  const { puestos, updatePuesto, isLoadingPuestos } = usePuestos();
  const { areas } = useAreas();
  const { departamentos, isLoading: isLoadingDepartamentos } = useDepartamentos();
  const { sistemas, costosSistemas, isLoadingSistemasCostos } = useSistemasCostos();
  const { addLogEntry, logEntries, isLoadingLog } = useActivityLog();
  const { procesos: allProcesses, updateProceso, isLoadingProcesos } = useProcesos();
  const { procedimientos: allProcedimientos, updateProcedimiento, isLoading: isLoadingProcedimientos } = useProcedimientos();
  const { politicas: allPoliticas, isLoadingPoliticas } = usePoliticas();
  const { audits: pastAudits, addAudit, updateAudit, deleteAudit, isLoadingAudits } = useAudits();

  const [currentAuditSession, setCurrentAuditSession] = useState<Audit | null>(null);

  const [isStartAuditDialogOpen, setIsStartAuditDialogOpen] = useState(false);
  
  const [newAuditType, setNewAuditType] = useState<AuditType | ''>('');
  const [newAuditTargetId, setNewAuditTargetId] = useState<string>('');
  const [newAuditProcessIds, setNewAuditProcessIds] = useState<string[]>([]);
  const [newAuditorName, setNewAuditorName] = useState('Auditor Principal');

  const [isFindingDialogOpen, setIsFindingDialogOpen] = useState(false);
  const [editingFinding, setEditingFinding] = useState<AuditFinding | null>(null);
  
  const [isConfirmDeleteFindingOpen, setIsConfirmDeleteFindingOpen] = useState(false);
  const [findingToDelete, setFindingToDelete] = useState<AuditFinding | null>(null);
  
  const [isConfirmDeleteAuditOpen, setIsConfirmDeleteAuditOpen] = useState(false);
  const [auditToDelete, setAuditToDelete] = useState<Audit | null>(null);
  
  const [isConfirmCancelAuditOpen, setIsConfirmCancelAuditOpen] = useState(false);
  const [auditToCancel, setAuditToCancel] = useState<Audit | null>(null);
  const [cancellationReason, setCancellationReason] = useState("");
  
  const [activityDisplayFilter, setActivityDisplayFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [auditSearchTerm, setAuditSearchTerm] = useState('');
  const [auditTypeFilter, setAuditTypeFilter] = useState<'all' | AuditType>('all');
  const [auditStatusFilter, setAuditStatusFilter] = useState<'all' | AuditStatus>('all');
  const [pendingActionsFilter, setPendingActionsFilter] = useState<'all' | 'with_pending' | 'no_pending'>('all');
  const [auditSortConfig, setAuditSortConfig] = useState<SortConfig<SortableAuditKeys> | null>(null);
  const [auditCurrentPage, setAuditCurrentPage] = useState(1);
  
  const [auditAlertSearchTerm, setAuditAlertSearchTerm] = useState('');
  const [auditAlertTypeFilter, setAuditAlertTypeFilter] = useState<'all' | AuditType>('all');
  const [auditAlertDaysFilter, setAuditAlertDaysFilter] = useState<'all' | '30' | '90' | '180'>('all');
  const [auditAlertSortConfig, setAuditAlertSortConfig] = useState<SortConfig<SortableAuditAlertKeys> | null>(null);
  const [auditAlertCurrentPage, setAuditAlertCurrentPage] = useState(1);

  const [logSearchTerm, setLogSearchTerm] = useState('');
  const [logActionFilter, setLogActionFilter] = useState<'all' | LogAction>('all');
  const [logEntityTypeFilter, setLogEntityTypeFilter] = useState<'all' | string>('all');
  const [logSortConfig, setLogSortConfig] = useState<SortConfig<SortableLogKeys> | null>(null);
  const [logCurrentPage, setLogCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<AuditTab>('alertas');


  const [isFinalizeConfirmDialogOpen, setIsFinalizeConfirmDialogOpen] = useState(false);
  const [auditToFinalize, setAuditToFinalize] = useState<Audit | null>(null);
  const [finalizeOptions, setFinalizeOptions] = useState({ autoCreateActions: true });
  
  // Memoized maps for performance optimization
  const procesosMap = useMemo(() => new Map(allProcesses.map(p => [p.id, p])), [allProcesses]);
  const procedimientosMap = useMemo(() => new Map(allProcedimientos.map(p => [p.id, p])), [allProcedimientos]);
  const actividadesMap = useMemo(() => new Map(actividades.map(a => [a.id, a])), [actividades]);
  const puestosMap = useMemo(() => new Map(puestos.map(p => [p.id, p])), [puestos]);
  const puestoNameToPuestoMap = useMemo(() => new Map(puestos.map(p => [p.nombre, p])), [puestos]);
  const departamentosMap = useMemo(() => new Map(departamentos.map(d => [d.id, d])), [departamentos]);
  const areasMap = useMemo(() => new Map(areas.map(a => [a.id, a])), [areas]);
  const sistemasMap = useMemo(() => new Map(sistemas.map(s => [s.id, s])), [sistemas]);
  const politicasMap = useMemo(() => new Map(allPoliticas.map(p => [p.id, p])), [allPoliticas]);


  const findingForm = useForm<AuditFindingFormData>({
    resolver: zodResolver(auditFindingSchema),
    defaultValues: { type: undefined, description: '', proposedAction: '' },
  });
  
  const watchedFindingType = findingForm.watch('type');
  
  useEffect(() => {
    setNewAuditProcessIds([]);
  }, [newAuditType, newAuditTargetId]);

  const auditTargetDetails = useMemo(() => {
    const nullDetails = { name: "No encontrado", process: null, puesto: null, relatedProcesses: [], sistema: null, departamento: null, jefeInmediato: null, procedimientos: [], policy: null, procedimiento: null, linkedProcesses: [], relatedPolicies: [] };

    if (!currentAuditSession) return null;

    const activityFilterFunc = (act: Actividad) => {
        if (activityDisplayFilter === 'all') return true;
        if (activityDisplayFilter === 'active') return act.activa;
        if (activityDisplayFilter === 'inactive') return !act.activa;
        return true;
    }

    if (currentAuditSession.auditType === 'proceso') {
      const process = procesosMap.get(currentAuditSession.targetId);
      if (!process) return nullDetails;
      
      const procedimientosDelProceso = (process.procedimientoOrder || [])
        .map(procId => procedimientosMap.get(procId))
        .filter((p): p is Procedimiento => !!p)
        .map(p => ({
            procedimiento: p,
            activities: (p.activityOrder || [])
              .map(actId => actividadesMap.get(actId))
              .filter((act): act is Actividad => !!act)
              .filter(activityFilterFunc)
        }));

      const puestoQueEjecuta = puestoNameToPuestoMap.get(process.puesto);
      const jefeInmediato = puestoQueEjecuta?.jefeInmediato ? puestosMap.get(puestoQueEjecuta.jefeInmediato) : null;
      const departamento = puestoQueEjecuta ? departamentosMap.get(puestoQueEjecuta.departamentoId || '') : null;
      const relatedPolicies = (process.politicasAsociadas || []).map(link => politicasMap.get(link.policyId)).filter((p): p is Politica => !!p);


      return {
        ...nullDetails, name: process.proceso, process, departamento, jefeInmediato,
        procedimientos: procedimientosDelProceso, relatedPolicies,
      };

    } else if (currentAuditSession.auditType === 'puesto') {
      const puesto = puestosMap.get(currentAuditSession.targetId);
      if (!puesto) return nullDetails;
      
      const jefeInmediato = puesto.jefeInmediato ? puestosMap.get(puesto.jefeInmediato) : null;
      const departamento = puesto.departamentoId ? departamentosMap.get(puesto.departamentoId) : null;

      let relatedProcessesForPuesto = allProcesses.filter(proc => proc.puesto === puesto.nombre);

      if (currentAuditSession.processIdsToAudit && currentAuditSession.processIdsToAudit.length > 0) {
        const processIdSet = new Set(currentAuditSession.processIdsToAudit);
        relatedProcessesForPuesto = relatedProcessesForPuesto.filter(proc => processIdSet.has(proc.id));
      }

      const relatedProcessesData = relatedProcessesForPuesto
        .map(proc => ({
          process: proc,
          procedimientos: (proc.procedimientoOrder || [])
            .map(procId => procedimientosMap.get(procId))
            .filter((p): p is Procedimiento => !!p)
            .map(p => ({
                procedimiento: p,
                activities: (p.activityOrder || [])
                    .map(actId => actividadesMap.get(actId))
                    .filter((act): act is Actividad => !!act)
                    .filter(activityFilterFunc)
            }))
        }));
      
        const policyIds = new Set<string>();
        relatedProcessesForPuesto.forEach(proc => {
            (proc.politicasAsociadas || []).forEach(link => policyIds.add(link.policyId));
        });
        const relatedPolicies = Array.from(policyIds).map(id => politicasMap.get(id)).filter((p): p is Politica => !!p);

      return {
        ...nullDetails, name: puesto.nombre, puesto, relatedProcesses: relatedProcessesData,
        departamento, jefeInmediato, relatedPolicies
      };
    } else if (currentAuditSession.auditType === 'sistema') {
        const sistema = sistemasMap.get(currentAuditSession.targetId);
        if(!sistema) return nullDetails;

        const costosDelSistema = costosSistemas.filter(c => c.sistemaId === sistema.id);
        const procesosQueUsanSistema = allProcesses.filter(p => (p.sistemas || []).includes(sistema.nombre));

        const policyIds = new Set<string>();
        procesosQueUsanSistema.forEach(proc => {
            (proc.politicasAsociadas || []).forEach(link => policyIds.add(link.policyId));
        });
        const relatedPolicies = Array.from(policyIds).map(id => politicasMap.get(id)).filter((p): p is Politica => !!p);

        return {
            ...nullDetails,
            name: sistema.nombre, sistema: {...sistema, costos: costosDelSistema },
            relatedProcesses: procesosQueUsanSistema.map(p => ({ process: p, procedimientos: []})),
            relatedPolicies,
        }
    } else if (currentAuditSession.auditType === 'politica') {
        const policy = politicasMap.get(currentAuditSession.targetId);
        if(!policy) return nullDetails;

        const linkedProcesses = (policy.procesosAsociadosIds || [])
            .map(id => procesosMap.get(id))
            .filter((p): p is CapturedProcess => !!p);

        return {
            ...nullDetails, name: policy.titulo, policy, linkedProcesses,
        }
    } else if (currentAuditSession.auditType === 'procedimiento') {
        const procedimiento = procedimientosMap.get(currentAuditSession.targetId);
        if(!procedimiento) return nullDetails;

        const parentProcess = procesosMap.get(procedimiento.procesoId);

        const activities = (procedimiento.activityOrder || [])
            .map(actId => actividadesMap.get(actId))
            .filter((act): act is Actividad => !!act)
            .filter(activityFilterFunc);
        
        const relatedPolicies = (procedimiento.politicasAsociadasIds || []).map(id => politicasMap.get(id)).filter((p): p is Politica => !!p);

        return {
            ...nullDetails, name: procedimiento.nombre, procedimiento, process: parentProcess,
            procedimientos: [{ procedimiento, activities }], // Re-using this structure for display
            relatedPolicies,
        }
    }
    return null;
  }, [currentAuditSession, activityDisplayFilter, procesosMap, procedimientosMap, actividadesMap, puestosMap, puestoNameToPuestoMap, departamentosMap, areasMap, sistemasMap, politicasMap, allProcesses, costosSistemas]);

  useEffect(() => {
    if (isFindingDialogOpen) {
        if (editingFinding) {
            findingForm.reset(editingFinding);
        } else {
            findingForm.reset({ type: undefined, description: '', proposedAction: '' });
        }
    }
  }, [isFindingDialogOpen, editingFinding, findingForm]);


  const handleStartNewAudit = async () => {
    if (!newAuditType || !newAuditTargetId) {
      toast({ title: "Información incompleta", description: "Debe seleccionar un tipo y un objetivo para la auditoría." });
      return;
    }
    const targetName = newAuditType === 'proceso'
      ? procesosMap.get(newAuditTargetId)?.proceso
      : newAuditType === 'puesto' ? puestosMap.get(newAuditTargetId)?.nombre
      : newAuditType === 'sistema' ? sistemasMap.get(newAuditTargetId)?.nombre
      : newAuditType === 'politica' ? politicasMap.get(newAuditTargetId)?.titulo
      : newAuditType === 'procedimiento' ? procedimientosMap.get(newAuditTargetId)?.nombre
      : undefined;

    if (!targetName) {
        toast({ title: "Error", description: "No se encontró el nombre del objetivo seleccionado." });
        return;
    }

    const newAuditData: AuditCreationData = {
      auditType: newAuditType,
      targetId: newAuditTargetId,
      targetName: targetName,
      auditorName: newAuditorName,
      auditDate: new Date().toISOString(),
      status: 'En Progreso',
      findings: [],
      processIdsToAudit: (newAuditType === 'puesto' && newAuditProcessIds.length > 0) ? newAuditProcessIds : undefined,
    };
    
    const newAuditId = await addAudit(newAuditData);
    if (newAuditId) {
        const auditDataFromDb = {
            ...newAuditData,
            id: newAuditId,
            codigo: `AUD-${new Date().getFullYear()}-TEMP`, // Placeholder, context will update
            createdAt: Date.now()
        };
        setCurrentAuditSession(auditDataFromDb);
    }

    setIsStartAuditDialogOpen(false);
    setNewAuditType('');
    setNewAuditTargetId('');
    setNewAuditProcessIds([]);
  };

  const handleStartAuditFromAlert = (type: 'proceso' | 'puesto' | 'procedimiento', id: string) => {
    setNewAuditType(type);
    setNewAuditTargetId(id);
    setIsStartAuditDialogOpen(true);
  };
  
  const handleFindingSubmit = (data: AuditFindingFormData) => {
    if (!currentAuditSession) return;
    
    let updatedFindings: AuditFinding[];

    if (editingFinding) {
      // Update existing finding
      updatedFindings = currentAuditSession.findings.map(f =>
        f.id === editingFinding.id ? { ...f, ...data } : f
      );
    } else {
      // Add new finding
      const newFinding: AuditFinding = { ...data, id: Date.now().toString(), isActionCreated: false };
      updatedFindings = [...currentAuditSession.findings, newFinding];
    }
    
    const updatedAudit = { ...currentAuditSession, findings: updatedFindings };
    setCurrentAuditSession(updatedAudit);
    updateAudit(currentAuditSession.id, { findings: updatedFindings });

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
    
    const updatedFindings = currentAuditSession.findings.filter(f => f.id !== findingToDelete.id);
    const updatedAudit = { ...currentAuditSession, findings: updatedFindings };
    setCurrentAuditSession(updatedAudit);
    updateAudit(currentAuditSession.id, { findings: updatedFindings });

    toast({ title: "Hallazgo Eliminado", description: "El hallazgo ha sido eliminado de la auditoría.", variant: "destructive" });
    
    setFindingToDelete(null);
    setIsConfirmDeleteFindingOpen(false);
  }

  const handleCreateActionPlan = async (finding: AuditFinding, auditContext: Audit) => {
    if (!auditContext) return;

    try {
      let actionData: any = {
        nombre: `Hallazgo en ${auditContext.auditType}: ${auditContext.targetName}`,
        descripcion: `Descripción del Hallazgo: ${finding.description}\n\nPlan de Acción Propuesto: ${finding.proposedAction}`,
        responsable: 'Por Asignar',
        estado: 'En Revisión',
        origenMejora: `Auditoría - ${auditContext.auditorName}`,
      };

      if (auditContext.auditType === 'proceso') {
        const target = procesosMap.get(auditContext.targetId);
        if (target) {
            actionData.procesoId = target.id;
            actionData.area = target.area;
            actionData.puesto = target.puesto;
        }
      } else if (auditContext.auditType === 'puesto') {
        const target = puestosMap.get(auditContext.targetId);
        if (target) {
          actionData.puesto = target.nombre;
          actionData.area = areasMap.get(target.areaId)?.nombre;
        }
      }

      await addAccion(actionData);
      
      const updatedFindings = auditContext.findings.map(f =>
        f.id === finding.id ? { ...f, isActionCreated: true } : f
      );
      
      const updatedAudit = { ...auditContext, findings: updatedFindings };
      setCurrentAuditSession(updatedAudit);
      updateAudit(currentAuditSession.id, { findings: updatedFindings });
      
      toast({ title: "Plan de Acción Creado", description: "Se ha registrado la acción en el módulo de 'Acciones de Mejora'."});
    } catch (e: any) {
      console.error("Error creating action plan: ", e.message);
      toast({ title: "Error", description: "No se pudo crear el plan de acción.", variant: "destructive" });
    }
  };
  
  const executeFinalization = async (auditToSave: Audit) => {
    const now = new Date().toISOString();
    try {
        if (auditToSave.auditType === 'proceso') {
            await updateProceso(auditToSave.targetId, { lastAuditedAt: now });
        } else if (auditToSave.auditType === 'puesto') {
            await updatePuesto(auditToSave.targetId, { lastAuditedAt: now });
        } else if (auditToSave.auditType === 'procedimiento') {
            await updateProcedimiento(auditToSave.targetId, { lastAuditedAt: now });
        }

        const finalAudit = { ...auditToSave, status: 'Completada' as const };
        await updateAudit(finalAudit.id, { status: 'Completada' });
        
        addLogEntry({ user: finalAudit.auditorName, action: 'status_change', entityType: 'Auditoría', entityName: finalAudit.targetName, details: `Se finalizó la auditoría para "${finalAudit.targetName}".` });
        setCurrentAuditSession(null);
        toast({ title: "Auditoría Finalizada", description: "La auditoría ha sido guardada." });

    } catch (error: any) {
        console.error("Error finalizing audit:", error.message);
        toast({ title: "Error al Finalizar", description: "No se pudo actualizar la fecha de auditoría del elemento.", variant: "destructive" });
    }
  };

  const handleFinalizeAudit = () => {
    if (!currentAuditSession) return;

    if (!currentAuditSession.findings || currentAuditSession.findings.length === 0) {
      toast({
        title: "Acción no permitida",
        description: "Debe registrar al menos un hallazgo (ej. 'Conforme') para poder finalizar la auditoría.",
        variant: "destructive"
      });
      return;
    }
    
    const pendingFindings = currentAuditSession.findings.filter(f => (f.type === 'No Conforme' || f.type === 'Oportunidad de Mejora') && !f.isActionCreated);
    
    if (pendingFindings.length > 0) {
        setAuditToFinalize(currentAuditSession);
        setFinalizeOptions({ autoCreateActions: true });
        setIsFinalizeConfirmDialogOpen(true);
    } else {
        executeFinalization(currentAuditSession);
    }
  };

  const handleConfirmFinalization = async () => {
    if (!auditToFinalize) return;

    let updatedAudit = { ...auditToFinalize };
    let newActionsCreated = false;

    if (finalizeOptions.autoCreateActions) {
        const pendingFindings = updatedAudit.findings.filter(
            f => (f.type === 'No Conforme' || f.type === 'Oportunidad de Mejora') && !f.isActionCreated
        );

        for (const finding of pendingFindings) {
            await handleCreateActionPlan(finding, updatedAudit);
            newActionsCreated = true;
        }

        if (newActionsCreated) {
            // Re-fetch or manually update the local state to reflect isActionCreated flag
            const currentAuditState = { ...updatedAudit };
            updatedAudit = {
                ...currentAuditState,
                findings: currentAuditState.findings.map(f => {
                    const wasPending = pendingFindings.some(pf => pf.id === f.id);
                    return wasPending ? { ...f, isActionCreated: true } : f;
                })
            };
        }
    }
    
    await executeFinalization(updatedAudit);
    
    setIsFinalizeConfirmDialogOpen(false);
    setAuditToFinalize(null);
  }
  
  const handleEditAudit = (audit: Audit) => {
    if (audit.status === 'Completada' || audit.status === 'Cancelada') {
      setActiveTab('historial');
      setCurrentAuditSession(audit);
    } else {
      const auditToOpen = { ...audit, status: 'En Progreso' as const };
      updateAudit(audit.id, { status: 'En Progreso' });
      setActiveTab('historial');
      setCurrentAuditSession(auditToOpen);
    }
  };

  const promptDeleteAudit = (audit: Audit) => {
    if (audit.status !== 'En Progreso') {
      toast({
        title: 'Acción no permitida',
        description: 'Solo se pueden eliminar auditorías con estado "En Progreso".',
        variant: 'default',
      });
      return;
    }
    setAuditToDelete(audit);
    setIsConfirmDeleteAuditOpen(true);
  };
  
  const promptCancelAudit = (audit: Audit) => {
    if (audit.findings && audit.findings.length > 0) {
        toast({
            title: "Acción no permitida",
            description: "No se puede cancelar una auditoría que ya tiene hallazgos registrados.",
            variant: "default"
        });
        return;
    }
    setAuditToCancel(audit);
    setIsConfirmCancelAuditOpen(true);
  };

  const executeCancelAudit = async () => {
    if (!auditToCancel || !cancellationReason.trim()) {
        toast({ title: "Justificación requerida", description: "Por favor, ingrese un motivo para la cancelación.", variant: "destructive" });
        return;
    }
    try {
      await updateAudit(auditToCancel.id, { 
        status: 'Cancelada', 
        cancellationReason: cancellationReason 
      });
      addLogEntry({ 
        user: auditToCancel.auditorName, 
        action: 'status_change', 
        entityType: 'Auditoría', 
        entityName: auditToCancel.targetName, 
        details: `Se canceló la auditoría para "${auditToCancel.targetName}" por el siguiente motivo: ${cancellationReason}.` 
      });
      setCurrentAuditSession(null);
      toast({ title: "Auditoría Cancelada", description: "La sesión de auditoría ha sido cancelada." });
    } catch (error: any) {
      console.error("Error canceling audit:", error.message);
      toast({ title: "Error", description: "No se pudo cancelar la auditoría.", variant: "destructive" });
    } finally {
      setIsConfirmCancelAuditOpen(false);
      setAuditToCancel(null);
      setCancellationReason("");
    }
  };


  const executeDeleteAudit = () => {
    if (!auditToDelete) return;
    deleteAudit(auditToDelete.id);
    setAuditToDelete(null);
    setIsConfirmDeleteAuditOpen(false);
  };

  const processMetrics = (audits: Audit[]) => {
      const completedAudits = audits.filter(a => a.status === 'Completada');
      return {
          auditoriasCompletadasCount: completedAudits.length,
          hallazgosNoConformesCount: completedAudits.reduce((sum, audit) => sum + (audit.findings || []).filter(f => f.type === 'No Conforme').length, 0),
          hallazgosOportunidadCount: completedAudits.reduce((sum, audit) => sum + (audit.findings || []).filter(f => f.type === 'Oportunidad de Mejora').length, 0),
      };
  }

  const filteredAndSortedAudits = useMemo(() => {
    setAuditCurrentPage(1);
    let filtered = pastAudits.filter(audit => {
      const lowerSearch = auditSearchTerm.toLowerCase();
      const matchesSearch = audit.targetName.toLowerCase().includes(lowerSearch) || audit.auditorName.toLowerCase().includes(lowerSearch) || (audit.codigo || '').toLowerCase().includes(lowerSearch);
      const matchesType = auditTypeFilter === 'all' || audit.auditType === auditTypeFilter;
      const matchesStatus = auditStatusFilter === 'all' || audit.status === auditStatusFilter;
      const pendingCount = (audit.findings || []).filter(f => (f.type === 'No Conforme' || f.type === 'Oportunidad de Mejora') && !f.isActionCreated).length;
      const matchesPending = pendingActionsFilter === 'all' ||
                           (pendingActionsFilter === 'with_pending' && pendingCount > 0) ||
                           (pendingActionsFilter === 'no_pending' && pendingCount === 0);
      return matchesSearch && matchesType && matchesStatus && matchesPending;
    });

    if (auditSortConfig !== null) {
      filtered.sort((a, b) => {
        let valA: any, valB: any;
        if (auditSortConfig.key === 'numFindings') {
          valA = a.findings.length;
          valB = b.findings.length;
        } else if (auditSortConfig.key === 'pendingActions') {
            valA = (a.findings || []).filter(f => (f.type === 'No Conforme' || f.type === 'Oportunidad de Mejora') && !f.isActionCreated).length;
            valB = (b.findings || []).filter(f => (f.type === 'No Conforme' || f.type === 'Oportunidad de Mejora') && !f.isActionCreated).length;
        } else {
          valA = a[auditSortConfig.key as keyof Audit];
          valB = b[auditSortConfig.key as keyof Audit];
        }

        if (auditSortConfig.key === 'auditDate') {
          valA = valA ? parseISO(valA).getTime() : 0;
          valB = valB ? parseISO(valB).getTime() : 0;
        }

        if (typeof valA === 'string' && typeof valB === 'string') {
          valA = valA.toLowerCase();
          valB = valB.toLowerCase();
        }
        
        if (valA < valB) return auditSortConfig.direction === 'ascending' ? -1 : 1;
        if (valA > valB) return auditSortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    } else {
      filtered.sort((a,b) => parseISO(b.auditDate).getTime() - parseISO(a.auditDate).getTime());
    }
    return filtered;
  }, [pastAudits, auditSearchTerm, auditTypeFilter, auditStatusFilter, pendingActionsFilter, auditSortConfig]);

  const totalAuditPages = Math.ceil(filteredAndSortedAudits.length / AUDIT_ITEMS_PER_PAGE);
  const paginatedAudits = useMemo(() => filteredAndSortedAudits.slice((auditCurrentPage - 1) * AUDIT_ITEMS_PER_PAGE, auditCurrentPage * AUDIT_ITEMS_PER_PAGE), [filteredAndSortedAudits, auditCurrentPage]);
  
  const requestAuditSort = (key: SortableAuditKeys) => {
    let direction: SortDirection = 'ascending';
    if (auditSortConfig?.key === key && auditSortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setAuditSortConfig({ key, direction });
  };
  const getAuditSortIcon = (key: SortableAuditKeys) => {
    if (!auditSortConfig || auditSortConfig.key !== key) return <ChevronsUpDown className="ml-1 h-3 w-3 opacity-40 group-hover:opacity-100" />;
    return auditSortConfig.direction === 'ascending' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />;
  };

  const actionTranslations: Record<LogAction, string> = {
    create: 'Creación',
    update: 'Actualización',
    delete: 'Eliminación',
    status_change: 'Cambio de Estado',
    restore: 'Restauración',
    analysis: 'Análisis IA',
    login: 'Inicio de Sesión',
    logout: 'Cierre de Sesión',
  };

  const actionBadgeClasses: Record<LogAction, string> = {
    create: 'bg-green-600 hover:bg-green-700',
    update: 'bg-blue-600 hover:bg-blue-700',
    delete: 'bg-red-600 hover:bg-red-700',
    status_change: 'bg-purple-600 hover:bg-purple-700',
    restore: 'bg-cyan-600 hover:bg-cyan-700',
    analysis: 'bg-indigo-600 hover:bg-indigo-700',
    login: 'bg-gray-500 hover:bg-gray-600',
    logout: 'bg-gray-500 hover:bg-gray-600',
  };

  const uniqueLogEntityTypes = useMemo(() => Array.from(new Set(logEntries.map(log => log.entityType))), [logEntries]);
  const logEntityTypeOptions = useMemo(() => [
    { value: 'all', label: 'Todas las Entidades' },
    ...uniqueLogEntityTypes.map(type => ({ value: type, label: type }))
  ], [uniqueLogEntityTypes]);
  const uniqueLogActions = useMemo(() => Array.from(new Set(logEntries.map(log => log.action))), [logEntries]);
  const logActionOptions = useMemo(() => [
    { value: 'all', label: 'Todas las Acciones' },
    ...uniqueLogActions.map(action => ({ value: action, label: actionTranslations[action] || action }))
  ], [uniqueLogActions, actionTranslations]);


  const filteredAndSortedLogs = useMemo(() => {
    setLogCurrentPage(1);
    let filtered = logEntries.filter(log => {
      const lowerSearch = logSearchTerm.toLowerCase();
      const matchesSearch = log.user?.toLowerCase().includes(lowerSearch) || log.entityName.toLowerCase().includes(lowerSearch) || log.details.toLowerCase().includes(lowerSearch);
      const matchesAction = logActionFilter === 'all' || log.action === logActionFilter;
      const matchesEntityType = logEntityTypeFilter === 'all' || log.entityType === logEntityTypeFilter;
      return matchesSearch && matchesAction && matchesEntityType;
    });

    if (logSortConfig !== null) {
      filtered.sort((a, b) => {
        let valA = a[logSortConfig.key as keyof ActivityLogEntry];
        let valB = b[logSortConfig.key as keyof ActivityLogEntry];

        if (logSortConfig.key === 'timestamp') {
          valA = a.timestamp;
          valB = b.timestamp;
        }

        if (typeof valA === 'string' && typeof valB === 'string') {
          valA = valA.toLowerCase();
          valB = valB.toLowerCase();
        }
        
        if (valA < valB) return logSortConfig.direction === 'ascending' ? -1 : 1;
        if (valA > valB) return logSortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    } else {
       filtered.sort((a, b) => b.timestamp - a.timestamp);
    }
    return filtered;
  }, [logEntries, logSearchTerm, logActionFilter, logEntityTypeFilter, logSortConfig]);
  
  const totalLogPages = Math.ceil(filteredAndSortedLogs.length / LOG_ITEMS_PER_PAGE);
  const paginatedLogs = useMemo(() => filteredAndSortedLogs.slice((logCurrentPage - 1) * LOG_ITEMS_PER_PAGE, logCurrentPage * LOG_ITEMS_PER_PAGE), [filteredAndSortedLogs, logCurrentPage]);
  
  const requestLogSort = (key: SortableLogKeys) => {
    let direction: SortDirection = 'ascending';
    if (logSortConfig?.key === key && logSortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setLogSortConfig({ key, direction });
  };
  const getLogSortIcon = (key: SortableLogKeys) => {
    if (!logSortConfig || logSortConfig.key !== key) return <ChevronsUpDown className="ml-1 h-3 w-3 opacity-40 group-hover:opacity-100" />;
    return logSortConfig.direction === 'ascending' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />;
  };

  const isLoadingAllData = isLoadingAudits || isLoadingActividades || isLoadingPuestos || isLoadingDepartamentos || isLoadingSistemasCostos || isLoadingProcesos || isLoadingProcedimientos || isLoadingPoliticas;

  const auditAlerts = useMemo(() => {
    if (isLoadingAllData) return [];
  
    const now = new Date();
    const alerts: { id: string; type: AuditType; name: string; lastAudited?: string; daysOverdue: number }[] = [];
  
    allProcesses.forEach(proc => {
      try {
        if (!proc || typeof proc.auditFrequencyInDays !== 'number' || !isFinite(proc.auditFrequencyInDays)) return;
  
        const lastAuditDate = proc.lastAuditedAt ? parseISO(proc.lastAuditedAt) : null;
        if (!lastAuditDate || !isValid(lastAuditDate)) {
          alerts.push({ id: proc.id, type: 'proceso', name: proc.proceso, daysOverdue: 9999 }); // Never audited
        } else {
          const nextDueDate = addDays(lastAuditDate, proc.auditFrequencyInDays);
          if (now > nextDueDate) {
            alerts.push({ id: proc.id, type: 'proceso', name: proc.proceso, lastAudited: proc.lastAuditedAt, daysOverdue: differenceInDays(now, nextDueDate) });
          }
        }
      } catch (error: any) {
        console.error(`Failed to process audit alert for process ${proc?.id}:`, error.message);
      }
    });
  
    puestos.forEach(puesto => {
      try {
        if (!puesto || typeof puesto.auditFrequencyInDays !== 'number' || !isFinite(puesto.auditFrequencyInDays)) return;
        const lastAuditDate = puesto.lastAuditedAt ? parseISO(puesto.lastAuditedAt) : null;
        if (!lastAuditDate || !isValid(lastAuditDate)) {
          alerts.push({ id: puesto.id, type: 'puesto', name: puesto.nombre, daysOverdue: 9999 });
        } else {
          const nextDueDate = addDays(lastAuditDate, puesto.auditFrequencyInDays);
          if (now > nextDueDate) {
            alerts.push({ id: puesto.id, type: 'puesto', name: puesto.nombre, lastAudited: puesto.lastAuditedAt, daysOverdue: differenceInDays(now, nextDueDate) });
          }
        }
      } catch (error: any) {
        console.error(`Failed to process audit alert for puesto ${puesto?.id}:`, error.message);
      }
    });
  
    allProcedimientos.forEach(proc => {
      try {
        if (!proc || typeof proc.auditFrequencyInDays !== 'number' || !isFinite(proc.auditFrequencyInDays)) return;
        const lastAuditDate = proc.lastAuditedAt ? parseISO(proc.lastAuditedAt) : null;
        if (!lastAuditDate || !isValid(lastAuditDate)) {
          alerts.push({ id: proc.id, type: 'procedimiento', name: proc.nombre, daysOverdue: 9999 });
        } else {
          const nextDueDate = addDays(lastAuditDate, proc.auditFrequencyInDays);
          if (now > nextDueDate) {
            alerts.push({ id: proc.id, type: 'procedimiento', name: proc.nombre, lastAudited: proc.lastAuditedAt, daysOverdue: differenceInDays(now, nextDueDate) });
          }
        }
      } catch (error: any) {
        console.error(`Failed to process audit alert for procedimiento ${proc?.id}:`, error.message);
      }
    });
    
    return alerts.sort((a,b) => b.daysOverdue - a.daysOverdue);
  
  }, [allProcesses, puestos, allProcedimientos, isLoadingAllData]);

  const filteredAuditAlerts = useMemo(() => {
    setAuditAlertCurrentPage(1);
    let filtered = auditAlerts.filter(alert => {
        const nameMatch = alert.name.toLowerCase().includes(auditAlertSearchTerm.toLowerCase());
        const typeMatch = auditAlertTypeFilter === 'all' || alert.type === auditAlertTypeFilter;
        
        let daysOverdue = alert.daysOverdue;
        if (daysOverdue > 9000) daysOverdue = Infinity; 

        const daysMatch = auditAlertDaysFilter === 'all' ||
                          (auditAlertDaysFilter === '30' && daysOverdue > 30) ||
                          (auditAlertDaysFilter === '90' && daysOverdue > 90) ||
                          (auditAlertDaysFilter === '180' && daysOverdue > 180);

        return nameMatch && typeMatch && daysMatch;
    });

    if (auditAlertSortConfig !== null) {
      filtered.sort((a, b) => {
        const valA = a[auditAlertSortConfig.key];
        const valB = b[auditAlertSortConfig.key];
        if (typeof valA === 'string' && typeof valB === 'string') {
            if (valA.toLowerCase() < valB.toLowerCase()) return auditAlertSortConfig.direction === 'ascending' ? -1 : 1;
            if (valA.toLowerCase() > valB.toLowerCase()) return auditAlertSortConfig.direction === 'ascending' ? 1 : -1;
            return 0;
        } else if (typeof valA === 'number' && typeof valB === 'number') {
            if (valA < valB) return auditAlertSortConfig.direction === 'ascending' ? -1 : 1;
            if (valA > valB) return auditAlertSortConfig.direction === 'ascending' ? 1 : -1;
            return 0;
        }
        return 0;
      });
    }

    return filtered;
  }, [auditAlerts, auditAlertSearchTerm, auditAlertTypeFilter, auditAlertDaysFilter, auditAlertSortConfig]);

  const requestAuditAlertSort = (key: SortableAuditAlertKeys) => {
    let direction: SortDirection = 'ascending';
    if (auditAlertSortConfig?.key === key && auditAlertSortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setAuditAlertSortConfig({ key, direction });
  };
  const getAuditAlertSortIcon = (key: SortableAuditAlertKeys) => {
    if (!auditAlertSortConfig || auditAlertSortConfig.key !== key) return <ChevronsUpDown className="ml-1 h-3 w-3 opacity-40 group-hover:opacity-100" />;
    return auditAlertSortConfig.direction === 'ascending' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />;
  };

  const totalAuditAlertPages = Math.ceil(filteredAuditAlerts.length / AUDIT_ALERT_ITEMS_PER_PAGE);
  const paginatedAuditAlerts = useMemo(() => {
    return filteredAuditAlerts.slice(
        (auditAlertCurrentPage - 1) * AUDIT_ALERT_ITEMS_PER_PAGE,
        auditAlertCurrentPage * AUDIT_ALERT_ITEMS_PER_PAGE
    );
  }, [filteredAuditAlerts, auditAlertCurrentPage]);

  const auditTargetOptions = useMemo(() => {
    switch (newAuditType) {
      case 'proceso': return allProcesses.map(p => ({ value: p.id, label: p.proceso }));
      case 'puesto': return puestos.map(p => ({ value: p.id, label: p.nombre }));
      case 'sistema': return sistemas.map(s => ({ value: s.id, label: s.nombre }));
      case 'politica': return allPoliticas.map(p => ({ value: p.id, label: `${p.codigo} - ${p.titulo}` }));
      case 'procedimiento': return allProcedimientos.map(p => ({ value: p.id, label: p.nombre }));
      default: return [];
    }
  }, [newAuditType, allProcesses, puestos, sistemas, allPoliticas, allProcedimientos]);

  const procesosDelPuestoOptions = useMemo(() => {
    if (newAuditType !== 'puesto' || !newAuditTargetId) return [];
    return allProcesses
      .filter(p => p.puestoId === newAuditTargetId)
      .map(proc => ({ value: proc.id, label: proc.proceso }));
  }, [newAuditType, newAuditTargetId, allProcesses]);

  const handleAuditExport = () => {
    if (filteredAndSortedAudits.length === 0) {
        toast({ title: "Nada que exportar", description: "No hay auditorías que coincidan con los filtros actuales.", variant: "default" });
        return;
    }

    const headers = ["Código Auditoría", "Fecha", "Tipo", "Objetivo Auditado", "Auditor", "Estado", "Total Hallazgos", "Hallazgos No Conformes", "Oportunidades de Mejora", "Acciones Pendientes"];
    
    const csvRows = [
        headers.join(','),
        ...filteredAndSortedAudits.map(audit => {
            const totalFindings = audit.findings.length;
            const nonConform = audit.findings.filter(f => f.type === 'No Conforme').length;
            const opportunity = audit.findings.filter(f => f.type === 'Oportunidad de Mejora').length;
            const pendingActions = (audit.findings || []).filter(f => (f.type === 'No Conforme' || f.type === 'Oportunidad de Mejora') && !f.isActionCreated).length;

            return [
                escapeCsvCell(audit.codigo),
                escapeCsvCell(format(parseISO(audit.auditDate), 'yyyy-MM-dd')),
                escapeCsvCell(audit.auditType),
                escapeCsvCell(audit.targetName),
                escapeCsvCell(audit.auditorName),
                escapeCsvCell(audit.status),
                escapeCsvCell(totalFindings),
                escapeCsvCell(nonConform),
                escapeCsvCell(opportunity),
                escapeCsvCell(pendingActions)
            ].join(',');
        })
    ];

    const csvString = csvRows.join('\n');
    const blob = new Blob(["\uFEFF" + csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `historial_auditorias_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast({ title: "Exportación Iniciada", description: "El archivo CSV se está descargando." });
    } else {
        toast({ title: "Exportación Fallida", description: "Su navegador no soporta la descarga directa.", variant: "destructive" });
    }
  };


  if (isLoadingAllData) {
    return (
      <div className="container mx-auto py-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-16 w-16 text-primary animate-spin" />
        <div className="ml-4 text-lg text-muted-foreground">Cargando datos de auditoría...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      {currentAuditSession ? (
        <AuditSessionView
          allProcedimientos={allProcedimientos} 
          auditSession={currentAuditSession}
          onGoBack={() => {
              const previousTab = activeTab;
              setCurrentAuditSession(null);
              setTimeout(() => setActiveTab(previousTab), 0);
          }}
          onFinalize={handleFinalizeAudit}
          onCancel={() => promptCancelAudit(currentAuditSession)}
          onAddFinding={() => { setEditingFinding(null); setIsFindingDialogOpen(true); }}
          onEditFinding={(f) => { setEditingFinding(f); setIsFindingDialogOpen(true); }}
          onDeleteFinding={promptDeleteFinding}
          onCreateActionPlan={handleCreateActionPlan}
          auditTargetDetails={auditTargetDetails}
          activityDisplayFilter={activityDisplayFilter}
          setActivityDisplayFilter={setActivityDisplayFilter}
          puestosMap={puestosMap}
          procedimientosMap={procedimientosMap}
          politicasMap={politicasMap}
        />
      ) : (
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <div className="flex items-center gap-2 mb-1">
                <ClipboardCheck className="h-6 w-6 text-primary" />
                <CardTitle className="text-2xl font-headline">Auditoría y Cumplimiento</CardTitle>
              </div>
               <Dialog open={isStartAuditDialogOpen} onOpenChange={setIsStartAuditDialogOpen}>
                  <DialogTrigger asChild>
                      <Button><PlayCircle className="mr-2 h-4 w-4"/>Iniciar Nueva Auditoría</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Iniciar Nueva Auditoría</DialogTitle>
                      <DialogDescription>Seleccione qué desea auditar y quién es el auditor.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                          <Label htmlFor="auditor-name">Nombre del Auditor</Label>
                          <Input id="auditor-name" value={newAuditorName} onChange={e => setNewAuditorName(e.target.value)} />
                      </div>
                      <div>
                          <Label>Tipo de Auditoría</Label>
                          <Select value={newAuditType} onValueChange={(value: AuditType) => { setNewAuditType(value); setNewAuditTargetId(''); }}>
                          <SelectTrigger><SelectValue placeholder="Seleccione un tipo..." /></SelectTrigger>
                          <SelectContent>
                              <SelectItem value="proceso">Proceso</SelectItem>
                              <SelectItem value="puesto">Puesto</SelectItem>
                              <SelectItem value="sistema">Sistema</SelectItem>
                              <SelectItem value="politica">Política</SelectItem>
                              <SelectItem value="procedimiento">Procedimiento</SelectItem>
                          </SelectContent>
                          </Select>
                      </div>
                      <div>
                          <Label>Objetivo Específico</Label>
                           <Select value={newAuditTargetId} onValueChange={setNewAuditTargetId} disabled={!newAuditType}>
                                <SelectTrigger><SelectValue placeholder={!newAuditType ? "Seleccione un tipo primero" : "Seleccione un objetivo..."} /></SelectTrigger>
                                <SelectContent>
                                    {auditTargetOptions.map(opt => (<SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>))}
                                </SelectContent>
                           </Select>
                      </div>
                       {newAuditType === 'puesto' && (
                          <div>
                            <Label>Procesos a Auditar (Opcional)</Label>
                             <MultiSelect
                                value={newAuditProcessIds}
                                onChange={setNewAuditProcessIds}
                                options={procesosDelPuestoOptions}
                                placeholder="Todos los procesos del puesto"
                              />
                            <div className="text-sm text-muted-foreground mt-1">
                                Si no selecciona procesos, se auditarán todos los del puesto.
                            </div>
                          </div>
                      )}
                    </div>
                    <DialogFooter>
                      <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                      <Button onClick={handleStartNewAudit} disabled={!newAuditType || !newAuditTargetId}>Iniciar Auditoría</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
            </div>
             <CardDescription className="text-muted-foreground mt-2">
                Inicie nuevas auditorías, consulte el historial y monitoree el registro de actividad del sistema.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="alertas" value={activeTab} onValueChange={(value) => setActiveTab(value as AuditTab)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="alertas">Alertas de Auditoría ({auditAlerts.length})</TabsTrigger>
                <TabsTrigger value="historial">Historial de Auditorías</TabsTrigger>
                <TabsTrigger value="log"><History className="mr-2 h-4 w-4"/>Registro de Actividad</TabsTrigger>
              </TabsList>
              
              <TabsContent value="alertas" className="mt-4">
                 <Card>
                    <CardHeader>
                        <CardTitle>Alertas de Auditoría Programada</CardTitle>
                        <CardDescription>Esta tabla muestra los procesos, puestos y procedimientos que requieren una auditoría basada en la frecuencia programada.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <Input placeholder="Buscar por nombre..." value={auditAlertSearchTerm} onChange={e => setAuditAlertSearchTerm(e.target.value)} />
                        <Select value={auditAlertTypeFilter} onValueChange={(v) => setAuditAlertTypeFilter(v as any)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Todos los Tipos</SelectItem>{auditTypes.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent></Select>
                        <Select value={auditAlertDaysFilter} onValueChange={(v) => setAuditAlertDaysFilter(v as any)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Cualquier Atraso</SelectItem><SelectItem value="30">Más de 30 días</SelectItem><SelectItem value="90">Más de 90 días</SelectItem><SelectItem value="180">Más de 180 días</SelectItem></SelectContent></Select>
                      </div>
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                                <TableHead className="cursor-pointer" onClick={() => requestAuditAlertSort('name')}>Objetivo a Auditar {getAuditAlertSortIcon('name')}</TableHead>
                                <TableHead>Última Auditoría</TableHead>
                                <TableHead className="text-right cursor-pointer" onClick={() => requestAuditAlertSort('daysOverdue')}>Días de Atraso {getAuditAlertSortIcon('daysOverdue')}</TableHead>
                                <TableHead className="text-right">Acción</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {paginatedAuditAlerts.length > 0 ? paginatedAuditAlerts.map(alert => (
                                <TableRow key={alert.id}>
                                    <TableCell>
                                      <p className="font-medium">{alert.name}</p>
                                      <p className="text-xs text-muted-foreground capitalize">{alert.type}</p>
                                    </TableCell>
                                    <TableCell>{alert.lastAudited ? format(parseISO(alert.lastAudited), 'dd/MM/yyyy', {locale: es}) : 'Nunca auditado'}</TableCell>
                                    <TableCell className="text-right"><Badge variant="destructive">{alert.daysOverdue > 9000 ? 'N/A' : `${alert.daysOverdue} días`}</Badge></TableCell>
                                    <TableCell className="text-right"><Button size="sm" onClick={() => handleStartAuditFromAlert(alert.type as any, alert.id)}><PlayCircle className="mr-2 h-4 w-4" /> Iniciar Auditoría</Button></TableCell>
                                </TableRow>
                            )) : (
                                <TableRow><TableCell colSpan={4} className="text-center">No hay alertas de auditoría.</TableCell></TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                      <div className="flex items-center justify-between space-x-2 py-4">
                        <div className="text-sm text-muted-foreground">Página {auditAlertCurrentPage} de {totalAuditAlertPages}</div>
                        <div className="space-x-2">
                           <Button variant="outline" size="sm" onClick={() => setAuditAlertCurrentPage(p => Math.max(1, p - 1))} disabled={auditAlertCurrentPage === 1}>Anterior</Button>
                           <Button variant="outline" size="sm" onClick={() => setAuditAlertCurrentPage(p => Math.min(totalAuditAlertPages, p + 1))} disabled={auditAlertCurrentPage >= totalAuditAlertPages}>Siguiente</Button>
                        </div>
                      </div>
                    </CardContent>
                 </Card>
              </TabsContent>

              <TabsContent value="historial" className="mt-4">
                <Card>
                  <CardHeader>
                      <div className="flex justify-between items-center"><CardTitle>Historial de Auditorías</CardTitle><Button variant="outline" onClick={handleAuditExport} disabled={filteredAndSortedAudits.length === 0}><FileText className="mr-2 h-4 w-4"/>Exportar</Button></div>
                      <CardDescription>Auditorías realizadas anteriormente.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                        <Input placeholder="Buscar por objetivo o auditor..." value={auditSearchTerm} onChange={e => setAuditSearchTerm(e.target.value)} />
                        <Select value={auditTypeFilter} onValueChange={v => setAuditTypeFilter(v as any)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Todos los Tipos</SelectItem>{auditTypes.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent></Select>
                        <Select value={auditStatusFilter} onValueChange={v => setAuditStatusFilter(v as any)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Todos los Estados</SelectItem>{auditStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
                        <Select value={pendingActionsFilter} onValueChange={v => setPendingActionsFilter(v as any)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem><SelectItem value="with_pending">Con Acciones Pendientes</SelectItem><SelectItem value="no_pending">Sin Acciones Pendientes</SelectItem></SelectContent></Select>
                     </div>
                     <div className="rounded-md border">
                        <Table><TableHeader><TableRow>
                            <TableHead className="cursor-pointer" onClick={() => requestAuditSort('codigo')}>Código {getAuditSortIcon('codigo')}</TableHead>
                            <TableHead className="cursor-pointer" onClick={() => requestAuditSort('targetName')}>Objetivo Auditado {getAuditSortIcon('targetName')}</TableHead>
                            <TableHead className="cursor-pointer" onClick={() => requestAuditSort('auditorName')}>Auditor {getAuditSortIcon('auditorName')}</TableHead>
                            <TableHead className="cursor-pointer" onClick={() => requestAuditSort('auditDate')}>Fecha {getAuditSortIcon('auditDate')}</TableHead>
                            <TableHead className="cursor-pointer" onClick={() => requestAuditSort('status')}>Estado {getAuditSortIcon('status')}</TableHead>
                            <TableHead className="text-center cursor-pointer" onClick={() => requestAuditSort('numFindings')}>Hallazgos {getAuditSortIcon('numFindings')}</TableHead>
                            <TableHead className="text-center cursor-pointer" onClick={() => requestAuditSort('pendingActions')}>Acciones Pend. {getAuditSortIcon('pendingActions')}</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow></TableHeader><TableBody>
                        {paginatedAudits.length > 0 ? paginatedAudits.map(audit => {
                            const pendingActions = (audit.findings || []).filter(f => (f.type === 'No Conforme' || f.type === 'Oportunidad de Mejora') && !f.isActionCreated).length;
                            return (
                            <TableRow key={audit.id}>
                                <TableCell className="font-mono text-xs">{audit.codigo}</TableCell>
                                <TableCell>
                                  <p className="font-medium">{audit.targetName}</p>
                                  <p className="text-xs text-muted-foreground capitalize">{audit.auditType}</p>
                                </TableCell>
                                <TableCell>{audit.auditorName}</TableCell>
                                <TableCell>{format(parseISO(audit.auditDate), 'dd/MM/yyyy')}</TableCell>
                                <TableCell>
                                  <Badge className={cn("text-white border-transparent", {
                                      "bg-green-600 hover:bg-green-700": audit.status === "Completada",
                                      "bg-red-600 hover:bg-red-700": audit.status === "Cancelada",
                                      "bg-orange-500 hover:bg-orange-600": audit.status === "En Progreso",
                                  })}>
                                      {audit.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center">{audit.findings?.length || 0}</TableCell>
                                <TableCell className="text-center">{pendingActions > 0 ? <Badge variant="destructive">{pendingActions}</Badge> : <Badge variant="secondary">0</Badge>}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="sm" onClick={() => handleEditAudit(audit)}>
                                      {audit.status === 'En Progreso' ? <Edit className="mr-2 h-4 w-4"/> : <Eye className="mr-2 h-4 w-4"/>}
                                      Ver / Editar
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => promptDeleteAudit(audit)} disabled={audit.status !== 'En Progreso'} className="text-destructive"><Trash2 className="h-4 w-4"/></Button>
                                </TableCell>
                            </TableRow>
                        )}) : <TableRow><TableCell colSpan={8} className="text-center">No hay auditorías registradas.</TableCell></TableRow>}
                        </TableBody></Table>
                    </div>
                     <div className="flex items-center justify-between space-x-2 py-4">
                        <div className="text-sm text-muted-foreground">Página {auditCurrentPage} de {totalAuditPages}</div>
                        <div className="space-x-2"><Button variant="outline" size="sm" onClick={() => setAuditCurrentPage(p => Math.max(1, p-1))} disabled={auditCurrentPage===1}>Anterior</Button><Button variant="outline" size="sm" onClick={() => setAuditCurrentPage(p=>Math.min(totalAuditPages, p+1))} disabled={auditCurrentPage >= totalAuditPages}>Siguiente</Button></div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="log" className="mt-4">
                 <Card>
                  <CardHeader><CardTitle>Registro de Actividad del Sistema</CardTitle></CardHeader>
                   <CardContent>
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <Input placeholder="Buscar por usuario, entidad o detalle..." value={logSearchTerm} onChange={e=>setLogSearchTerm(e.target.value)} />
                        <Select value={logEntityTypeFilter} onValueChange={setLogEntityTypeFilter}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{logEntityTypeOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent></Select>
                        <Select value={logActionFilter} onValueChange={v => setLogActionFilter(v as any)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{logActionOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent></Select>
                     </div>
                      <div className="rounded-md border">
                        <Table><TableHeader><TableRow>
                            <TableHead className="cursor-pointer" onClick={()=>requestLogSort('timestamp')}>Fecha y Hora {getLogSortIcon('timestamp')}</TableHead>
                            <TableHead className="cursor-pointer" onClick={()=>requestLogSort('user')}>Usuario {getLogSortIcon('user')}</TableHead>
                            <TableHead className="cursor-pointer" onClick={()=>requestLogSort('entityType')}>Tipo Entidad {getLogSortIcon('entityType')}</TableHead>
                            <TableHead className="cursor-pointer" onClick={()=>requestLogSort('entityName')}>Nombre Entidad {getLogSortIcon('entityName')}</TableHead>
                            <TableHead className="cursor-pointer" onClick={()=>requestLogSort('action')}>Acción {getLogSortIcon('action')}</TableHead>
                            <TableHead>Detalles</TableHead>
                        </TableRow></TableHeader><TableBody>
                        {paginatedLogs.length > 0 ? paginatedLogs.map(log => (
                            <TableRow key={log.id}>
                                <TableCell className="text-xs">{format(log.timestamp, 'dd/MM/yy HH:mm')}</TableCell>
                                <TableCell>{log.user}</TableCell>
                                <TableCell>{log.entityType}</TableCell>
                                <TableCell>{log.entityName}</TableCell>
                                <TableCell>
                                    <Badge className={cn("text-white border-transparent", actionBadgeClasses[log.action] || 'bg-gray-500')}>
                                      {actionTranslations[log.action] || log.action}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-xs">{log.details}</TableCell>
                            </TableRow>
                        )) : <TableRow><TableCell colSpan={6} className="text-center">No hay registros de actividad.</TableCell></TableRow>}
                        </TableBody></Table>
                     </div>
                      <div className="flex items-center justify-between space-x-2 py-4">
                        <div className="text-sm text-muted-foreground">Página {logCurrentPage} de {totalLogPages}</div>
                        <div className="space-x-2"><Button variant="outline" size="sm" onClick={()=>setLogCurrentPage(p=>Math.max(1, p-1))} disabled={logCurrentPage===1}>Anterior</Button><Button variant="outline" size="sm" onClick={()=>setLogCurrentPage(p=>Math.min(totalLogPages, p+1))} disabled={logCurrentPage >= totalLogPages}>Siguiente</Button></div>
                     </div>
                  </CardContent>
                 </Card>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <Dialog open={isFindingDialogOpen} onOpenChange={setIsFindingDialogOpen}>
        <DialogContent>
            <DialogHeader><DialogTitle>{editingFinding ? 'Editar Hallazgo' : 'Registrar Nuevo Hallazgo'}</DialogTitle></DialogHeader>
            <Form {...findingForm}><form onSubmit={findingForm.handleSubmit(handleFindingSubmit)} className="space-y-4 py-4">
                <FormField control={findingForm.control} name="type" render={({ field }) => (<FormItem><FormLabel>Tipo de Hallazgo</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione un tipo..."/></SelectTrigger></FormControl><SelectContent>{findingTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select><FormMessage/></FormItem>)}/>
                <FormField control={findingForm.control} name="description" render={({ field }) => (<FormItem><FormLabel>Descripción Detallada</FormLabel><FormControl><Textarea {...field} rows={4}/></FormControl><FormMessage/></FormItem>)}/>
                {(watchedFindingType === 'No Conforme' || watchedFindingType === 'Oportunidad de Mejora')) && (
                  <FormField control={findingForm.control} name="proposedAction" render={({ field }) => (<FormItem><FormLabel>Plan de Acción Propuesto</FormLabel><FormControl><Textarea {...field} value={field.value ?? ''} rows={4}/></FormControl><FormMessage/></FormItem>)}/>
                )}
                <DialogFooter><DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose><Button type="submit">Guardar Hallazgo</Button></DialogFooter>
            </form></Form>
        </DialogContent>
      </Dialog>
      <AlertDialog open={isConfirmDeleteFindingOpen} onOpenChange={setIsConfirmDeleteFindingOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Confirmar Eliminación</AlertDialogTitle><AlertDialogDescription>¿Está seguro de eliminar este hallazgo? Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={executeDeleteFinding} className={buttonVariants({variant: 'destructive'})}>Eliminar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog open={isConfirmDeleteAuditOpen} onOpenChange={setIsConfirmDeleteAuditOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Confirmar Eliminación</AlertDialogTitle><AlertDialogDescription>¿Está seguro de eliminar esta auditoría y todos sus hallazgos?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={executeDeleteAudit} className={buttonVariants({variant: 'destructive'})}>Eliminar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog open={isFinalizeConfirmDialogOpen} onOpenChange={setIsFinalizeConfirmDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Finalizar Auditoría con Hallazgos Pendientes</AlertDialogTitle><AlertDialogDescription>Se detectaron hallazgos que requieren un plan de acción. ¿Desea crear automáticamente las acciones de mejora correspondientes en el módulo de 'Acciones'?</AlertDialogDescription></AlertDialogHeader>
            <div className="py-4"><div className="flex items-center space-x-2"><Checkbox id="auto-create-actions" checked={finalizeOptions.autoCreateActions} onCheckedChange={checked => setFinalizeOptions({autoCreateActions: !!checked})}/><Label htmlFor="auto-create-actions">Sí, crear acciones automáticamente.</Label></div></div>
            <AlertDialogFooter><AlertDialogCancel>Volver</AlertDialogCancel><AlertDialogAction onClick={handleConfirmFinalization}>Finalizar Auditoría</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={isConfirmCancelAuditOpen} onOpenChange={setIsConfirmCancelAuditOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Cancelación de Auditoría</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción cambiará el estado de la auditoría a "Cancelada" y no podrá ser editada. Por favor, proporcione una justificación.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4 space-y-2">
              <Label htmlFor="cancellation-reason">Justificación de la Cancelación</Label>
              <Textarea
                id="cancellation-reason"
                placeholder="Ej: El objetivo de la auditoría ya no es relevante..."
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setAuditToCancel(null)}>Volver</AlertDialogCancel>
              <AlertDialogAction onClick={executeCancelAudit} disabled={!cancellationReason.trim()} className={buttonVariants({variant: "destructive"})}>Sí, Cancelar Auditoría</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Sub-component for displaying the active audit session
function AuditSessionView({
  allProcedimientos,
  auditSession,
  onGoBack,
  onFinalize,
  onCancel,
  onAddFinding,
  onEditFinding,
  onDeleteFinding,
  onCreateActionPlan,
  auditTargetDetails,
  activityDisplayFilter,
  setActivityDisplayFilter,
  puestosMap,
  procedimientosMap,
  politicasMap
}: {
  allProcedimientos: Procedimiento[];
  auditSession: Audit;
  onGoBack: () => void;
  onFinalize: () => void;
  onCancel: () => void;
  onAddFinding: () => void;
  onEditFinding: (finding: AuditFinding) => void;
  onDeleteFinding: (finding: AuditFinding) => void;
  onCreateActionPlan: (finding: AuditFinding, auditContext: Audit) => void;
  auditTargetDetails: any;
  activityDisplayFilter: 'all' | 'active' | 'inactive';
  setActivityDisplayFilter: (filter: 'all' | 'active' | 'inactive') => void;
  puestosMap: Map<string, Puesto>;
  procedimientosMap: Map<string, Procedimiento>;
  politicasMap: Map<string, Politica>;
}) {

    if (!auditTargetDetails) {
        return (
            <div className="container mx-auto py-8 flex items-center justify-center min-h-[400px]">
              <Loader2 className="h-16 w-16 text-primary animate-spin" />
              <div className="ml-4 text-lg text-muted-foreground">Cargando detalles de la auditoría...</div>
            </div>
        );
    }

    const { name, process, puesto, sistema, policy, procedimiento, relatedProcesses, linkedProcesses, relatedPolicies, departamento, jefeInmediato, procedimientos } = auditTargetDetails;
    const isSessionReadOnly = auditSession.status === 'Completada' || auditSession.status === 'Cancelada';

    const auditTypeLabel = `AUDITANDO: ${auditSession.auditType.toUpperCase()}`;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <Badge variant="default" className="mb-2 bg-blue-600 hover:bg-blue-700">{auditTypeLabel}</Badge>
                    <h1 className="text-3xl font-headline font-bold">Auditoría: {name}</h1>
                    <div className="text-sm text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                        <span>Código: {auditSession.codigo}</span>
                        <span>|</span>
                        <span>Auditor: {auditSession.auditorName}</span>
                        <span>|</span>
                        <span>Fecha: {format(parseISO(auditSession.auditDate), 'dd/MM/yyyy')}</span>
                        <span>|</span>
                        <div>Estado: <Badge className={cn("text-white border-transparent", { "bg-orange-500 hover:bg-orange-600": auditSession.status === 'En Progreso', "bg-green-600": auditSession.status === 'Completada', "bg-red-600": auditSession.status === 'Cancelada' })}>{auditSession.status}</Badge></div>
                    </div>
                </div>
                <Button onClick={onGoBack} className={buttonVariants({ variant: "default", className: "bg-blue-600 hover:bg-blue-700" })}>Volver a la Lista</Button>
            </div>
            
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle>Objetivo de la Auditoría: {name}</CardTitle>
                        {(auditSession.auditType === 'proceso' || auditSession.auditType === 'puesto' || auditSession.auditType === 'procedimiento') && (
                            <div className="flex items-center gap-2">
                                <Label htmlFor="activity-filter" className="text-sm">Mostrar Actividades:</Label>
                                <Select value={activityDisplayFilter} onValueChange={(v) => setActivityDisplayFilter(v as any)}>
                                    <SelectTrigger id="activity-filter" className="w-[180px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todas</SelectItem>
                                        <SelectItem value="active">Solo Activas</SelectItem>
                                        <SelectItem value="inactive">Solo Inactivas</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {auditSession.auditType === 'proceso' && <ProcessAuditDetails process={process} procedimientos={procedimientos} relatedPolicies={relatedPolicies} puestosMap={puestosMap} procedimientosMap={procedimientosMap} politicasMap={politicasMap} />}
                    {auditSession.auditType === 'puesto' && <PuestoAuditDetails puesto={puesto} departamento={departamento} jefeInmediato={jefeInmediato} relatedProcesses={relatedProcesses} relatedPolicies={relatedPolicies} puestosMap={puestosMap} politicasMap={politicasMap} procedimientosMap={new Map(allProcedimientos.map(p => [p.id, p]))}/>}
                    {auditSession.auditType === 'sistema' && <SystemAuditDetails sistema={sistema} relatedPolicies={relatedPolicies} />}
                    {auditSession.auditType === 'politica' && <PolicyAuditDetails policy={policy} linkedProcesses={linkedProcesses} />}
                    {auditSession.auditType === 'procedimiento' && <ProcedureAuditDetails procedimiento={procedimiento} parentProcess={process} activities={procedimientos[0]?.activities || []} relatedPolicies={relatedPolicies} puestosMap={puestosMap} politicasMap={politicasMap}/>}
                </CardContent>
            </Card>

            <div>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold">Registro de Hallazgos</h3>
                     {!isSessionReadOnly && (
                        <Button onClick={onAddFinding}><PlusCircle className="mr-2 h-4 w-4"/> Agregar Hallazgo</Button>
                     )}
                </div>
                <div className="space-y-4">
                    {auditSession.findings.length > 0 ? (
                        auditSession.findings.map(finding => (
                            <Card key={finding.id} className="p-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <Badge variant={finding.type === 'No Conforme' ? 'destructive' : (finding.type === 'Oportunidad de Mejora' ? 'default' : 'secondary')} className={cn(finding.type === 'Oportunidad de Mejora' && 'bg-amber-500')}>{finding.type}</Badge>
                                        <div className="mt-2 text-sm">{finding.description}</div>
                                        {finding.proposedAction && <div className="mt-2 text-xs text-muted-foreground italic"><strong>Acción Propuesta:</strong> {finding.proposedAction}</div>}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {(finding.type === 'No Conforme' || finding.type === 'Oportunidad de Mejora') && (
                                            <Button size="sm" variant="outline" onClick={() => onCreateActionPlan(finding, auditSession)} disabled={finding.isActionCreated}>
                                                {finding.isActionCreated ? <CheckCircle className="mr-2 h-4 w-4 text-green-500" /> : <Send className="mr-2 h-4 w-4" />}
                                                {finding.isActionCreated ? 'Acción Creada' : 'Crear Acción'}
                                            </Button>
                                        )}
                                        {!isSessionReadOnly && (
                                            <>
                                                <Button variant="ghost" size="icon" onClick={() => onEditFinding(finding)}><Edit className="h-4 w-4"/></Button>
                                                <Button variant="ghost" size="icon" onClick={() => onDeleteFinding(finding)} disabled={finding.isActionCreated} className="text-destructive"><Trash2 className="h-4 w-4"/></Button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        ))
                    ) : (
                       <div className="text-center p-6 bg-muted/50 rounded-lg">
                           <div className="text-muted-foreground">Aún no se han registrado hallazgos para esta auditoría.</div>
                       </div>
                    )}
                </div>
            </div>
            
            {!isSessionReadOnly && (
                <div className="flex justify-end gap-2 pt-4">
                    <Button variant="destructive" onClick={onCancel}>
                        <XCircle className="mr-2 h-4 w-4"/> Cancelar Auditoría
                    </Button>
                    <Button onClick={onFinalize} className={cn(buttonVariants({ variant: "default" }))}><CheckSquare className="mr-2 h-4 w-4"/> Finalizar Auditoría</Button>
                </div>
            )}
        </div>
    );
}

const ActivityDetailView = ({ activity, puestosMap, index }: { activity: Actividad, puestosMap: Map<string, Puesto>, index: number }) => {
    return (
        <Card className="bg-background/50">
            <CardHeader className="p-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <span className="font-semibold text-xs w-6 text-center">{index}</span> {activity.nombre}
                </CardTitle>
                 {!activity.activa && <Badge className="bg-amber-600 hover:bg-amber-700 text-white border-transparent text-xs w-fit mt-1 ml-8">Inactiva</Badge>}
            </CardHeader>
            <CardContent className="px-3 pt-0 pb-3 ml-8 border-t mt-2 pt-3 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
                <DetailDisplay title="Descripción" value={activity.descripcionBreve} isTextarea />
                <div className="space-y-2">
                    <DetailDisplay title="Puesto que Ejecuta" value={puestosMap.get(activity.puestoId || '')?.nombre} />
                    <DetailDisplay title="Frecuencia" value={activity.frecuencia ? `${activity.frecuencia} (${activity.ejecucionesPorPeriodo || 1})` : undefined} />
                </div>
                <div className="space-y-2">
                    <DetailDisplay title="Tiempo Estimado" value={activity.tiempoEstimado ? `${activity.tiempoEstimado} min` : undefined} />
                    <DetailDisplay title="Tiempo Ideal" value={activity.tiempoIdeal ? `${activity.tiempoIdeal} min` : undefined} />
                </div>
                <DetailDisplay title="Costo por Ejecución" value={activity.puestoId && activity.tiempoEstimado && puestosMap.get(activity.puestoId)?.costoHora ? `${((puestosMap.get(activity.puestoId)!.costoHora! / 60) * activity.tiempoEstimado).toFixed(2)} ${puestosMap.get(activity.puestoId)!.monedaCosto}` : undefined} />
            </CardContent>
        </Card>
    )
}

// Sub-components for different audit types
const SystemAuditDetails = ({ sistema, relatedPolicies }: { sistema: any, relatedPolicies: Politica[] }) => (
    <div className="space-y-4">
        <Card>
            <CardHeader><CardTitle className="text-base">Detalles del Sistema</CardTitle></CardHeader>
            <CardContent>
                <Table>
                    <TableHeader><TableRow><TableHead>Descripción</TableHead><TableHead>Monto/Uso</TableHead><TableHead>Licencias</TableHead><TableHead>Costo/Lic</TableHead><TableHead>Frecuencia</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {sistema.costos?.length > 0 ? sistema.costos.map((c: SistemaCosto) => (
                            <TableRow key={c.id}>
                                <TableCell>{c.descripcion}</TableCell>
                                <TableCell>{c.montoUso ? `${c.montoUso.toFixed(2)} ${c.moneda}` : '-'}</TableCell>
                                <TableCell>{c.numeroLicencias || '-'}</TableCell>
                                <TableCell>{c.costoPorLicencia ? `${c.costoPorLicencia.toFixed(2)} ${c.moneda}` : '-'}</TableCell>
                                <TableCell>{c.frecuencia || '-'}</TableCell>
                            </TableRow>
                        )) : <TableRow><TableCell colSpan={5} className="text-center">No hay costos registrados.</TableCell></TableRow>}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
        <Card>
            <CardHeader><CardTitle className="text-base">Políticas Aplicables</CardTitle></CardHeader>
            <CardContent>
                {relatedPolicies.length > 0 ? (
                    <ul className="list-disc pl-5 text-sm space-y-1">{relatedPolicies.map(p => <li key={p.id}>{p.titulo}</li>)}</ul>
                ) : <div className="text-sm text-muted-foreground">No hay políticas asociadas directamente al objetivo auditado.</div>}
            </CardContent>
        </Card>
    </div>
);

const ProcessAuditDetails = ({ process, procedimientos, relatedPolicies, puestosMap, procedimientosMap, politicasMap }: { process: CapturedProcess, procedimientos: any[], relatedPolicies: Politica[], puestosMap: Map<string, Puesto>, procedimientosMap: Map<string, Procedimiento>, politicasMap: Map<string, Politica>}) => (
    <div className="space-y-4">
        <Card><CardHeader><CardTitle className="text-base">Información General del Proceso</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <DetailDisplay title="Área" value={process.area} />
                <DetailDisplay title="Departamento" value={process.departamento} />
                <DetailDisplay title="Puesto Principal" value={process.puesto} />
                <DetailDisplay title="Frecuencia Auditoría" value={auditFrequencyOptions.find(o => o.value === process.auditFrequencyInDays)?.label} />
                <DetailDisplay title="Última Auditoría" value={process.lastAuditedAt ? format(parseISO(process.lastAuditedAt), 'PPP', {locale: es}) : 'Nunca'} />
                <DetailDisplay title="Estado" value={process.activo !== false ? 'Activo' : 'Inactivo'} />
                <div className="md:col-span-2"><DetailDisplay title="Objetivo" value={process.descripcion} isTextarea /></div>
                <div className="md:col-span-2"><DetailDisplay title="Políticas Vinculadas" value={relatedPolicies.map(p => p.titulo)} isList /></div>
            </CardContent>
        </Card>
        <Card><CardHeader><CardTitle className="text-base">Procedimientos y Actividades</CardTitle></CardHeader>
            <CardContent>
                <Accordion type="multiple" className="w-full">
                    {procedimientos.map(({ procedimiento, activities }, procIndex) => (
                        <ProcedureDetailView key={procedimiento.id} procedure={procedimiento} activities={activities} index={procIndex} puestosMap={puestosMap} politicasMap={politicasMap} procedimientosMap={procedimientosMap}/>
                    ))}
                </Accordion>
            </CardContent>
        </Card>
    </div>
);

const PuestoAuditDetails = ({ puesto, departamento, jefeInmediato, relatedProcesses, relatedPolicies, puestosMap, politicasMap, procedimientosMap }: { puesto: Puesto, departamento: Departamento, jefeInmediato: Puesto, relatedProcesses: any[], relatedPolicies: Politica[], puestosMap: Map<string, Puesto>, politicasMap: Map<string, Politica>, procedimientosMap: Map<string, Procedimiento> }) => (
   <div className="space-y-4">
        <Card>
            <CardHeader><CardTitle className="text-base">Información del Puesto</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <DetailDisplay title="Departamento" value={departamento?.nombre} />
                <DetailDisplay title="Reporta a" value={jefeInmediato?.nombre} />
                <DetailDisplay title="Nivel Organizacional" value={puesto.nivelOrganizacional} />
                <DetailDisplay title="# de Personas" value={puesto.numeroPersonas} />
                <DetailDisplay title="Costo por Hora" value={puesto.costoHora ? `${puesto.costoHora.toFixed(2)} ${puesto.monedaCosto}` : undefined} />
                <DetailDisplay title="Frecuencia Auditoría" value={auditFrequencyOptions.find(o => o.value === puesto.auditFrequencyInDays)?.label} />
                <DetailDisplay title="Última Auditoría" value={puesto.lastAuditedAt ? format(parseISO(puesto.lastAuditedAt), 'PPP', {locale: es}) : 'Nunca'} />
            </CardContent>
        </Card>
        <Card>
            <CardHeader><CardTitle className="text-base">Procesos Asignados</CardTitle></CardHeader>
            <CardContent>
                <Accordion type="multiple" className="w-full">
                {relatedProcesses.map(({ process, procedimientos }: any, procIndex) => (
                    <AccordionItem value={process.id} key={process.id}>
                        <AccordionTrigger>{procIndex + 1}. {process.proceso}</AccordionTrigger>
                        <AccordionContent>
                            <div className="text-xs italic mb-2">{process.descripcion}</div>
                            <Accordion type="multiple" className="w-full">
                                {procedimientos.map(({procedimiento, activities}: any, procManualIndex: number) => (
                                    <ProcedureDetailView key={procedimiento.id} procedure={procedimiento} activities={activities} index={procManualIndex} puestosMap={puestosMap} politicasMap={politicasMap} procedimientosMap={procedimientosMap}/>
                                ))}
                            </Accordion>
                        </AccordionContent>
                    </AccordionItem>
                ))}
                </Accordion>
            </CardContent>
        </Card>
        <Card><CardHeader><CardTitle className="text-base">Políticas Aplicables (Vía Procesos)</CardTitle></CardHeader><CardContent>{relatedPolicies.length > 0 ? <ul className="list-disc pl-5 text-sm space-y-1">{relatedPolicies.map(p => <li key={p.id}>{p.titulo}</li>)}</ul> : <div className="text-sm text-muted-foreground">No hay políticas asociadas.</div>}</CardContent></Card>
    </div>
);

const PolicyAuditDetails = ({ policy, linkedProcesses }: { policy: Politica, linkedProcesses: CapturedProcess[] }) => (
    <div className="space-y-4">
        <Card>
            <CardHeader><CardTitle className="text-base">Detalles de la Política</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <DetailDisplay title="Título" value={policy.titulo} />
                <DetailDisplay title="Código" value={policy.codigo} />
                <DetailDisplay title="Estado" value={policy.estado} />
                <DetailDisplay title="Nivel de Cumplimiento" value={policy.nivelCompliance} />
                <DetailDisplay title="Área Responsable" value={policy.areaResponsable} />
                <DetailDisplay title="Departamento Responsable" value={policy.departamentoResponsable} />
                <DetailDisplay title="Fecha de Vigencia" value={format(parseISO(policy.fechaVigencia), "PPP", { locale: es })} />
                <DetailDisplay title="Próxima Revisión" value={format(parseISO(policy.fechaRevision), "PPP", { locale: es })} />
                <div className="md:col-span-2"><DetailDisplay title="Descripción" value={policy.descripcion} isTextarea /></div>
            </CardContent>
        </Card>
        <Card>
            <CardHeader><CardTitle className="text-base">Procesos Vinculados</CardTitle></CardHeader>
            <CardContent>
                {linkedProcesses.length > 0 ? 
                    <div className="space-y-2">
                        {linkedProcesses.map(p => (
                            <div key={p.id} className="text-sm">
                                <p className="font-medium">{p.proceso}</p>
                                <p className="text-xs text-muted-foreground">{p.area} / {p.puesto}</p>
                            </div>
                        ))}
                    </div>
                 : <div className="text-sm text-muted-foreground">No hay procesos vinculados a esta política.</div>}
            </CardContent>
        </Card>
    </div>
);

const ProcedureAuditDetails = ({ procedimiento, parentProcess, activities, relatedPolicies, puestosMap, politicasMap }: { procedimiento: Procedimiento, parentProcess?: CapturedProcess, activities: Actividad[], relatedPolicies: Politica[], puestosMap: Map<string, Puesto>, politicasMap: Map<string, Politica> }) => (
    <Accordion type="single" collapsible defaultValue="item-0">
        <ProcedureDetailView procedure={procedimiento} activities={activities} index={0} parentProcess={parentProcess} puestosMap={puestosMap} politicasMap={politicasMap} procedimientosMap={new Map([[procedimiento.id, procedimiento]])} />
    </Accordion>
);

const ProcedureDetailView = ({ procedure, activities, index, parentProcess, puestosMap, politicasMap, procedimientosMap }: { procedure: Procedimiento, activities: Actividad[], index: number, parentProcess?: CapturedProcess, puestosMap: Map<string, Puesto>, politicasMap: Map<string, Politica>, procedimientosMap: Map<string, Procedimiento>}) => {
    const isInactive = procedure.activo === false;
    const procLinkedPolicies = (procedure.politicasAsociadasIds || [])
        .map(id => politicasMap.get(id)?.titulo)
        .filter(Boolean);

    return (
        <AccordionItem value={procedure.id} key={procedure.id} className="bg-background rounded-md border">
            <AccordionTrigger className="p-4 hover:no-underline">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-4 text-left flex-grow">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-secondary-foreground font-bold">{index + 1}</span>
                    <span className={cn("text-base font-medium flex items-center gap-2", isInactive && "italic text-muted-foreground")}>
                      {procedure.nombre} 
                      {isInactive && <Badge className="bg-amber-600 hover:bg-amber-700 text-white border-transparent">Inactivo</Badge>}
                    </span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="p-4 pt-0 pl-16 space-y-4">
                <Card>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                    <DetailDisplay title="Proceso Padre" value={parentProcess?.proceso} />
                    <DetailDisplay title="Clasificación" value={procedure.clasificacion} />
                    <div className="md:col-span-2"><DetailDisplay title="Descripción" value={procedure.descripcion} isTextarea /></div>
                    <div className="space-y-4">
                        <DetailDisplay title="Sistemas Utilizados" value={procedure.sistemasUtilizados} isList />
                        <DetailDisplay title="Políticas Vinculadas" value={procLinkedPolicies} isList />
                    </div>
                    <div className="space-y-4">
                        <DetailDisplay title="Información que Recibe" value={procedure.informacionRecibe} isTextarea/>
                        <DetailDisplay title="Procedimientos de Entrada" value={(procedure.procedimientosEntradaIds || []).map(id => procedimientosMap.get(id) || id)} isList />
                    </div>
                     <div className="space-y-4">
                        <DetailDisplay title="Información que Entrega" value={procedure.informacionEntrega} isTextarea/>
                        <DetailDisplay title="Procedimientos de Salida" value={(procedure.procedimientosSalidaIds || []).map(id => procedimientosMap.get(id) || id)} isList />
                    </div>
                    <div className="space-y-4">
                        <DetailDisplay title="Frecuencia Auditoría" value={auditFrequencyOptions.find(o => o.value === procedure.auditFrequencyInDays)?.label} />
                        <DetailDisplay title="Última Auditoría" value={procedure.lastAuditedAt ? format(parseISO(procedure.lastAuditedAt), 'PPP', {locale: es}) : 'Nunca'} />
                    </div>
                     <div className="space-y-4">
                        <DetailDisplay title="Tiempo Est. (Mes)" value={procedure.tiempoEstimado ? formatMinutesToHours(procedure.tiempoEstimado) : 'No calculado'} />
                        <DetailDisplay title="Costo Est. (Mes)" value={procedure.costoEstimado ? `${procedure.costoEstimado.toFixed(2)} ${procedure.monedaCosto || ''}` : 'No calculado'} />
                    </div>
                  </CardContent>
                </Card>
                 {activities.length > 0 ? (
                    <div className="space-y-2">
                        {activities.map((act, actIndex) => (
                            <ActivityDetailView key={act.id} activity={act} puestosMap={puestosMap} index={actIndex + 1}/>
                        ))}
                    </div>
                 ) : (
                    <p className="text-sm text-muted-foreground italic">Este procedimiento no tiene actividades.</p>
                 )}
            </AccordionContent>
        </AccordionItem>
    );
}

    

    

    



