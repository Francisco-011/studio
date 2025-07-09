
'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { CheckCircle } from 'lucide-react';
import { Combobox } from "@/components/ui/combobox";
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
    if ((data.type === 'No Conforme' || data.type === 'Oportunidad de Mejora') && (!data.proposedAction || data.proposedAction.length < 10)) {
        return false;
    }
    return true;
}, {
    message: "El plan de acción propuesto es requerido para hallazgos de 'No Conforme' u 'Oportunidad de Mejora' (mínimo 10 caracteres).",
    path: ["proposedAction"],
});
type AuditFindingFormData = z.infer<typeof auditFindingSchema>;

type SortableAuditKeys = 'targetName' | 'auditType' | 'auditorName' | 'auditDate' | 'status' | 'numFindings' | 'pendingActions';
type SortableLogKeys = 'timestamp' | 'user' | 'entityType' | 'entityName' | 'action';
type SortableAuditAlertKeys = 'name' | 'type' | 'daysOverdue';
type SortDirection = 'ascending' | 'descending';

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
        <p className="text-muted-foreground">No especificado</p>
      ) : isList && Array.isArray(value) ? (
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
  const [isConfirmCancelDialogOpen, setIsConfirmCancelDialogOpen] = useState(false);

  const [isConfirmDeleteAuditOpen, setIsConfirmDeleteAuditOpen] = useState(false);
  const [auditToDelete, setAuditToDelete] = useState<Audit | null>(null);
  
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
  }, [currentAuditSession, activityDisplayFilter, procesosMap, procedimientosMap, actividadesMap, puestosMap, puestoNameToPuestoMap, departamentosMap, sistemasMap, politicasMap, allProcesses, costosSistemas]);

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
        setCurrentAuditSession({
            ...newAuditData,
            id: newAuditId,
            createdAt: Date.now()
        });
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
      updateAudit(auditContext.id, { findings: updatedFindings });
      
      toast({ title: "Plan de Acción Creado", description: "Se ha registrado la acción en el módulo de 'Acciones de Mejora'."});
    } catch (e) {
      console.error("Error creating action plan: ", e);
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

    } catch (error) {
        console.error("Error finalizing audit:", error);
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

  const promptCancelAudit = () => {
    setIsConfirmCancelDialogOpen(true);
  };
  
  const handleCancelAudit = async () => {
    if (!currentAuditSession) return;
    const cancelledAudit: Partial<AuditCreationData> = { status: 'Cancelada' };
    await updateAudit(currentAuditSession.id, cancelledAudit);
    addLogEntry({ user: currentAuditSession.auditorName, action: 'status_change', entityType: 'Auditoría', entityName: currentAuditSession.targetName, details: `Se canceló la auditoría para "${currentAuditSession.targetName}".` });
    setCurrentAuditSession(null);
    toast({ title: "Auditoría Cancelada", description: "La auditoría ha sido guardada en estado 'Cancelada'." });
    setIsConfirmCancelDialogOpen(false);
  };
  
  const handleEditAudit = (audit: Audit) => {
    let auditToOpen = audit;
    if (audit.status !== 'Completada' && audit.status !== 'Cancelada') {
        auditToOpen = { ...audit, status: 'En Progreso' };
        updateAudit(audit.id, { status: 'En Progreso' });
    }
    setCurrentAuditSession(auditToOpen);
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
      const matchesSearch = audit.targetName.toLowerCase().includes(lowerSearch) || audit.auditorName.toLowerCase().includes(lowerSearch);
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
      } catch (error) {
        console.error(`Failed to process audit alert for process ${proc?.id}:`, error);
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
      } catch (error) {
        console.error(`Failed to process audit alert for puesto ${puesto?.id}:`, error);
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
      } catch (error) {
        console.error(`Failed to process audit alert for procedimiento ${proc?.id}:`, error);
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

    const headers = ["ID Auditoría", "Fecha", "Tipo", "Objetivo Auditado", "Auditor", "Estado", "Total Hallazgos", "Hallazgos No Conformes", "Oportunidades de Mejora", "Acciones Pendientes"];
    
    const csvRows = [
        headers.join(','),
        ...filteredAndSortedAudits.map(audit => {
            const totalFindings = audit.findings.length;
            const nonConform = audit.findings.filter(f => f.type === 'No Conforme').length;
            const opportunity = audit.findings.filter(f => f.type === 'Oportunidad de Mejora').length;
            const pendingActions = audit.findings.filter(f => (f.type === 'No Conforme' || f.type === 'Oportunidad de Mejora') && !f.isActionCreated).length;

            return [
                escapeCsvCell(audit.id),
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
        <p className="ml-4 text-lg text-muted-foreground">Cargando datos de auditoría...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      {currentAuditSession ? (
        <h1>Audit Session View</h1>
      ) : (
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex items-center gap-2 mb-1">
              <ClipboardCheck className="h-6 w-6 text-primary" />
              <CardTitle className="text-2xl font-headline">Auditoría y Cumplimiento</CardTitle>
            </div>
            <CardDescription className="text-muted-foreground">
              Inicie nuevas auditorías, revise el historial y monitoree el registro de actividad del sistema.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="historial">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="historial">Historial y Métricas</TabsTrigger>
                <TabsTrigger value="alertas">Alertas de Auditoría</TabsTrigger>
                <TabsTrigger value="log"><History className="mr-2 h-4 w-4"/>Registro de Actividad</TabsTrigger>
              </TabsList>
              
              <TabsContent value="historial" className="mt-4">
                <Card>
                  <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                      <div>
                        <CardTitle>Historial de Auditorías</CardTitle>
                        <CardDescription>Auditorías realizadas anteriormente.</CardDescription>
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
                                <Select value={newAuditType} onValueChange={(value: AuditType) => setNewAuditType(value)}>
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
                                <Combobox
                                    value={newAuditTargetId}
                                    onChange={setNewAuditTargetId}
                                    options={auditTargetOptions}
                                    placeholder={!newAuditType ? "Seleccione un tipo primero" : "Seleccione un objetivo..."}
                                    searchPlaceholder="Buscar..."
                                />
                            </div>
                             {newAuditType === 'puesto' && (
                                <div>
                                    <Label>Procesos a Auditar (Opcional)</Label>
                                    <MultiSelect
                                        value={newAuditProcessIds}
                                        onChange={setNewAuditProcessIds}
                                        options={procesosDelPuestoOptions}
                                        placeholder="Seleccione procesos..."
                                    />
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Si no selecciona ninguno, se auditarán todos los procesos del puesto.
                                    </p>
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
                  </CardHeader>
                  <CardContent>
                    Contenido del historial...
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="alertas" className="mt-4">
                 Contenido de alertas...
              </TabsContent>
              
              <TabsContent value="log" className="mt-4">
                 Contenido del log...
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
