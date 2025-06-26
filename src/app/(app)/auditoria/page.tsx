

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
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
import type { CapturedProcess } from '../procesos-y-flujos-registrados/page';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { cn, formatMinutesToHours } from '@/lib/utils';

import { ClipboardCheck, PlusCircle, Trash2, FileText, Send, AlertTriangle, Loader2, History, Edit, ArrowRight, Save, XCircle, User, ChevronDown, Laptop, Search, ArrowUp, ArrowDown, ChevronsUpDown, Eye, Info } from "lucide-react";

const CAPTURED_DATA_LOCAL_STORAGE_KEY = 'proceza-captured-data';
const LOCAL_STORAGE_AUDITS_KEY = 'proceza-audits';

const findingTypes = ["Conforme", "No Conforme", "Oportunidad de Mejora"] as const;
type FindingType = typeof findingTypes[number];

const auditStatuses = ["En Progreso", "Completada", "Cancelada"] as const;
type AuditStatus = typeof auditStatuses[number];
const auditTypes = ["proceso", "puesto", "sistema"] as const;

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
  auditType: 'proceso' | 'puesto' | 'sistema';
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
type SortDirection = 'ascending' | 'descending';

interface SortConfig<T> {
  key: T;
  direction: SortDirection;
}

const AUDIT_ITEMS_PER_PAGE = 10;
const LOG_ITEMS_PER_PAGE = 15;


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
  const { departamentos, isLoading: isLoadingDepartamentos } = useDepartamentos();
  const { sistemas, costosSistemas, isLoadingSistemasCostos } = useSistemasCostos();
  const { addLogEntry, logEntries, isLoadingLog } = useActivityLog();

  const [allProcesses, setAllProcesses] = useState<CapturedProcess[]>([]);
  const [pastAudits, setPastAudits] = useState<Audit[]>([]);
  const [currentAuditSession, setCurrentAuditSession] = useState<Audit | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isStartAuditDialogOpen, setIsStartAuditDialogOpen] = useState(false);
  
  const [newAuditType, setNewAuditType] = useState<'proceso' | 'puesto' | 'sistema' | ''>('');
  const [newAuditTargetId, setNewAuditTargetId] = useState<string>('');
  const [newAuditProcessIds, setNewAuditProcessIds] = useState<string[]>([]);
  const [newAuditorName, setNewAuditorName] = useState<string>('Auditor Principal');

  const [isFindingDialogOpen, setIsFindingDialogOpen] = useState(false);
  const [editingFinding, setEditingFinding] = useState<AuditFinding | null>(null);
  
  const [isConfirmDeleteFindingOpen, setIsConfirmDeleteFindingOpen] = useState(false);
  const [findingToDelete, setFindingToDelete] = useState<AuditFinding | null>(null);
  const [isConfirmCancelDialogOpen, setIsConfirmCancelDialogOpen] = useState(false);

  const [isConfirmDeleteAuditOpen, setIsConfirmDeleteAuditOpen] = useState(false);
  const [auditToDelete, setAuditToDelete] = useState<Audit | null>(null);
  
  const [activityDisplayFilter, setActivityDisplayFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [auditSearchTerm, setAuditSearchTerm] = useState('');
  const [auditTypeFilter, setAuditTypeFilter] = useState<'all' | 'proceso' | 'puesto' | 'sistema'>('all');
  const [auditStatusFilter, setAuditStatusFilter] = useState<'all' | AuditStatus>('all');
  const [pendingActionsFilter, setPendingActionsFilter] = useState<'all' | 'with_pending' | 'no_pending'>('all');
  const [auditSortConfig, setAuditSortConfig] = useState<SortConfig<SortableAuditKeys> | null>(null);
  const [auditCurrentPage, setAuditCurrentPage] = useState(1);

  const [logSearchTerm, setLogSearchTerm] = useState('');
  const [logActionFilter, setLogActionFilter] = useState<'all' | LogAction>('all');
  const [logEntityTypeFilter, setLogEntityTypeFilter] = useState<'all' | string>('all');
  const [logSortConfig, setLogSortConfig] = useState<SortConfig<SortableLogKeys> | null>(null);
  const [logCurrentPage, setLogCurrentPage] = useState(1);


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
  
  useEffect(() => {
    setNewAuditProcessIds([]);
  }, [newAuditType, newAuditTargetId]);

  const auditTargetDetails = useMemo(() => {
    const nullDetails = { name: "No encontrado", process: null, activities: [], puesto: null, relatedProcesses: [], sistema: null, departamento: null, jefeInmediato: null };
    if (!currentAuditSession) return null;

    const activityFilterFunc = (act: Actividad) => {
        if (activityDisplayFilter === 'all') return true;
        if (activityDisplayFilter === 'active') return act.activa;
        if (activityDisplayFilter === 'inactive') return !act.activa;
        return true;
    }

    if (currentAuditSession.auditType === 'proceso') {
      const process = allProcesses.find(p => p.id === currentAuditSession.targetId);
      if (!process) return nullDetails;
      const processActivities = (process.activityOrder || [])
        .map(actId => actividades.find(a => a.id === actId))
        .filter((act): act is Actividad => !!act)
        .filter(activityFilterFunc);

      const puestoQueEjecuta = puestos.find(p => p.nombre === process.puesto);
      const jefeInmediato = puestoQueEjecuta?.jefeInmediato ? puestos.find(p => p.id === puestoQueEjecuta.jefeInmediato) : null;
      const departamento = puestoQueEjecuta ? departamentos.find(d => d.id === puestoQueEjecuta.departamentoId) : null;

      return {
        name: process.proceso, process, activities: processActivities, puesto: null,
        relatedProcesses: [], sistema: null, departamento, jefeInmediato
      };
    } else if (currentAuditSession.auditType === 'puesto') {
      const puesto = puestos.find(p => p.id === currentAuditSession.targetId);
      if (!puesto) return nullDetails;
      
      const jefeInmediato = puesto.jefeInmediato ? puestos.find(p => p.id === puesto.jefeInmediato) : null;
      const departamento = puesto.departamentoId ? departamentos.find(d => d.id === puesto.departamentoId) : null;

      let relatedProcessesForPuesto = allProcesses.filter(proc => proc.puesto === puesto.nombre);

      if (currentAuditSession.processIdsToAudit && currentAuditSession.processIdsToAudit.length > 0) {
        const processIdSet = new Set(currentAuditSession.processIdsToAudit);
        relatedProcessesForPuesto = relatedProcessesForPuesto.filter(proc => processIdSet.has(proc.id));
      }

      const relatedProcessesData = relatedProcessesForPuesto
        .map(proc => ({
          process: proc,
          activities: (proc.activityOrder || []).map(actId => actividades.find(a => a.id === actId)).filter((act): act is Actividad => !!act).filter(activityFilterFunc)
        }));
      
      return {
        name: puesto.nombre, process: null, activities: [], puesto, relatedProcesses: relatedProcessesData, sistema: null,
        departamento, jefeInmediato,
      };
    } else { // Sistema
        const sistema = sistemas.find(s => s.id === currentAuditSession.targetId);
        if(!sistema) return nullDetails;

        const costosDelSistema = costosSistemas.filter(c => c.sistemaId === sistema.id);
        const procesosQueUsanSistema = allProcesses.filter(p => p.sistemas?.includes(sistema.nombre));

        return {
            name: sistema.nombre, process: null, activities: [], puesto: null, sistema: {...sistema, costos: costosDelSistema },
            relatedProcesses: procesosQueUsanSistema.map(p => ({ process: p, activities: []})),
            departamento: null, jefeInmediato: null
        }
    }
  }, [currentAuditSession, allProcesses, actividades, puestos, areas, activityDisplayFilter, departamentos, sistemas, costosSistemas]);

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
      : newAuditType === 'puesto' ? puestos.find(p => p.id === newAuditTargetId)?.nombre
      : sistemas.find(s => s.id === newAuditTargetId)?.nombre;

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
    
    let actionData: any = {
      nombre: `Hallazgo en ${currentAuditSession.auditType}: ${currentAuditSession.targetName}`,
      descripcion: `Descripción del Hallazgo: ${finding.description}\n\nPlan de Acción Propuesto: ${finding.proposedAction}`,
      responsable: 'Por Asignar',
      estado: 'En Revisión',
      origenMejora: `Auditoría - ${currentAuditSession.auditorName}`,
    };

    if (currentAuditSession.auditType === 'proceso') {
      const target = allProcesses.find(p => p.id === currentAuditSession!.targetId);
      if (target) {
          actionData.procesoId = target.id;
          actionData.area = target.area;
          actionData.puesto = target.puesto;
      }
    } else if (currentAuditSession.auditType === 'puesto') {
      const target = puestos.find(p => p.id === currentAuditSession!.targetId);
      if (target) {
        actionData.puesto = target.nombre;
        actionData.area = areas.find(a => a.id === target.areaId)?.nombre;
      }
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
    addLogEntry({ user: finalAudit.auditorName, action: 'status_change', entityType: 'Auditoría', entityName: finalAudit.targetName, details: `Se finalizó la auditoría para "${finalAudit.targetName}".` });
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

  const promptDeleteAudit = (audit: Audit) => {
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
          valA = a[auditSortConfig.key];
          valB = b[auditSortConfig.key];
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

  const uniqueLogActions = useMemo(() => ['all', ...Array.from(new Set(logEntries.map(log => log.action)))], [logEntries]);
  const uniqueLogEntityTypes = useMemo(() => ['all', ...Array.from(new Set(logEntries.map(log => log.entityType)))], [logEntries]);

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
        let valA = a[logSortConfig.key];
        let valB = b[logSortConfig.key];

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

  const isLoadingAllData = isLoading || isLoadingActividades || isLoadingPuestos || isLoadingDepartamentos || isLoadingSistemasCostos;

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
                            {auditTargetDetails?.process && (
                                <>
                                <Card>
                                    <CardHeader><CardTitle className="text-lg">Detalles del Proceso</CardTitle></CardHeader>
                                    <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        <DetailDisplay title="Descripción" value={auditTargetDetails.process.descripcion} isTextarea />
                                        <DetailDisplay title="Área" value={auditTargetDetails.process.area} />
                                        <DetailDisplay title="Departamento" value={auditTargetDetails.departamento?.nombre} />
                                        <DetailDisplay title="Puesto que Ejecuta" value={auditTargetDetails.process.puesto} />
                                        <DetailDisplay title="Jefe Inmediato del Puesto" value={auditTargetDetails.jefeInmediato?.nombre} />
                                        <DetailDisplay title="Frecuencia" value={auditTargetDetails.process.frecuencia} />
                                        <DetailDisplay title="Tiempo Estimado" value={auditTargetDetails.process.tiempoEstimado !== undefined ? formatMinutesToHours(auditTargetDetails.process.tiempoEstimado) : null} />
                                        <DetailDisplay title="Tiempo Ideal" value={auditTargetDetails.process.tiempoIdeal !== undefined ? formatMinutesToHours(auditTargetDetails.process.tiempoIdeal) : null} />
                                        <DetailDisplay title="Costo Estimado" value={auditTargetDetails.process.costoEstimado !== undefined ? `${auditTargetDetails.process.costoEstimado} ${auditTargetDetails.process.monedaCosto || ''}`: null} />
                                        <DetailDisplay title="Costo Ideal" value={auditTargetDetails.process.costoIdeal !== undefined ? `${auditTargetDetails.process.costoIdeal} ${auditTargetDetails.process.monedaCosto || ''}`: null} />
                                        <DetailDisplay title="Sistemas" value={auditTargetDetails.process.sistemas} isList />
                                        <DetailDisplay title="Procesos de Entrada" value={auditTargetDetails.process.procesosEntrada} isList />
                                        <DetailDisplay title="Procesos de Salida" value={auditTargetDetails.process.procesosSalida} isList />
                                        <div className="col-span-full space-y-2">
                                           <DetailDisplay title="Información que Recibe (Entradas)" value={auditTargetDetails.process.informacionRecibe} isTextarea />
                                           <DetailDisplay title="Información que Entrega (Salidas)" value={auditTargetDetails.process.informacionEntrega} isTextarea />
                                        </div>
                                    </CardContent>
                                </Card>
                                
                                <div>
                                    <h4 className="font-semibold text-lg mb-2">Actividades en Orden</h4>
                                    {(auditTargetDetails.activities && auditTargetDetails.activities.length > 0) ? (
                                        <Accordion type="multiple" className="w-full space-y-2">
                                        {auditTargetDetails.activities.map((act, index) => (
                                            <AccordionItem value={act.id} key={`${act.id}-${index}`} className="bg-background rounded-md border">
                                                <AccordionTrigger className="p-4 hover:no-underline">
                                                    <div className="flex items-center gap-4 text-left">
                                                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">{index + 1}</span>
                                                        <span className="text-base font-medium flex items-center gap-2">
                                                          {act.nombre}
                                                          {!act.activa && <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-50">Inactiva</Badge>}
                                                        </span>
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent className="p-4 pt-0 pl-16">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                        <DetailDisplay title="Descripción" value={act.descripcionBreve} isTextarea />
                                                        <DetailDisplay title="Sistema Utilizado" value={act.sistemaUtilizado} />
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        ))}
                                        </Accordion>
                                    ) : (
                                        <p className="text-sm text-muted-foreground italic">Este proceso no tiene actividades definidas o que coincidan con el filtro.</p>
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
                                                    {auditTargetDetails.relatedProcesses.map(({ process, activities }) => (
                                                        <AccordionItem value={process.id} key={process.id}>
                                                            <AccordionTrigger>{process.proceso}</AccordionTrigger>
                                                            <AccordionContent className="space-y-4 p-2 bg-background">
                                                                <Card>
                                                                    <CardHeader className="pb-2"><CardTitle className="text-base">Detalles del Proceso</CardTitle></CardHeader>
                                                                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                                                        <DetailDisplay title="Descripción" value={process.descripcion} isTextarea />
                                                                        <DetailDisplay title="Frecuencia" value={process.frecuencia} />
                                                                        <DetailDisplay title="Tiempo Est./Ideal" value={`${process.tiempoEstimado !== undefined ? formatMinutesToHours(process.tiempoEstimado) : '-'} / ${process.tiempoIdeal !== undefined ? formatMinutesToHours(process.tiempoIdeal) : '-'}`} />
                                                                        <DetailDisplay title="Costo Est./Ideal" value={`${process.costoEstimado ?? '-'} / ${process.costoIdeal ?? '-'} ${process.monedaCosto || ''}`} />
                                                                        <DetailDisplay title="Sistemas" value={process.sistemas} isList />
                                                                        <DetailDisplay title="Procesos de Entrada" value={process.procesosEntrada} isList />
                                                                        <DetailDisplay title="Procesos de Salida" value={process.procesosSalida} isList />
                                                                    </CardContent>
                                                                </Card>
                                                                
                                                                <div>
                                                                    <h4 className="font-semibold text-base mb-2">Actividades</h4>
                                                                    {activities && activities.length > 0 ? (
                                                                        <Accordion type="multiple" className="w-full space-y-2">
                                                                        {activities.map((act, index) => (
                                                                            <AccordionItem value={act.id} key={`${act.id}-${index}`} className="bg-card rounded-md border">
                                                                                <AccordionTrigger className="p-4 hover:no-underline">
                                                                                    <div className="flex items-center gap-4 text-left">
                                                                                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-secondary-foreground font-bold">{index + 1}</span>
                                                                                        <span className="text-base font-medium flex items-center gap-2">
                                                                                          {act.nombre}
                                                                                          {!act.activa && <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-50">Inactiva</Badge>}
                                                                                        </span>
                                                                                    </div>
                                                                                </AccordionTrigger>
                                                                                <AccordionContent className="p-4 pt-0 pl-16">
                                                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                                                        <DetailDisplay title="Descripción" value={act.descripcionBreve} isTextarea />
                                                                                        <DetailDisplay title="Sistema Utilizado" value={act.sistemaUtilizado} />
                                                                                    </div>
                                                                                </AccordionContent>
                                                                            </AccordionItem>
                                                                        ))}
                                                                        </Accordion>
                                                                    ) : (
                                                                        <p className="text-sm text-muted-foreground italic p-2">Este proceso no tiene actividades definidas o que coincidan con el filtro.</p>
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
                            {auditTargetDetails?.sistema && (
                                <Card>
                                    <CardHeader><CardTitle className="text-lg">Detalles del Sistema</CardTitle></CardHeader>
                                    <CardContent className="space-y-4">
                                        <DetailDisplay title="Alcance del Sistema" value={auditTargetDetails.sistema.scope} />
                                        
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
                                    <Badge variant={ finding.type === 'Conforme' ? 'default' : finding.type === 'No Conforme' ? 'destructive' : 'secondary' } className={cn(finding.type === 'Conforme' && 'bg-green-600 hover:bg-green-700 text-white border-transparent')}>{finding.type}</Badge>
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
                                        <Button size="sm" onClick={() => handleCreateActionPlan(finding)} disabled={finding.isActionCreated}>
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
                        <Button size="lg" onClick={handleFinalizeAudit} disabled={isReadOnly}> <Save className="mr-2 h-4 w-4"/> Finalizar y Guardar Auditoría</Button>
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
                    Inicie nuevas auditorías a procesos, puestos o sistemas, o consulte el historial de auditorías completadas.
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
                            <Select value={newAuditType} onValueChange={(v: 'proceso' | 'puesto' | 'sistema' | '') => { setNewAuditType(v); setNewAuditTargetId(''); }}>
                                <SelectTrigger id="auditTypeSelect"><SelectValue placeholder="Seleccione un tipo..." /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="proceso">Proceso</SelectItem>
                                    <SelectItem value="puesto">Puesto</SelectItem>
                                    <SelectItem value="sistema">Sistema</SelectItem>
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
                                    ) : newAuditType === 'puesto' ? (
                                        puestos.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)
                                    ) : (
                                        sistemas.map(s => <SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>)
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                        )}
                        {newAuditType === 'puesto' && newAuditTargetId && (
                           <div>
                            <Label>Procesos a Auditar (Opcional)</Label>
                             <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="w-full justify-between font-normal">
                                  <span className="truncate">
                                    {newAuditProcessIds.length > 0 ? `${newAuditProcessIds.length} proceso(s) seleccionado(s)` : "Todos los procesos del puesto"}
                                  </span>
                                  <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]" align="start">
                                <DropdownMenuLabel>Seleccione los procesos a auditar</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {allProcesses
                                  .filter(p => p.puesto === puestos.find(pu => pu.id === newAuditTargetId)?.nombre)
                                  .map(proc => (
                                    <DropdownMenuCheckboxItem
                                        key={proc.id}
                                        checked={newAuditProcessIds.includes(proc.id)}
                                        onCheckedChange={(checked) => {
                                            setNewAuditProcessIds(prev =>
                                                checked ? [...prev, proc.id] : prev.filter(id => id !== proc.id)
                                            )
                                        }}
                                    >
                                        {proc.proceso}
                                    </DropdownMenuCheckboxItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
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
          <Tabs defaultValue="historial">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="historial">Historial de Auditorías</TabsTrigger>
              <TabsTrigger value="actividad">Registro de Actividad del Sistema</TabsTrigger>
            </TabsList>
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
                                    <Button variant="ghost" size="icon" onClick={() => promptDeleteAudit(audit)} className="text-destructive hover:text-destructive">
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
                    <Select value={logActionFilter} onValueChange={(v) => setLogActionFilter(v as any)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Todas las Acciones</SelectItem>{uniqueLogActions.slice(1).map(a=><SelectItem key={a} value={a} className="capitalize">{a}</SelectItem>)}</SelectContent></Select>
                    <Select value={logEntityTypeFilter} onValueChange={(v) => setLogEntityTypeFilter(v as any)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Todas las Entidades</SelectItem>{uniqueLogEntityTypes.slice(1).map(e=><SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent></Select>
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
                          <Badge variant="secondary" className="capitalize">{log.action.replace('_', ' ')}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{log.details}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
                 <div className="flex items-center justify-between space-x-2 py-4"><span className="text-sm text-muted-foreground">Página {logCurrentPage} de {totalLogPages} ({filteredAndSortedLogs.length} total)</span><div className="space-x-2"><Button variant="outline" size="sm" onClick={() => setLogCurrentPage(p => Math.max(1, p - 1))} disabled={logCurrentPage === 1}>Anterior</Button><Button variant="outline" size="sm" onClick={() => setLogCurrentPage(p => Math.min(totalLogPages, p + 1))} disabled={logCurrentPage === totalLogPages || totalLogPages === 0}>Siguiente</Button></div></div>
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
