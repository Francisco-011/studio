

'use client';

import { useState, useEffect, useMemo } from 'react';
import { format, parseISO, isValid, differenceInDays } from 'date-fns';
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
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { cn, formatMinutesToHours } from '@/lib/utils';
import { CheckCircle } from 'lucide-react';
import { Combobox } from "@/components/ui/combobox";
import { MultiSelect } from "@/components/ui/multi-select";


import { ClipboardCheck, PlusCircle, Trash2, FileText, Send, AlertTriangle, Loader2, History, Edit, ArrowRight, Save, XCircle, User, ChevronDown, Laptop, Search, ArrowUp, ArrowDown, ChevronsUpDown, Eye, Info, PlayCircle, Workflow, CheckSquare } from "lucide-react";
import { Checkbox } from '@/components/ui/checkbox';

const LOCAL_STORAGE_AUDITS_KEY = 'proceza-audits';

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

interface AuditFinding extends AuditFindingFormData {
  id: string;
  isActionCreated: boolean;
}

export interface Audit {
  id: string;
  auditType: AuditType;
  targetId: string;
  targetName: string;
  processIdsToAudit?: string[];
  auditorName: string;
  auditDate: string; // ISO string
  status: AuditStatus;
  findings: AuditFinding[];
}

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

  const [pastAudits, setPastAudits] = useState<Audit[]>([]);
  const [currentAuditSession, setCurrentAuditSession] = useState<Audit | null>(null);

  const [isLoading, setIsLoading] = useState(true);
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
    setIsLoading(true);
    try {
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


  const handleStartNewAudit = () => {
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

    const newAudit: Audit = {
      id: Date.now().toString(),
      auditType: newAuditType,
      targetId: newAuditTargetId,
      targetName: targetName,
      auditorName: newAuditorName,
      auditDate: new Date().toISOString(),
      status: 'En Progreso',
      findings: [],
      processIdsToAudit: (newAuditType === 'puesto' && newAuditProcessIds.length > 0) ? newAuditProcessIds : undefined,
    };
    setCurrentAuditSession(newAudit);
    addLogEntry({ user: newAuditorName, action: 'create', entityType: 'Auditoría', entityName: targetName, details: `Se inició una nueva auditoría para ${newAuditType}: "${targetName}".` });
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

  const handleCreateActionPlan = (finding: AuditFinding, auditContext: Audit) => {
    if (!auditContext) return;
    
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

    addAccion(actionData);
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
        setPastAudits(prev => {
            const existingIndex = prev.findIndex(a => a.id === finalAudit.id);
            if (existingIndex > -1) {
                const newAudits = [...prev];
                newAudits[existingIndex] = finalAudit;
                return newAudits;
            }
            return [...prev, finalAudit];
        });
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
            handleCreateActionPlan(finding, updatedAudit);
            newActionsCreated = true;
        }

        if (newActionsCreated) {
            updatedAudit = {
                ...updatedAudit,
                findings: updatedAudit.findings.map(f => 
                    ((f.type === 'No Conforme' || f.type === 'Oportunidad de Mejora') && !f.isActionCreated) 
                    ? { ...f, isActionCreated: true } 
                    : f
                )
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
    addLogEntry({ user: cancelledAudit.auditorName, action: 'status_change', entityType: 'Auditoría', entityName: cancelledAudit.targetName, details: `Se canceló la auditoría para "${cancelledAudit.targetName}".` });
    setCurrentAuditSession(null);
    toast({ title: "Auditoría Cancelada", description: "La auditoría ha sido guardada en estado 'Cancelada'." });
    setIsConfirmCancelDialogOpen(false);
  };
  
  const handleEditAudit = (audit: Audit) => {
    let auditToOpen = audit;
    if (audit.status !== 'Completada' && audit.status !== 'Cancelada') {
        auditToOpen = { ...audit, status: 'En Progreso' };
    }
    setCurrentAuditSession(auditToOpen);
  };

  const handleEditActivity = (activityName: string) => {
    router.push(`/actividades?search=${encodeURIComponent(activityName)}`);
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
    setPastAudits(prev => prev.filter(a => a.id !== auditToDelete.id));
    addLogEntry({ user: auditToDelete.auditorName, action: 'delete', entityType: 'Auditoría', entityName: auditToDelete.targetName, details: `Se eliminó la auditoría para "${auditToDelete.targetName}".` });
    toast({ title: 'Auditoría Eliminada', description: `La auditoría para "${auditToDelete.targetName}" ha sido eliminada permanentemente.`, variant: 'destructive' });
    setAuditToDelete(null);
    setIsConfirmDeleteAuditOpen(false);
  };

  const filteredAndSortedAudits = useMemo(() => {
    setAuditCurrentPage(1);
    let filtered = pastAudits.filter(audit => {
      const lowerSearch = auditSearchTerm.toLowerCase();
      const matchesSearch = audit.targetName.toLowerCase().includes(lowerSearch) || audit.auditorName.toLowerCase().includes(lowerSearch);
      const matchesType = auditTypeFilter === 'all' || audit.auditType === auditTypeFilter;
      const matchesStatus = auditStatusFilter === 'all' || audit.status === auditStatusFilter;
      const pendingCount = audit.findings.filter(f => (f.type === 'No Conforme' || f.type === 'Oportunidad de Mejora') && !f.isActionCreated).length;
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
            valA = a.findings.filter(f => (f.type === 'No Conforme' || f.type === 'Oportunidad de Mejora') && !f.isActionCreated).length;
            valB = b.findings.filter(f => (f.type === 'No Conforme' || f.type === 'Oportunidad de Mejora') && !f.isActionCreated).length;
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

  const isLoadingAllData = isLoading || isLoadingActividades || isLoadingPuestos || isLoadingDepartamentos || isLoadingSistemasCostos || isLoadingProcesos || isLoadingProcedimientos || isLoadingPoliticas;

  const auditAlerts = useMemo(() => {
    if (isLoadingAllData) return [];
    
    const now = new Date();
    const alerts: { id: string; type: AuditType; name: string; lastAudited?: string; daysOverdue: number }[] = [];

    allProcesses.forEach(proc => {
      if (proc.auditFrequencyInDays) {
        const lastAudit = proc.lastAuditedAt ? parseISO(proc.lastAuditedAt) : null;
        if (!lastAudit) {
          alerts.push({ id: proc.id, type: 'proceso', name: proc.proceso, daysOverdue: 9999 }); // Never audited
        } else {
          const nextDueDate = new Date(lastAudit.getTime() + proc.auditFrequencyInDays * 24 * 60 * 60 * 1000);
          if (now > nextDueDate) {
            alerts.push({ id: proc.id, type: 'proceso', name: proc.proceso, lastAudited: proc.lastAuditedAt, daysOverdue: differenceInDays(now, nextDueDate) });
          }
        }
      }
    });

    puestos.forEach(puesto => {
      if (puesto.auditFrequencyInDays) {
        const lastAudit = puesto.lastAuditedAt ? parseISO(puesto.lastAuditedAt) : null;
        if (!lastAudit) {
          alerts.push({ id: puesto.id, type: 'puesto', name: puesto.nombre, daysOverdue: 9999 });
        } else {
          const nextDueDate = new Date(lastAudit.getTime() + puesto.auditFrequencyInDays * 24 * 60 * 60 * 1000);
          if (now > nextDueDate) {
            alerts.push({ id: puesto.id, type: 'puesto', name: puesto.nombre, lastAudited: puesto.lastAuditedAt, daysOverdue: differenceInDays(now, nextDueDate) });
          }
        }
      }
    });

    allProcedimientos.forEach(proc => {
      if (proc.auditFrequencyInDays) {
        const lastAudit = proc.lastAuditedAt ? parseISO(proc.lastAuditedAt) : null;
        if (!lastAudit) {
          alerts.push({ id: proc.id, type: 'procedimiento', name: proc.nombre, daysOverdue: 9999 });
        } else {
          const nextDueDate = new Date(lastAudit.getTime() + proc.auditFrequencyInDays * 24 * 60 * 60 * 1000);
          if (now > nextDueDate) {
            alerts.push({ id: proc.id, type: 'procedimiento', name: proc.nombre, lastAudited: proc.lastAuditedAt, daysOverdue: differenceInDays(now, nextDueDate) });
          }
        }
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
      .filter(p => p.puesto === puestosMap.get(newAuditTargetId)?.nombre)
      .map(proc => ({ value: proc.id, label: proc.proceso }));
  }, [newAuditType, newAuditTargetId, allProcesses, puestosMap]);

  if (isLoadingAllData) {
    return (
      <div className="container mx-auto py-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-16 w-16 text-primary animate-spin" />
        <p className="ml-4 text-lg text-muted-foreground">Cargando datos de auditoría...</p>
      </div>
    );
  }

  if (currentAuditSession) {
    const isReadOnly = currentAuditSession.status === 'Completada' || currentAuditSession.status === 'Cancelada';
    // AUDIT WORKSPACE VIEW
    return (
        <div className="container mx-auto py-8">
            <Card className="shadow-lg">
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="text-2xl font-headline">Auditoría: {currentAuditSession.targetName}</CardTitle>
                            <CardDescription>
                                Auditor: {currentAuditSession.auditorName} | Fecha: {format(parseISO(currentAuditSession.auditDate), 'dd/MM/yyyy')} | Estado: {currentAuditSession.status}
                            </CardDescription>
                        </div>
                        <Button variant="secondary" onClick={() => setCurrentAuditSession(null)}>Volver a la Lista</Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {isReadOnly && (
                        <Alert variant="default" className="mb-4 bg-blue-50 border-blue-200 text-blue-800">
                            <Info className="h-4 w-4 !text-blue-800" />
                            <AlertTitle>Modo de solo lectura</AlertTitle>
                            <AlertDescription>
                                Esta auditoría está '{currentAuditSession.status}' y no puede ser modificada. Solo puede registrar planes de acción de hallazgos existentes.
                            </AlertDescription>
                        </Alert>
                    )}
                    <Card className="bg-muted/30">
                        <CardHeader>
                            <CardTitle className="text-lg">Objetivo de la Auditoría: {auditTargetDetails?.name}</CardTitle>
                        </CardHeader>
                         <CardContent className="space-y-4">
                            <div className="flex justify-end">
                                <div className="w-full sm:w-1/3">
                                    <Label htmlFor="activity-filter" className="text-sm">Mostrar Actividades</Label>
                                    <Select value={activityDisplayFilter} onValueChange={(v) => setActivityDisplayFilter(v as any)}>
                                        <SelectTrigger id="activity-filter">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todas</SelectItem>
                                            <SelectItem value="active">Solo Activas</SelectItem>
                                            <SelectItem value="inactive">Solo Inactivas</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            {auditTargetDetails?.process && !auditTargetDetails.procedimiento && (
                                <>
                                <Card>
                                    <CardHeader><CardTitle className="text-lg">Detalles del Proceso</CardTitle></CardHeader>
                                    <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        <DetailDisplay title="Objetivo" value={auditTargetDetails.process.descripcion} isTextarea />
                                        <DetailDisplay title="Área" value={auditTargetDetails.process.area} />
                                        <DetailDisplay title="Departamento" value={auditTargetDetails.departamento?.nombre} />
                                        <DetailDisplay title="Puesto que Ejecuta" value={auditTargetDetails.process.puesto} />
                                        <DetailDisplay title="Jefe Inmediato del Puesto" value={auditTargetDetails.jefeInmediato?.nombre} />
                                        <DetailDisplay title="Frecuencia de Auditoría" value={auditFrequencyOptions.find(o => o.value === auditTargetDetails.process?.auditFrequencyInDays)?.label || 'No definida'}/>
                                        <DetailDisplay title="Última Auditoría" value={auditTargetDetails.process.lastAuditedAt ? format(parseISO(auditTargetDetails.process.lastAuditedAt), 'PPP', {locale: es}) : 'Nunca'} />
                                    </CardContent>
                                </Card>
                                
                                <div>
                                    <h4 className="font-semibold text-lg mb-2">Procedimientos y Actividades</h4>
                                    {(auditTargetDetails.procedimientos && auditTargetDetails.procedimientos.length > 0) ? (
                                        <Accordion type="multiple" className="w-full space-y-2">
                                        {auditTargetDetails.procedimientos.map(({ procedimiento, activities: activitiesToShow }, procIndex) => (
                                            <AccordionItem value={procedimiento.id} key={procedimiento.id} className="bg-background rounded-md border">
                                                <AccordionTrigger className="p-4 hover:no-underline">
                                                    <div className="flex items-center gap-4 text-left">
                                                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">{procIndex + 1}</span>
                                                        <span className="text-base font-medium">{procedimiento.nombre}</span>
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent className="p-4 pt-0 pl-16 space-y-3">
                                                    <DetailDisplay title="Descripción del Procedimiento" value={procedimiento.descripcion} isTextarea />
                                                    <DetailDisplay title="Sistemas Utilizados en Procedimiento" value={procedimiento.sistemasUtilizados} isList />
                                                    <DetailDisplay title="Políticas Vinculadas" value={(procedimiento.politicasAsociadasIds || []).map(id => politicasMap.get(id)?.titulo).filter(Boolean) as string[]} isList />
                                                    {activitiesToShow.length > 0 ? (
                                                        <div className="space-y-2">
                                                            <h5 className="font-semibold text-sm mt-2">Actividades:</h5>
                                                            {activitiesToShow.map((act, actIndex) => {
                                                              const puestoActividad = act.puestoId ? puestosMap.get(act.puestoId) : null;
                                                              const costoActividad = puestoActividad?.costoHora && act.tiempoEstimado ? (puestoActividad.costoHora / 60) * act.tiempoEstimado : null;

                                                              return (
                                                                <Card key={act.id} className="bg-background/50">
                                                                    <CardHeader className="flex-row items-start justify-between gap-4 space-y-0 p-3">
                                                                        <div className="flex-grow">
                                                                            <p className="font-medium text-sm flex items-start gap-3"><span className="font-semibold text-sm w-8 shrink-0 text-center pt-px">{procIndex + 1}.{actIndex + 1}</span>{act.nombre}</p>
                                                                            {!act.activa && <Badge variant="destructive" className="bg-slate-500 hover:bg-slate-600 text-white border-transparent text-xs w-fit mt-1">Inactiva</Badge>}
                                                                        </div>
                                                                        <Button variant="ghost" size="sm" onClick={() => handleEditActivity(act.nombre)}>Editar</Button>
                                                                    </CardHeader>
                                                                    <CardContent className="px-3 pt-0 pb-3 ml-11 border-t mt-2 pt-3 space-y-2">
                                                                        <DetailDisplay title="Descripción" value={act.descripcionBreve} isTextarea />
                                                                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                                                            <DetailDisplay title="Puesto que Ejecuta" value={puestoActividad?.nombre} />
                                                                            <DetailDisplay title="Frecuencia" value={act.frecuencia ? `${act.frecuencia} (${act.ejecucionesPorPeriodo || 1})` : 'N/A'} />
                                                                            <DetailDisplay title="Tiempo Estimado/Ideal" value={`${formatMinutesToHours(act.tiempoEstimado || 0)} / ${formatMinutesToHours(act.tiempoIdeal || 0)}`} />
                                                                            <DetailDisplay title="Costo por Ejecución" value={costoActividad !== null ? `${costoActividad.toFixed(2)} ${puestoActividad?.monedaCosto || 'N/A'}` : 'N/A'} />
                                                                        </div>
                                                                    </CardContent>
                                                                </Card>
                                                            )})}
                                                        </div>
                                                    ) : (
                                                        <p className="text-sm text-muted-foreground italic">Este procedimiento no tiene actividades definidas o no coinciden con el filtro.</p>
                                                    )}
                                                </AccordionContent>
                                            </AccordionItem>
                                        ))}
                                        </Accordion>
                                    ) : (
                                        <p className="text-sm text-muted-foreground italic">Este proceso no tiene procedimientos definidos.</p>
                                    )}
                                </div>
                                </>
                            )}
                            {auditTargetDetails?.puesto && (
                                <Card>
                                    <CardHeader><CardTitle className="text-lg">Detalles del Puesto</CardTitle></CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            <DetailDisplay title="Área" value={areasMap.get(auditTargetDetails.puesto?.areaId)?.nombre || 'No asignada'} />
                                            <DetailDisplay title="Departamento" value={auditTargetDetails.departamento?.nombre} />
                                            <DetailDisplay title="Jefe Inmediato" value={auditTargetDetails.jefeInmediato?.nombre} />
                                            <DetailDisplay title="Nivel Organizacional" value={auditTargetDetails.puesto.nivelOrganizacional} />
                                            <DetailDisplay title="Número de Personas" value={auditTargetDetails.puesto.numeroPersonas} />
                                        </div>
                                        {auditTargetDetails.relatedProcesses && auditTargetDetails.relatedProcesses.length > 0 && (
                                            <div>
                                                <Separator className="my-4" />
                                                <h4 className="font-semibold text-md mb-2">Procesos Auditados del Puesto</h4>
                                                <Accordion type="multiple" className="w-full">
                                                    {auditTargetDetails.relatedProcesses.map(({ process, procedimientos }) => (
                                                        <AccordionItem value={process.id} key={process.id}>
                                                            <AccordionTrigger>{process.proceso}</AccordionTrigger>
                                                            <AccordionContent className="space-y-4 p-2 bg-background">
                                                                <Card>
                                                                    <CardHeader className="pb-2"><CardTitle className="text-base">Detalles del Proceso</CardTitle></CardHeader>
                                                                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                                                        <DetailDisplay title="Objetivo" value={process.descripcion} isTextarea />
                                                                        <DetailDisplay title="Tiempo Est. (Mes)" value={process.tiempoEstimado !== undefined ? formatMinutesToHours(process.tiempoEstimado) : 'No calculado'} />
                                                                        <DetailDisplay title="Costo Est. (Mes)" value={process.costoEstimado !== undefined ? `${process.costoEstimado.toFixed(2)} ${process.monedaCosto || ''}` : 'No calculado'} />
                                                                    </CardContent>
                                                                </Card>
                                                                
                                                                <div>
                                                                    <h4 className="font-semibold text-base mb-2">Procedimientos y Actividades</h4>
                                                                    {procedimientos && procedimientos.length > 0 ? (
                                                                        <Accordion type="multiple" className="w-full space-y-2">
                                                                        {procedimientos.map(({procedimiento, activities: activitiesToShow}, procIndex) => (
                                                                            <AccordionItem value={procedimiento.id} key={procedimiento.id} className="bg-card rounded-md border">
                                                                                <AccordionTrigger className="p-3 text-sm hover:no-underline">
                                                                                    <div className="flex items-center gap-3 text-left">
                                                                                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-secondary-foreground font-bold text-xs">{procIndex + 1}</span>
                                                                                        <span className="font-medium">{procedimiento.nombre}</span>
                                                                                    </div>
                                                                                </AccordionTrigger>
                                                                                <AccordionContent className="p-4 pt-0 pl-12 space-y-2">
                                                                                    <DetailDisplay title="Sistemas Utilizados" value={procedimiento.sistemasUtilizados} isList />
                                                                                    {activitiesToShow.length > 0 ? (
                                                                                        <div className="space-y-2 mt-2">
                                                                                            {activitiesToShow.map((act, actIndex) => (
                                                                                                <Card key={act.id} className="bg-background/50">
                                                                                                    <CardHeader className="flex-row items-start justify-between gap-4 space-y-0 p-3">
                                                                                                        <div className="flex-grow">
                                                                                                            <p className="font-medium text-sm flex items-start gap-3"><span className="font-semibold text-sm w-8 shrink-0 text-center pt-px">{procIndex + 1}.{actIndex + 1}</span>{act.nombre}</p>
                                                                                                            {!act.activa && <Badge variant="destructive" className="bg-slate-500 hover:bg-slate-600 text-white border-transparent text-xs w-fit mt-1">Inactiva</Badge>}
                                                                                                        </div>
                                                                                                        <Button variant="ghost" size="sm" onClick={() => handleEditActivity(act.nombre)}>Editar</Button>
                                                                                                    </CardHeader>
                                                                                                    <CardContent className="px-3 pt-0 pb-3 ml-11 border-t mt-2 pt-3 space-y-2">
                                                                                                        <DetailDisplay title="Descripción" value={act.descripcionBreve} isTextarea />
                                                                                                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                                                                                            <DetailDisplay title="Código" value={act.codigo} />
                                                                                                            <DetailDisplay title="Últ. Modif." value={act.updatedAt && isValid(new Date(act.updatedAt)) ? format(new Date(act.updatedAt), 'dd MMM yyyy, HH:mm', { locale: es }) : (act.createdAt && isValid(new Date(act.createdAt)) ? format(new Date(act.createdAt), 'dd MMM yyyy, HH:mm', { locale: es }) : 'N/A')} />
                                                                                                        </div>
                                                                                                    </CardContent>
                                                                                                </Card>
                                                                                            ))}
                                                                                        </div>
                                                                                    ) : (
                                                                                        <p className="text-sm text-muted-foreground italic p-2">Este procedimiento no tiene actividades.</p>
                                                                                    )}
                                                                                </AccordionContent>
                                                                            </AccordionItem>
                                                                        ))}
                                                                        </Accordion>
                                                                    ) : (
                                                                        <p className="text-sm text-muted-foreground italic p-2">Este proceso no tiene procedimientos definidos.</p>
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
                            {auditTargetDetails?.procedimiento && (
                                <>
                                <Card>
                                    <CardHeader><CardTitle className="text-lg">Detalles del Procedimiento</CardTitle></CardHeader>
                                    <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        <DetailDisplay title="Proceso Padre" value={auditTargetDetails.process?.proceso} />
                                        <DetailDisplay title="Clasificación" value={auditTargetDetails.procedimiento.clasificacion} />
                                        <DetailDisplay title="Sistemas Utilizados" value={auditTargetDetails.procedimiento.sistemasUtilizados} isList />
                                        <div className="md:col-span-2 lg:col-span-3">
                                          <DetailDisplay title="Descripción" value={auditTargetDetails.procedimiento.descripcion} isTextarea />
                                        </div>
                                    </CardContent>
                                </Card>
                                <div>
                                    <h4 className="font-semibold text-lg mb-2">Actividades del Procedimiento</h4>
                                    {auditTargetDetails.procedimientos[0].activities.length > 0 ? (
                                        <div className="space-y-2">
                                            {auditTargetDetails.procedimientos[0].activities.map((act, actIndex) => (
                                                <Card key={act.id} className="bg-background/50">
                                                    <CardHeader className="flex-row items-start justify-between gap-4 space-y-0 p-3">
                                                        <div className="flex-grow">
                                                            <p className="font-medium text-sm flex items-start gap-3"><span className="font-semibold text-sm w-8 shrink-0 text-center pt-px">{actIndex + 1}</span>{act.nombre}</p>
                                                            {!act.activa && <Badge variant="destructive" className="bg-slate-500 hover:bg-slate-600 text-white border-transparent text-xs w-fit mt-1">Inactiva</Badge>}
                                                        </div>
                                                        <Button variant="ghost" size="sm" onClick={() => handleEditActivity(act.nombre)}>Editar</Button>
                                                    </CardHeader>
                                                    <CardContent className="px-3 pt-0 pb-3 ml-11 border-t mt-2 pt-3 space-y-2">
                                                        <DetailDisplay title="Descripción" value={act.descripcionBreve} isTextarea />
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-muted-foreground italic">Este procedimiento no tiene actividades definidas o no coinciden con el filtro.</p>
                                    )}
                                </div>
                                </>
                            )}
                            {auditTargetDetails?.sistema && (
                                <Card>
                                    <CardHeader><CardTitle className="text-lg">Detalles del Sistema</CardTitle></CardHeader>
                                    <CardContent className="space-y-4">
                                        
                                        {auditTargetDetails.sistema.costos && auditTargetDetails.sistema.costos.length > 0 && (
                                            <div>
                                                <Separator className="my-4" />
                                                <h4 className="font-semibold text-md mb-2">Costos Registrados</h4>
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>Descripción</TableHead>
                                                            <TableHead>Monto/Uso</TableHead>
                                                            <TableHead>Licencias</TableHead>
                                                            <TableHead>Costo/Lic</TableHead>
                                                            <TableHead>Frecuencia</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {auditTargetDetails.sistema.costos.map(cost => (
                                                            <TableRow key={cost.id}>
                                                                <TableCell>{cost.descripcion}</TableCell>
                                                                <TableCell>{cost.montoUso ? `${cost.montoUso.toFixed(2)} ${cost.moneda || ''}` : '-'}</TableCell>
                                                                <TableCell>{cost.numeroLicencias || '-'}</TableCell>
                                                                <TableCell>{cost.costoPorLicencia ? `${cost.costoPorLicencia.toFixed(2)} ${cost.moneda || ''}` : '-'}</TableCell>
                                                                <TableCell>{cost.frecuencia || '-'}</TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        )}
                                        
                                        {auditTargetDetails.relatedProcesses && auditTargetDetails.relatedProcesses.length > 0 && (
                                            <div>
                                                <Separator className="my-4" />
                                                <h4 className="font-semibold text-md mb-2">Procesos que Utilizan "{auditTargetDetails.sistema.nombre}"</h4>
                                                <ul className="list-disc pl-5 text-sm space-y-1">
                                                    {auditTargetDetails.relatedProcesses.map(p => (
                                                        <li key={p.process.id}>
                                                            {p.process.proceso} <span className="text-xs text-muted-foreground">({p.process.area} / {p.process.puesto})</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            )}
                            {auditTargetDetails?.policy && (
                                <>
                                <Card>
                                    <CardHeader><CardTitle className="text-lg">Detalles de la Política</CardTitle></CardHeader>
                                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <DetailDisplay title="Título" value={auditTargetDetails.policy.titulo} />
                                        <DetailDisplay title="Código" value={auditTargetDetails.policy.codigo} />
                                        <DetailDisplay title="Estado" value={auditTargetDetails.policy.estado} />
                                        <DetailDisplay title="Nivel de Cumplimiento" value={auditTargetDetails.policy.nivelCompliance} />
                                        <DetailDisplay title="Área Responsable" value={auditTargetDetails.policy.areaResponsable} />
                                        <DetailDisplay title="Departamento Responsable" value={auditTargetDetails.policy.departamentoResponsable} />
                                        <div className="md:col-span-2">
                                            <DetailDisplay title="Descripción" value={auditTargetDetails.policy.descripcion} isTextarea />
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader><CardTitle className="text-lg">Procesos Vinculados</CardTitle></CardHeader>
                                    <CardContent>
                                        {auditTargetDetails.linkedProcesses && auditTargetDetails.linkedProcesses.length > 0 ? (
                                            <div className="space-y-2">
                                                {auditTargetDetails.linkedProcesses.map(proc => (
                                                    <div key={proc.id} className="text-sm p-2 border rounded-md bg-background">
                                                        <p className="font-semibold">{proc.proceso}</p>
                                                        <p className="text-xs text-muted-foreground">{proc.area} / {proc.puesto}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-muted-foreground italic">Esta política no está vinculada a ningún proceso.</p>
                                        )}
                                    </CardContent>
                                </Card>
                                </>
                            )}
                             {auditTargetDetails && auditTargetDetails.relatedPolicies && auditTargetDetails.relatedPolicies.length > 0 && (
                                <Card>
                                    <CardHeader><CardTitle className="text-lg flex items-center gap-2"><FileText className="h-5 w-5" />Políticas Aplicables</CardTitle></CardHeader>
                                    <CardContent>
                                        <div className="space-y-2">
                                            {auditTargetDetails.relatedPolicies.map((pol: Politica) => (
                                            <div key={pol.id} className="text-sm p-2 border rounded-md bg-background">
                                                <p className="font-semibold">{pol.codigo} - {pol.titulo}</p>
                                                <p className="text-xs text-muted-foreground">{pol.descripcion}</p>
                                            </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                             )}
                        </CardContent>
                    </Card>

                    <div>
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-xl font-semibold">Registro de Hallazgos</h3>
                          <Button onClick={() => { setEditingFinding(null); setIsFindingDialogOpen(true); }} disabled={isReadOnly}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Agregar Hallazgo
                          </Button>
                        </div>
                        <div className="space-y-4">
                            {currentAuditSession.findings.length > 0 ? currentAuditSession.findings.map((finding) => (
                                <Card key={finding.id} className="bg-muted/20">
                                <CardHeader className="flex flex-row items-center justify-between pb-2">
                                    <CardTitle className="text-base flex items-center gap-2">
                                    <Badge
                                      className={cn("text-white border-transparent", {
                                        "bg-green-600 hover:bg-green-700": finding.type === 'Conforme',
                                        "bg-red-600 hover:bg-red-700": finding.type === 'No Conforme',
                                        "bg-amber-600 hover:bg-amber-700": finding.type === 'Oportunidad de Mejora',
                                      })}
                                    >
                                      {finding.type}
                                    </Badge>
                                    Hallazgo #{finding.id.slice(-4)}
                                    </CardTitle>
                                    <div>
                                      <Button variant="ghost" size="icon" onClick={() => { setEditingFinding(finding); setIsFindingDialogOpen(true); }} className="text-muted-foreground hover:text-foreground h-7 w-7" disabled={isReadOnly}><Edit className="h-4 w-4"/></Button>
                                      <Button variant="ghost" size="icon" onClick={() => promptDeleteFinding(finding)} className="text-destructive hover:text-destructive h-7 w-7" disabled={isReadOnly}><Trash2 className="h-4 w-4"/></Button>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm mb-2 whitespace-pre-wrap"><strong>Descripción:</strong> {finding.description}</p>
                                    {(finding.type === 'No Conforme' || finding.type === 'Oportunidad de Mejora') && finding.proposedAction && (
                                    <div className="p-3 border rounded-md bg-background space-y-2">
                                        <p className="text-sm font-semibold">Plan de Acción Propuesto:</p>
                                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{finding.proposedAction}</p>
                                        <div className="flex justify-end pt-2 items-center gap-2">
                                        {finding.isActionCreated ? 
                                            <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-white border-transparent">Acción Creada</Badge> : 
                                            <Badge className="bg-amber-600 text-white hover:bg-amber-700 border-transparent">Acción Pendiente</Badge>
                                        }
                                        <Button size="sm" onClick={() => handleCreateActionPlan(finding, currentAuditSession!)} disabled={finding.isActionCreated}>
                                            <Send className="mr-2 h-4 w-4" /> {finding.isActionCreated ? 'Acción ya Creada' : 'Registrar Plan de Acción'}
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
                        <Button variant="destructive" onClick={promptCancelAudit} disabled={isReadOnly}> <XCircle className="mr-2 h-4 w-4"/> Cancelar Auditoría</Button>
                        <Button 
                          size="lg" 
                          onClick={handleFinalizeAudit} 
                          disabled={isReadOnly}
                        > 
                          <Save className="mr-2 h-4 w-4"/> Finalizar y Guardar Auditoría
                        </Button>
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
                            <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose><Button type="submit">{editingFinding ? "Guardar Cambios" : "Agregar Hallazgo"}</Button>
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
             <Dialog open={isFinalizeConfirmDialogOpen} onOpenChange={setIsFinalizeConfirmDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><CheckSquare className="h-5 w-5 text-primary"/>Confirmar Finalización de Auditoría</DialogTitle>
                        <DialogDescription>
                            Esta auditoría tiene hallazgos que requieren un plan de acción. ¿Desea crearlos automáticamente en el módulo de "Acciones de Mejora"?
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="flex items-center space-x-2">
                            <Checkbox 
                                id="autoCreateActions" 
                                checked={finalizeOptions.autoCreateActions}
                                onCheckedChange={(checked) => setFinalizeOptions(prev => ({...prev, autoCreateActions: !!checked}))}
                            />
                            <Label htmlFor="autoCreateActions" className="text-sm font-normal cursor-pointer">
                                Sí, crear planes de acción automáticamente para todos los hallazgos pendientes.
                            </Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsFinalizeConfirmDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleConfirmFinalization}>Confirmar y Finalizar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
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
                    Inicie nuevas auditorías, consulte el historial de auditorías completadas y vea el registro de actividad del sistema.
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
                            <Select value={newAuditType} onValueChange={(v: AuditType | '') => { setNewAuditType(v); setNewAuditTargetId(''); }}>
                                <SelectTrigger id="auditTypeSelect"><SelectValue placeholder="Seleccione un tipo..." /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="proceso">Proceso</SelectItem>
                                    <SelectItem value="procedimiento">Procedimiento</SelectItem>
                                    <SelectItem value="puesto">Puesto</SelectItem>
                                    <SelectItem value="sistema">Sistema</SelectItem>
                                    <SelectItem value="politica">Política</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {newAuditType && (
                        <div>
                            <Label>Objetivo Específico</Label>
                             <Combobox
                                options={auditTargetOptions}
                                value={newAuditTargetId}
                                onChange={setNewAuditTargetId}
                                placeholder="Seleccione un objetivo..."
                                searchPlaceholder="Buscar objetivo..."
                              />
                        </div>
                        )}
                        {newAuditType === 'puesto' && newAuditTargetId && (
                           <div>
                            <Label>Procesos a Auditar (Opcional)</Label>
                             <MultiSelect
                                options={procesosDelPuestoOptions}
                                value={newAuditProcessIds}
                                onChange={setNewAuditProcessIds}
                                placeholder="Seleccione procesos..."
                              />
                            <p className="text-xs text-muted-foreground mt-1">Si no selecciona ninguno, se auditarán todos los procesos del puesto.</p>
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
          <Tabs defaultValue="alertas">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="alertas">Alertas de Auditoría ({auditAlerts.length})</TabsTrigger>
              <TabsTrigger value="historial">Historial de Auditorías</TabsTrigger>
              <TabsTrigger value="actividad">Registro de Actividad</TabsTrigger>
            </TabsList>

             <TabsContent value="alertas" className="mt-4">
               <CardDescription className="mb-4">
                  Esta tabla muestra los procesos, puestos y procedimientos que requieren una auditoría basada en la frecuencia programada.
                </CardDescription>

                <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg bg-muted/30">
                    <div>
                        <Label htmlFor="alert-search">Buscar por Nombre</Label>
                        <Input 
                            id="alert-search"
                            placeholder="Filtrar por nombre..."
                            value={auditAlertSearchTerm}
                            onChange={e => setAuditAlertSearchTerm(e.target.value)}
                        />
                    </div>
                    <div>
                        <Label htmlFor="alert-type-filter">Filtrar por Tipo</Label>
                        <Select value={auditAlertTypeFilter} onValueChange={v => setAuditAlertTypeFilter(v as any)}>
                            <SelectTrigger id="alert-type-filter"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos los Tipos</SelectItem>
                                <SelectItem value="proceso">Proceso</SelectItem>
                                <SelectItem value="puesto">Puesto</SelectItem>
                                <SelectItem value="procedimiento">Procedimiento</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor="alert-days-filter">Filtrar por Atraso</Label>
                        <Select value={auditAlertDaysFilter} onValueChange={v => setAuditAlertDaysFilter(v as any)}>
                            <SelectTrigger id="alert-days-filter"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Cualquier Atraso</SelectItem>
                                <SelectItem value="30">Más de 30 días</SelectItem>
                                <SelectItem value="90">Más de 90 días</SelectItem>
                                <SelectItem value="180">Más de 180 días</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {filteredAuditAlerts.length > 0 ? (
                  <>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead className="cursor-pointer hover:bg-muted/50 group" onClick={() => requestAuditAlertSort('name')}>
                          <div className="flex items-center">Nombre{getAuditAlertSortIcon('name')}</div>
                        </TableHead>
                        <TableHead className="cursor-pointer hover:bg-muted/50 group" onClick={() => requestAuditAlertSort('type')}>
                          <div className="flex items-center">Tipo{getAuditAlertSortIcon('type')}</div>
                        </TableHead>
                        <TableHead>Última Auditoría</TableHead>
                        <TableHead className="cursor-pointer hover:bg-muted/50 group" onClick={() => requestAuditAlertSort('daysOverdue')}>
                           <div className="flex items-center">Días de Atraso{getAuditAlertSortIcon('daysOverdue')}</div>
                        </TableHead>
                        <TableHead className="text-right">Acción</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {paginatedAuditAlerts.map(alert => (
                          <TableRow key={`${alert.type}-${alert.id}`}>
                            <TableCell className="font-medium">{alert.name}</TableCell>
                            <TableCell className="capitalize">{alert.type}</TableCell>
                            <TableCell>{alert.lastAudited ? format(parseISO(alert.lastAudited), 'dd/MM/yyyy') : 'Nunca auditado'}</TableCell>
                            <TableCell><Badge variant="destructive">{alert.daysOverdue > 9000 ? 'N/A' : `${alert.daysOverdue} días`}</Badge></TableCell>
                            <TableCell className="text-right">
                              <Button size="sm" onClick={() => handleStartAuditFromAlert(alert.type as any, alert.id)}>
                                <PlayCircle className="mr-2 h-4 w-4" /> Iniciar Auditoría
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex items-center justify-between space-x-2 py-4">
                    <span className="text-sm text-muted-foreground">Página {auditAlertCurrentPage} de {totalAuditAlertPages} ({filteredAuditAlerts.length} total)</span>
                    <div className="space-x-2">
                        <Button variant="outline" size="sm" onClick={() => setAuditAlertCurrentPage(p => Math.max(1, p - 1))} disabled={auditAlertCurrentPage === 1}>Anterior</Button>
                        <Button variant="outline" size="sm" onClick={() => setAuditAlertCurrentPage(p => Math.min(totalAuditAlertPages, p + 1))} disabled={auditAlertCurrentPage >= totalAuditAlertPages}>Siguiente</Button>
                    </div>
                 </div>
                 </>
                ) : (
                  <div className="text-center p-8 bg-muted/30 rounded-lg border">
                    {auditAlerts.length === 0 ? (
                      <>
                        <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-600" />
                        <p className="font-semibold">¡Excelente! No hay auditorías pendientes.</p>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="font-semibold">No se encontraron alertas que coincidan con los filtros.</p>
                      </>
                    )}
                  </div>
                )}
             </TabsContent>

            <TabsContent value="historial" className="mt-4">
                <div className="space-y-2 mb-4 p-2 border rounded-lg bg-muted/20">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                    <Input placeholder="Buscar por objetivo o auditor..." value={auditSearchTerm} onChange={(e) => setAuditSearchTerm(e.target.value)} />
                    <Select value={auditTypeFilter} onValueChange={(v) => setAuditTypeFilter(v as any)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Todos los Tipos</SelectItem>{auditTypes.map(t=><SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent></Select>
                    <Select value={auditStatusFilter} onValueChange={(v) => setAuditStatusFilter(v as any)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Todos los Estados</SelectItem>{auditStatuses.map(s=><SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
                    <Select value={pendingActionsFilter} onValueChange={(v) => setPendingActionsFilter(v as any)}>
                        <SelectTrigger><SelectValue placeholder="Acc. Pendientes (Todos)" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Acc. Pendientes (Todos)</SelectItem>
                            <SelectItem value="with_pending">Con Pendientes</SelectItem>
                            <SelectItem value="no_pending">Sin Pendientes</SelectItem>
                        </SelectContent>
                    </Select>
                  </div>
                </div>
                {paginatedAudits.length > 0 ? (
                <>
                <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="cursor-pointer hover:bg-muted/50 group" onClick={()=>requestAuditSort('targetName')}><div className="flex items-center">Objetivo Auditado{getAuditSortIcon('targetName')}</div></TableHead>
                            <TableHead className="cursor-pointer hover:bg-muted/50 group" onClick={()=>requestAuditSort('auditType')}><div className="flex items-center">Tipo{getAuditSortIcon('auditType')}</div></TableHead>
                            <TableHead className="cursor-pointer hover:bg-muted/50 group" onClick={()=>requestAuditSort('auditorName')}><div className="flex items-center">Auditor{getAuditSortIcon('auditorName')}</div></TableHead>
                            <TableHead className="cursor-pointer hover:bg-muted/50 group" onClick={()=>requestAuditSort('auditDate')}><div className="flex items-center">Fecha{getAuditSortIcon('auditDate')}</div></TableHead>
                            <TableHead className="cursor-pointer hover:bg-muted/50 group" onClick={()=>requestAuditSort('status')}><div className="flex items-center">Estado{getAuditSortIcon('status')}</div></TableHead>
                            <TableHead className="cursor-pointer hover:bg-muted/50 group" onClick={()=>requestAuditSort('numFindings')}><div className="flex items-center">Hallazgos{getAuditSortIcon('numFindings')}</div></TableHead>
                            <TableHead className="cursor-pointer hover:bg-muted/50 group" onClick={() => requestAuditSort('pendingActions')}><div className="flex items-center">Acciones Pend.{getAuditSortIcon('pendingActions')}</div></TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedAudits.map(audit => {
                            const pendingActionsCount = audit.findings.filter(f => (f.type === 'No Conforme' || f.type === 'Oportunidad de Mejora') && !f.isActionCreated).length;
                            return (
                            <TableRow key={audit.id}>
                                <TableCell className="font-medium">{audit.targetName}</TableCell>
                                <TableCell className="capitalize">{audit.auditType}</TableCell>
                                <TableCell>{audit.auditorName}</TableCell>
                                <TableCell>{format(parseISO(audit.auditDate), 'dd/MM/yyyy')}</TableCell>
                                <TableCell>
                                  <Badge
                                    className={cn(
                                      "border-transparent text-white",
                                      {
                                        "bg-green-600 hover:bg-green-700": audit.status === "Completada",
                                        "bg-red-600 hover:bg-red-700": audit.status === "Cancelada",
                                        "bg-orange-600 hover:bg-orange-700": audit.status === "En Progreso",
                                      }
                                    )}
                                  >{audit.status}</Badge>
                                </TableCell>
                                <TableCell>{audit.findings.length}</TableCell>
                                <TableCell>
                                  {pendingActionsCount > 0 ? (
                                      <Badge variant="destructive">{pendingActionsCount}</Badge>
                                  ) : (
                                      <span className="text-muted-foreground">0</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button variant="outline" size="sm" onClick={() => handleEditAudit(audit)} className="mr-2">
                                      {audit.status === 'Completada' || audit.status === 'Cancelada' ? <Eye className="mr-2 h-4 w-4" /> : <Edit className="mr-2 h-4 w-4" />}
                                      {audit.status === 'Completada' || audit.status === 'Cancelada' ? 'Ver Detalles' : 'Ver / Editar'}
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      onClick={() => promptDeleteAudit(audit)} 
                                      className="text-destructive hover:text-destructive"
                                      disabled={audit.status !== 'En Progreso'}
                                      title={audit.status !== 'En Progreso' ? 'Solo se pueden eliminar auditorías "En Progreso"' : 'Eliminar Auditoría'}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        )})}
                    </TableBody>
                </Table>
                </div>
                 <div className="flex items-center justify-between space-x-2 py-4"><span className="text-sm text-muted-foreground">Página {auditCurrentPage} de {totalAuditPages} ({filteredAndSortedAudits.length} total)</span><div className="space-x-2"><Button variant="outline" size="sm" onClick={() => setAuditCurrentPage(p => Math.max(1, p - 1))} disabled={auditCurrentPage === 1}>Anterior</Button><Button variant="outline" size="sm" onClick={() => setAuditCurrentPage(p => Math.min(totalAuditPages, p + 1))} disabled={auditCurrentPage === totalAuditPages || totalAuditPages === 0}>Siguiente</Button></div></div>
                </>
                ) : (
                <div className="text-center p-8 text-muted-foreground">No hay auditorías que coincidan con los filtros.</div>
                )}
            </TabsContent>
            <TabsContent value="actividad" className="mt-4">
             {isLoadingLog ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : logEntries.length > 0 ? (
                <>
                <div className="space-y-2 mb-4 p-2 border rounded-lg bg-muted/20">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <Input placeholder="Buscar en registro..." value={logSearchTerm} onChange={(e) => setLogSearchTerm(e.target.value)} />
                    <Select value={logActionFilter} onValueChange={(v) => setLogActionFilter(v as any)}>
                        <SelectTrigger><SelectValue placeholder="Todas las Acciones" /></SelectTrigger>
                        <SelectContent>{logActionOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                    <Combobox
                      value={logEntityTypeFilter}
                      onChange={setLogEntityTypeFilter}
                      options={logEntityTypeOptions}
                      placeholder="Filtrar por entidad..."
                      searchPlaceholder="Buscar entidad..."
                    />
                  </div>
                </div>
                <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="cursor-pointer hover:bg-muted/50 group" onClick={()=>requestLogSort('timestamp')}><div className="flex items-center">Fecha y Hora{getLogSortIcon('timestamp')}</div></TableHead>
                      <TableHead className="cursor-pointer hover:bg-muted/50 group" onClick={()=>requestLogSort('user')}><div className="flex items-center">Usuario{getLogSortIcon('user')}</div></TableHead>
                      <TableHead className="cursor-pointer hover:bg-muted/50 group" onClick={()=>requestLogSort('entityType')}><div className="flex items-center">Tipo Entidad{getLogSortIcon('entityType')}</div></TableHead>
                      <TableHead className="cursor-pointer hover:bg-muted/50 group" onClick={()=>requestLogSort('entityName')}><div className="flex items-center">Nombre Entidad{getLogSortIcon('entityName')}</div></TableHead>
                      <TableHead className="cursor-pointer hover:bg-muted/50 group" onClick={()=>requestLogSort('action')}><div className="flex items-center">Acción{getLogSortIcon('action')}</div></TableHead>
                      <TableHead>Detalles</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedLogs.map(log => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs">{format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm:ss', { locale: es })}</TableCell>
                        <TableCell>{log.user || 'Sistema'}</TableCell>
                        <TableCell>{log.entityType}</TableCell>
                        <TableCell>{log.entityName}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{actionTranslations[log.action] || log.action}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{log.details}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
                 <div className="flex items-center justify-between space-x-2 py-4">
                    <span className="text-sm text-muted-foreground">Página {logCurrentPage} de {totalLogPages} ({filteredAndSortedLogs.length} total)</span>
                    <div className="space-x-2">
                        <Button variant="outline" size="sm" onClick={() => setLogCurrentPage(p => Math.max(1, p - 1))} disabled={logCurrentPage === 1}>Anterior</Button>
                        <Button variant="outline" size="sm" onClick={() => setLogCurrentPage(p => Math.min(totalLogPages, p + 1))} disabled={logCurrentPage === totalLogPages || totalLogPages === 0}>Siguiente</Button>
                    </div>
                 </div>
                </>
              ) : (
                <div className="mt-6 p-8 border border-dashed border-border rounded-lg flex flex-col items-center justify-center min-h-[300px] bg-muted/20">
                      <History className="h-16 w-16 text-muted-foreground mb-4" />
                      <p className="text-lg font-semibold text-foreground">Sin Actividad Registrada</p>
                      <p className="text-sm text-muted-foreground text-center max-w-md">
                          No se ha registrado ninguna actividad en el sistema todavía.
                      </p>
                  </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* DIALOGS */}
      <AlertDialog open={isConfirmDeleteAuditOpen} onOpenChange={setIsConfirmDeleteAuditOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>
                    <div className="flex items-center">
                        <AlertTriangle className="h-5 w-5 mr-2 text-destructive" />
                        Confirmar Eliminación Permanente
                    </div>
                </AlertDialogTitle>
                <AlertDialogDescription>
                    ¿Está seguro de que desea eliminar la auditoría para "{auditToDelete?.targetName}"? Esta acción no se puede deshacer y se borrarán todos sus hallazgos.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setAuditToDelete(null)}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={executeDeleteAudit} className={buttonVariants({variant: "destructive"})}>Eliminar Permanentemente</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}






