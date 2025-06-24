
'use client';

import * as React from 'react'; 
import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { useAreas, type Area } from '@/contexts/AreasContext';
import { useDepartamentos, type Departamento } from '@/contexts/DepartamentosContext';
import { usePuestos, type Puesto, type NivelOrganizacional, nivelesOrganizacionales, type PuestoCreationData } from '@/contexts/PuestosContext';
import { 
  useSistemasCostos, 
  type Sistema, 
  type SistemaCosto,
  tiposDeCostoOptions,
  formasDePagoOptions,
  frecuenciasDePagoOptions,
  tiposDeMonedaOptions,
  type TipoCosto,
  type FormaPago,
  type FrecuenciaPago,
  type TipoMoneda,
  type SistemaScope,
  sistemaScopeOptions,
  type SistemaCreationData,
  type SistemaUpdateData
} from '@/contexts/SistemasCostosContext';
import { useAcciones, type Accion } from '@/contexts/AccionesContext';
import type { CapturedProcess } from '../procesos-y-flujos-registrados/page';


import { Button, buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
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

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from '@/hooks/use-toast';
import { Settings, PlusCircle, Edit2, Trash2, Building, Users, Laptop, DollarSign, Share2, ClipboardList, Loader2, UploadCloud, Building2, Search, ChevronsUpDown, ArrowUp, ArrowDown, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useActivityLog } from '@/contexts/ActivityLogContext';

const NO_AREA_VALUE = "__NO_AREA__";
const NO_DEPARTAMENTO_VALUE = "__NO_DEPARTAMENTO__";
const NO_JEFE_VALUE = "__NO_JEFE__";
const NO_SCOPE_ID_VALUE = "__NO_SCOPE_ID__";
const CAPTURED_DATA_LOCAL_STORAGE_KEY = 'proceza-captured-data';
const LOCAL_STORAGE_ACCIONES_KEY = 'proceza-acciones';

const ITEMS_PER_PAGE_CONFIG = 5; 

// Sorting Types
type SortableAreaKeys = keyof Area;
type SortableDeptoKeys = keyof Departamento | 'areaNombre';
type SortablePuestoKeys = keyof Puesto | 'areaNombre' | 'deptoNombre' | 'jefeNombre';
type SortableSistemaKeys = keyof Sistema | 'costoAnual';
type SortDirection = 'ascending' | 'descending';

interface SortConfig<T> {
  key: T;
  direction: SortDirection;
}


// Zod schemas
const areaFormSchema = z.object({
  id: z.string().optional(),
  nombre: z.string().min(1, 'El nombre del área es requerido.'),
});
type AreaFormData = z.infer<typeof areaFormSchema>;

const departamentoFormSchema = z.object({
  id: z.string().optional(),
  nombre: z.string().min(1, 'El nombre del departamento es requerido.'),
  areaId: z.string().min(1, "Debe seleccionar un área para el departamento."),
});
type DepartamentoFormData = z.infer<typeof departamentoFormSchema>;

const puestoFormSchema = z.object({
  id: z.string().optional(),
  nombre: z.string().min(1, 'El nombre del puesto es requerido.'),
  areaId: z.string().min(1, 'El área es requerida.'),
  departamentoId: z.string().optional().or(z.literal(NO_DEPARTAMENTO_VALUE).transform(() => undefined)),
  jefeInmediato: z.string().optional().or(z.literal(NO_JEFE_VALUE).transform(() => undefined)),
  nivelOrganizacional: z.enum(nivelesOrganizacionales, {
    errorMap: () => ({ message: "Debe seleccionar un nivel organizacional válido." }),
  }),
  numeroPersonas: z.preprocess(
    (val) => (String(val).trim() === '' ? undefined : parseInt(String(val), 10)),
    z.number().int("El número debe ser entero.").nonnegative("El número debe ser positivo o cero.").optional()
  ),
});
type PuestoFormData = z.infer<typeof puestoFormSchema>;

const sistemaFormSchema = z.object({
  id: z.string().optional(),
  nombre: z.string().min(1, 'El nombre del sistema es requerido.'),
  scope: z.enum(sistemaScopeOptions, { errorMap: () => ({ message: "Seleccione un ámbito válido."}) }),
  scopeId: z.string().optional(),
}).superRefine((data, ctx) => {
  if ((data.scope === "Área" || data.scope === "Puesto" || data.scope === "Departamento") && (!data.scopeId || data.scopeId === NO_SCOPE_ID_VALUE)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Debe seleccionar un${data.scope === "Área" ? " área" : (data.scope === "Departamento" ? " departamento" : " puesto")} específico.`,
      path: ["scopeId"],
    });
  }
});
type SistemaFormData = z.infer<typeof sistemaFormSchema>;

const costoSistemaFormSchema = z.object({
  id: z.string().optional(),
  sistemaId: z.string().min(1, "Debe seleccionar un sistema."),
  tipoCosto: z.array(z.enum(tiposDeCostoOptions)).min(1, "Debe seleccionar al menos un tipo de costo."),
  montoUso: z.preprocess(
    (val) => (String(val).trim() === '' ? undefined : parseFloat(String(val))),
    z.number().nonnegative("El monto debe ser un número positivo o cero.").optional()
  ),
  numeroLicencias: z.preprocess(
    (val) => (String(val).trim() === '' ? undefined : parseInt(String(val), 10)),
    z.number().int("El número de licencias debe ser un entero.").nonnegative("El número de licencias debe ser positivo o cero.").optional()
  ),
  costoPorLicencia: z.preprocess(
    (val) => (String(val).trim() === '' ? undefined : parseFloat(String(val))),
    z.number().nonnegative("El costo por licencia debe ser positivo o cero.").optional()
  ),
  formaPago: z.enum(formasDePagoOptions, { errorMap: () => ({ message: "Seleccione una forma de pago válida." })}),
  frecuencia: z.enum(frecuenciasDePagoOptions, { errorMap: () => ({ message: "Seleccione una frecuencia válida." })}),
  moneda: z.enum(tiposDeMonedaOptions, { errorMap: () => ({ message: "Seleccione un tipo de moneda válido." })}),
  descripcion: z.string().optional(),
}).superRefine((data, ctx) => {
  const usoSelected = data.tipoCosto.includes("Por Uso del Sistema");
  const licenciasSelected = data.tipoCosto.includes("Por Licencias");

  if (usoSelected && (data.montoUso === undefined || data.montoUso === null)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "El monto por uso es requerido si 'Por Uso del Sistema' está seleccionado.",
      path: ["montoUso"],
    });
  }

  if (licenciasSelected) {
    if (data.numeroLicencias === undefined || data.numeroLicencias === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El número de licencias es requerido si 'Por Licencias' está seleccionado.",
        path: ["numeroLicencias"],
      });
    }
    if (data.costoPorLicencia === undefined || data.costoPorLicencia === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El costo por licencia es requerido si 'Por Licencias' está seleccionado.",
        path: ["costoPorLicencia"],
      });
    }
  }
});

type SistemaCostoFormData = z.infer<typeof costoSistemaFormSchema>;


const PlaceholderContent = ({ title, description, icon, isLoading }: { title: string, description: string, icon: ReactNode, isLoading?: boolean }) => (
  <div className="mt-6 p-8 border border-dashed border-border rounded-lg flex flex-col items-center justify-center min-h-[200px] bg-muted/20">
    {React.cloneElement(icon as React.ReactElement, isLoading ? { className: `${(icon as React.ReactElement).props.className} animate-pulse` } : {})}
    <p className="text-lg font-semibold text-foreground mt-4">{title}</p>
    <p className="text-sm text-muted-foreground text-center">{description}</p>
  </div>
);

function formatCurrency(amount: number | undefined, currency: TipoMoneda = "USD") {
  if (amount === undefined || isNaN(amount)) return "-";
  try {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: currency }).format(amount);
  } catch (e) {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function getSystemAnnualCostValue(systemId: string, allCosts: SistemaCosto[]): number {
    const costsForSystem = allCosts.filter(cost => cost.sistemaId === systemId);
    if (costsForSystem.length === 0) return 0;
  
    let totalAnnualCost = 0;
    costsForSystem.forEach(cost => {
      const costFromUsage = cost.montoUso || 0;
      const costFromLicenses = (cost.costoPorLicencia || 0) * (cost.numeroLicencias || 0);
      const baseAmount = costFromUsage + costFromLicenses;
      if (cost.frecuencia === "Mensual") {
        totalAnnualCost += baseAmount * 12;
      } else if (cost.frecuencia === "Anual") {
        totalAnnualCost += baseAmount;
      } else {
        totalAnnualCost += baseAmount;
      }
    });
    return totalAnnualCost;
}

function getSystemAnnualCost(systemId: string, allCosts: SistemaCosto[], allSistemas: Sistema[]): string {
  const system = allSistemas.find(s => s.id === systemId);
  if (!system) return "N/A";
  const costsForSystem = allCosts.filter(cost => cost.sistemaId === systemId);
  if (costsForSystem.length === 0) return formatCurrency(0, 'USD'); 
  const displayCurrency = costsForSystem[0].moneda; 
  const totalAnnualCost = getSystemAnnualCostValue(systemId, allCosts);
  return formatCurrency(totalAnnualCost, displayCurrency);
}


export default function ConfiguracionPage() {
  const router = useRouter();
  const { areas, addArea, updateArea, deleteArea, isLoading: isLoadingAreas } = useAreas();
  const { departamentos, addDepartamento, updateDepartamento, deleteDepartamento, isLoading: isLoadingDepartamentos } = useDepartamentos();
  const { puestos, addPuesto, updatePuesto, deletePuesto, isLoadingPuestos } = usePuestos();
  const { 
    sistemas, 
    costosSistemas, 
    addSistema, 
    updateSistema, 
    deleteSistema, 
    addCostoSistema,
    updateCostoSistema,
    deleteCostoSistema,
    isLoadingSistemasCostos,
    getCostsForSystem,
  } = useSistemasCostos();
  const { acciones: allAcciones, isLoadingAcciones } = useAcciones();
  const [allCapturedProcesses, setAllCapturedProcesses] = useState<CapturedProcess[]>([]);
  const { addLogEntry } = useActivityLog();

  // State
  const [isAreaDialogOpen, setIsAreaDialogOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [isDepartamentoDialogOpen, setIsDepartamentoDialogOpen] = useState(false);
  const [editingDepartamento, setEditingDepartamento] = useState<Departamento | null>(null);
  const [isPuestoDialogOpen, setIsPuestoDialogOpen] = useState(false);
  const [editingPuesto, setEditingPuesto] = useState<Puesto | null>(null);
  const [isSistemaDialogOpen, setIsSistemaDialogOpen] = useState(false);
  const [editingSistema, setEditingSistema] = useState<Sistema | null>(null);
  const [isCostoSistemaDialogOpen, setIsCostoSistemaDialogOpen] = useState(false);
  const [editingCostoSistema, setEditingCostoSistema] = useState<SistemaCosto | null>(null);
  const [selectedSystemForCosts, setSelectedSystemForCosts] = useState<Sistema | null>(null);
  const [isManageCostsDialogOpen, setIsManageCostsDialogOpen] = useState(false);
  
  const [itemToDelete, setItemToDelete] = useState<{ id: string; name: string; type: 'area' | 'departamento' | 'puesto' } | null>(null);
  const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] = useState(false);


  // Sorting & Filtering State
  const [areaSearchTerm, setAreaSearchTerm] = useState('');
  const [areaSortConfig, setAreaSortConfig] = useState<SortConfig<SortableAreaKeys> | null>(null);
  const [areasCurrentPage, setAreasCurrentPage] = useState(1);

  const [deptoSearchTerm, setDeptoSearchTerm] = useState('');
  const [deptoAreaFilter, setDeptoAreaFilter] = useState('all');
  const [deptoSortConfig, setDeptoSortConfig] = useState<SortConfig<SortableDeptoKeys> | null>(null);
  const [departamentosCurrentPage, setDepartamentosCurrentPage] = useState(1);
  
  const [puestoSearchTerm, setPuestoSearchTerm] = useState('');
  const [puestoAreaFilter, setPuestoAreaFilter] = useState('all');
  const [puestoNivelFilter, setPuestoNivelFilter] = useState('all');
  const [puestoSortConfig, setPuestoSortConfig] = useState<SortConfig<SortablePuestoKeys> | null>(null);
  const [puestosCurrentPage, setPuestosCurrentPage] = useState(1);
  
  const [sistemaSearchTerm, setSistemaSearchTerm] = useState('');
  const [sistemaScopeFilter, setSistemaScopeFilter] = useState('all');
  const [sistemaSortConfig, setSistemaSortConfig] = useState<SortConfig<SortableSistemaKeys> | null>(null);
  const [sistemasCurrentPage, setSistemasCurrentPage] = useState(1);

  const [costosDialogCurrentPage, setCostosDialogCurrentPage] = useState(1);

  useEffect(() => {
    if (typeof window !== 'undefined') {
        const storedData = localStorage.getItem(CAPTURED_DATA_LOCAL_STORAGE_KEY);
        if (storedData) {
            setAllCapturedProcesses(JSON.parse(storedData));
        }
    }
  }, []);

  // Forms
  const areaForm = useForm<AreaFormData>({ resolver: zodResolver(areaFormSchema), defaultValues: { nombre: '' } });
  const departamentoForm = useForm<DepartamentoFormData>({ resolver: zodResolver(departamentoFormSchema), defaultValues: { nombre: '', areaId: '' } });
  const puestoForm = useForm<PuestoFormData>({ resolver: zodResolver(puestoFormSchema), defaultValues: { nombre: '', areaId: '', departamentoId: undefined, jefeInmediato: undefined, nivelOrganizacional: undefined, numeroPersonas: undefined, }});
  const sistemaForm = useForm<SistemaFormData>({ resolver: zodResolver(sistemaFormSchema), defaultValues: { nombre: '', scope: "Empresa", scopeId: undefined } });
  const costoSistemaForm = useForm<SistemaCostoFormData>({ resolver: zodResolver(costoSistemaFormSchema), defaultValues: { sistemaId: '', tipoCosto: [], montoUso: undefined, numeroLicencias: undefined, costoPorLicencia: undefined, formaPago: undefined, frecuencia: undefined, moneda: 'USD', descripcion: '' } });

  // Dialog Effects
  useEffect(() => { if (editingArea) areaForm.reset({ id: editingArea.id, nombre: editingArea.nombre }); else areaForm.reset({ nombre: '' }); }, [editingArea, areaForm]);
  useEffect(() => { if (editingDepartamento) departamentoForm.reset({ id: editingDepartamento.id, nombre: editingDepartamento.nombre, areaId: editingDepartamento.areaId }); else departamentoForm.reset({ nombre: '', areaId: '' }); }, [editingDepartamento, departamentoForm]);
  useEffect(() => { if (editingPuesto) { puestoForm.reset({ id: editingPuesto.id, nombre: editingPuesto.nombre, areaId: editingPuesto.areaId, departamentoId: editingPuesto.departamentoId || NO_DEPARTAMENTO_VALUE, jefeInmediato: editingPuesto.jefeInmediato || NO_JEFE_VALUE, nivelOrganizacional: editingPuesto.nivelOrganizacional, numeroPersonas: editingPuesto.numeroPersonas }); } else { puestoForm.reset({ nombre: '', areaId: '', departamentoId: NO_DEPARTAMENTO_VALUE, jefeInmediato: NO_JEFE_VALUE, nivelOrganizacional: undefined, numeroPersonas: undefined }); } }, [editingPuesto, puestoForm]);
  useEffect(() => { if (editingSistema) { sistemaForm.reset({ id: editingSistema.id, nombre: editingSistema.nombre, scope: editingSistema.scope, scopeId: editingSistema.scope === "Empresa" ? undefined : editingSistema.scopeId }); } else { sistemaForm.reset({ nombre: '', scope: "Empresa", scopeId: undefined }); } }, [editingSistema, sistemaForm]);
  useEffect(() => { if (isCostoSistemaDialogOpen) { if (editingCostoSistema) { costoSistemaForm.reset({ id: editingCostoSistema.id, sistemaId: editingCostoSistema.sistemaId, tipoCosto: editingCostoSistema.tipoCosto, montoUso: editingCostoSistema.montoUso, numeroLicencias: editingCostoSistema.numeroLicencias, costoPorLicencia: editingCostoSistema.costoPorLicencia, formaPago: editingCostoSistema.formaPago, frecuencia: editingCostoSistema.frecuencia, moneda: editingCostoSistema.moneda, descripcion: editingCostoSistema.descripcion, }); } else if (selectedSystemForCosts) { costoSistemaForm.reset({ sistemaId: selectedSystemForCosts.id, tipoCosto: [], montoUso: undefined, numeroLicencias: undefined, costoPorLicencia: undefined, formaPago: undefined, frecuencia: undefined, moneda: 'USD', descripcion: '' }); } } }, [editingCostoSistema, isCostoSistemaDialogOpen, selectedSystemForCosts, costoSistemaForm]);
  
  // Submit handlers
  function handleAreaSubmit(data: AreaFormData) {
    if (editingArea) {
      const originalArea = areas.find(a => a.id === editingArea.id);
      if (originalArea && originalArea.nombre !== data.nombre) {
        // Cascade update logic
        const updatedProcesses = allCapturedProcesses.map(p => p.area === originalArea.nombre ? { ...p, area: data.nombre } : p);
        const updatedAcciones = allAcciones.map(a => a.area === originalArea.nombre ? { ...a, area: data.nombre } : a);
        localStorage.setItem(CAPTURED_DATA_LOCAL_STORAGE_KEY, JSON.stringify(updatedProcesses));
        localStorage.setItem(LOCAL_STORAGE_ACCIONES_KEY, JSON.stringify(updatedAcciones));
        setAllCapturedProcesses(updatedProcesses); // Update local state for immediate UI feedback
      }
      updateArea(editingArea.id, data.nombre);
    } else {
      addArea(data.nombre);
    }
    setEditingArea(null);
    setIsAreaDialogOpen(false);
    areaForm.reset();
  }

  function handleDepartamentoSubmit(data: DepartamentoFormData) {
    if (editingDepartamento) {
      const originalDepto = departamentos.find(d => d.id === editingDepartamento.id);
      if (originalDepto && originalDepto.nombre !== data.nombre) {
        // Cascade update logic
        const updatedProcesses = allCapturedProcesses.map(p => p.departamento === originalDepto.nombre ? { ...p, departamento: data.nombre } : p);
        localStorage.setItem(CAPTURED_DATA_LOCAL_STORAGE_KEY, JSON.stringify(updatedProcesses));
        setAllCapturedProcesses(updatedProcesses);
      }
      updateDepartamento(editingDepartamento.id, data.nombre, data.areaId);
    } else {
      addDepartamento(data.nombre, data.areaId);
    }
    setEditingDepartamento(null);
    setIsDepartamentoDialogOpen(false);
    departamentoForm.reset();
  }

  function handlePuestoSubmit(data: PuestoFormData) {
    const puestoDataToSave: PuestoCreationData = {
      nombre: data.nombre,
      areaId: data.areaId,
      departamentoId: data.departamentoId === NO_DEPARTAMENTO_VALUE ? undefined : data.departamentoId,
      jefeInmediato: data.jefeInmediato === NO_JEFE_VALUE ? undefined : data.jefeInmediato,
      nivelOrganizacional: data.nivelOrganizacional,
      numeroPersonas: data.numeroPersonas,
    };

    if (editingPuesto) {
      const originalPuesto = puestos.find(p => p.id === editingPuesto.id);
      if (originalPuesto && originalPuesto.nombre !== data.nombre) {
        // Cascade update logic
        const updatedProcesses = allCapturedProcesses.map(p => p.puesto === originalPuesto.nombre ? { ...p, puesto: data.nombre } : p);
        const updatedAcciones = allAcciones.map(a => a.puesto === originalPuesto.nombre ? { ...a, puesto: data.nombre } : a);
        localStorage.setItem(CAPTURED_DATA_LOCAL_STORAGE_KEY, JSON.stringify(updatedProcesses));
        localStorage.setItem(LOCAL_STORAGE_ACCIONES_KEY, JSON.stringify(updatedAcciones));
        setAllCapturedProcesses(updatedProcesses);
      }
      updatePuesto(editingPuesto.id, puestoDataToSave);
    } else {
      addPuesto(puestoDataToSave);
    }
    setEditingPuesto(null);
    setIsPuestoDialogOpen(false);
    puestoForm.reset();
  }

  function handleSistemaSubmit(data: SistemaFormData) {
    const sistemaData: SistemaCreationData | SistemaUpdateData = { nombre: data.nombre, scope: data.scope, scopeId: data.scope === "Empresa" ? undefined : (data.scopeId === NO_SCOPE_ID_VALUE ? undefined : data.scopeId), };
    if (editingSistema) {
      updateSistema(editingSistema.id, sistemaData as SistemaUpdateData);
      toast({ title: 'Sistema Actualizado' });
    } else {
      const newSystem = addSistema(sistemaData as SistemaCreationData);
      toast({ title: 'Sistema Agregado' });
      openManageCostsDialog(newSystem);
    }
    setEditingSistema(null);
    setIsSistemaDialogOpen(false);
    sistemaForm.reset({ nombre: '', scope: "Empresa", scopeId: undefined });
  }

  function handleCostoSistemaSubmit(data: SistemaCostoFormData) {
    const costoDataToSave: Omit<SistemaCosto, 'id'> = { sistemaId: data.sistemaId, tipoCosto: data.tipoCosto, montoUso: data.tipoCosto.includes("Por Uso del Sistema") ? data.montoUso : undefined, numeroLicencias: data.tipoCosto.includes("Por Licencias") ? data.numeroLicencias : undefined, costoPorLicencia: data.tipoCosto.includes("Por Licencias") ? data.costoPorLicencia : undefined, formaPago: data.formaPago, frecuencia: data.frecuencia, moneda: data.moneda, descripcion: data.descripcion, };
    if (editingCostoSistema) {
      updateCostoSistema(editingCostoSistema.id, costoDataToSave);
      toast({ title: 'Costo de Sistema Actualizado' });
    } else {
      addCostoSistema(costoDataToSave);
      toast({ title: 'Costo de Sistema Agregado' });
    }
    setEditingCostoSistema(null);
    setIsCostoSistemaDialogOpen(false);
    costoSistemaForm.reset();
  }
  
  // Edit handlers
  function handleEditArea(area: Area) { setEditingArea(area); setIsAreaDialogOpen(true); }
  function handleEditDepartamento(depto: Departamento) { setEditingDepartamento(depto); setIsDepartamentoDialogOpen(true); }
  function handleEditPuesto(puesto: Puesto) { setEditingPuesto(puesto); setIsPuestoDialogOpen(true); }
  function handleEditSistema(sistema: Sistema) { setEditingSistema(sistema); setIsSistemaDialogOpen(true); }
  function handleEditCostoSistema(costo: SistemaCosto) { setEditingCostoSistema(costo); const systemForCost = sistemas.find(s => s.id === costo.sistemaId); if (systemForCost) setSelectedSystemForCosts(systemForCost); setIsCostoSistemaDialogOpen(true); }

  // Delete Handlers
  function promptDelete(id: string, name: string, type: 'area' | 'departamento' | 'puesto') {
    setItemToDelete({ id, name, type });
    setIsConfirmDeleteDialogOpen(true);
  }
  
  function executeDelete() {
    if (!itemToDelete) return;
    
    let isBlocked = false;
    const { id, name, type } = itemToDelete;

    if (type === 'area') {
      if (departamentos.some(d => d.areaId === id) || puestos.some(p => p.areaId === id) || sistemas.some(s => s.scope === "Área" && s.scopeId === id) || allCapturedProcesses.some(proc => proc.area === name && !proc.deletedAt) || allAcciones.some(a => a.area === name)) {
        isBlocked = true;
      } else {
        deleteArea(id);
      }
    } else if (type === 'departamento') {
      if (puestos.some(p => p.departamentoId === id) || sistemas.some(s => s.scope === "Departamento" && s.scopeId === id) || allCapturedProcesses.some(proc => proc.departamento === name && !proc.deletedAt)) {
        isBlocked = true;
      } else {
        deleteDepartamento(id);
      }
    } else if (type === 'puesto') {
      if (puestos.some(p => p.jefeInmediato === id) || sistemas.some(s => s.scope === "Puesto" && s.scopeId === id) || allCapturedProcesses.some(proc => proc.puesto === name && !proc.deletedAt) || allAcciones.some(a => a.puesto === name)) {
        isBlocked = true;
      } else {
        deletePuesto(id);
      }
    }

    if (isBlocked) {
      toast({
        title: "Eliminación Bloqueada",
        description: `El ${type} "${name}" está en uso por otra entidad (procesos, acciones, etc.) y no puede ser eliminado.`,
        variant: "destructive",
        duration: 7000,
      });
    } else {
      toast({ title: `${type.charAt(0).toUpperCase() + type.slice(1)} Eliminado(a)`, variant: 'destructive' });
    }
    
    setItemToDelete(null);
    setIsConfirmDeleteDialogOpen(false);
  }

  function handleDeleteSistema(sistemaId: string) { deleteSistema(sistemaId); toast({ title: 'Sistema Eliminado', description: 'El sistema y sus costos asociados han sido eliminados.', variant: 'destructive' }); }
  function handleDeleteCostoSistema(costoId: string) { deleteCostoSistema(costoId); toast({ title: 'Costo de Sistema Eliminado', variant: 'destructive' }); }
  
  // Dialog Openers
  function openManageCostsDialog(sistema: Sistema) { setSelectedSystemForCosts(sistema); setCostosDialogCurrentPage(1); setIsManageCostsDialogOpen(true); }
  function openAddCostoDialogForSelectedSystem() { if (!selectedSystemForCosts) return; setEditingCostoSistema(null); setIsCostoSistemaDialogOpen(true); }

  // Generic Sort Functions
  const createSortHandler = <T,>(setter: React.Dispatch<React.SetStateAction<SortConfig<T> | null>>) => (key: T) => { setter(prev => ({ key, direction: prev?.key === key && prev.direction === 'ascending' ? 'descending' : 'ascending' })) };
  const createSortIconGetter = <T,>(config: SortConfig<T> | null) => (key: T) => { if (!config || config.key !== key) { return <ChevronsUpDown className="ml-2 h-3 w-3 opacity-40 group-hover:opacity-100" />; } return config.direction === 'ascending' ? <ArrowUp className="ml-2 h-3 w-3" /> : <ArrowDown className="ml-2 h-3 w-3" />; };
  
  // Area Sort
  const requestAreaSort = createSortHandler(setAreaSortConfig);
  const getAreaSortIcon = createSortIconGetter(areaSortConfig);

  // Depto Sort
  const requestDeptoSort = createSortHandler(setDeptoSortConfig);
  const getDeptoSortIcon = createSortIconGetter(deptoSortConfig);

  // Puesto Sort
  const requestPuestoSort = createSortHandler(setPuestoSortConfig);
  const getPuestoSortIcon = createSortIconGetter(puestoSortConfig);

  // Sistema Sort
  const requestSistemaSort = createSortHandler(setSistemaSortConfig);
  const getSistemaSortIcon = createSortIconGetter(sistemaSortConfig);

  // Filtered and Sorted Data
  const sortedAndFilteredAreas = useMemo(() => { setAreasCurrentPage(1); let filtered = areas.filter(a => a.nombre.toLowerCase().includes(areaSearchTerm.toLowerCase())); if (areaSortConfig) { filtered.sort((a, b) => { if (a[areaSortConfig.key]! < b[areaSortConfig.key]!) return areaSortConfig.direction === 'ascending' ? -1 : 1; if (a[areaSortConfig.key]! > b[areaSortConfig.key]!) return areaSortConfig.direction === 'ascending' ? 1 : -1; return 0; }); } return filtered; }, [areas, areaSearchTerm, areaSortConfig]);
  const sortedAndFilteredDepartamentos = useMemo(() => { setDepartamentosCurrentPage(1); let filtered = departamentos.filter(d => (d.nombre.toLowerCase().includes(deptoSearchTerm.toLowerCase())) && (deptoAreaFilter === 'all' || d.areaId === deptoAreaFilter)); if (deptoSortConfig) { filtered.sort((a, b) => { const valA = deptoSortConfig.key === 'areaNombre' ? areas.find(ar => ar.id === a.areaId)?.nombre || '' : a[deptoSortConfig.key]; const valB = deptoSortConfig.key === 'areaNombre' ? areas.find(ar => ar.id === b.areaId)?.nombre || '' : b[deptoSortConfig.key]; if (valA < valB) return deptoSortConfig.direction === 'ascending' ? -1 : 1; if (valA > valB) return deptoSortConfig.direction === 'ascending' ? 1 : -1; return 0; }); } return filtered; }, [departamentos, deptoSearchTerm, deptoAreaFilter, deptoSortConfig, areas]);
  const sortedAndFilteredPuestos = useMemo(() => { setPuestosCurrentPage(1); let filtered = puestos.filter(p => (p.nombre.toLowerCase().includes(puestoSearchTerm.toLowerCase())) && (puestoAreaFilter === 'all' || p.areaId === puestoAreaFilter) && (puestoNivelFilter === 'all' || p.nivelOrganizacional === puestoNivelFilter)); if (puestoSortConfig) { filtered.sort((a, b) => { const getVal = (p: Puesto, key: SortablePuestoKeys) => { switch (key) { case 'areaNombre': return areas.find(ar => ar.id === p.areaId)?.nombre || ''; case 'deptoNombre': return departamentos.find(d => d.id === p.departamentoId)?.nombre || ''; case 'jefeNombre': return puestos.find(j => j.id === p.jefeInmediato)?.nombre || ''; default: return p[key as keyof Puesto]; }}; const valA = getVal(a, puestoSortConfig.key); const valB = getVal(b, puestoSortConfig.key); if (valA < valB) return puestoSortConfig.direction === 'ascending' ? -1 : 1; if (valA > valB) return puestoSortConfig.direction === 'ascending' ? 1 : -1; return 0; }); } return filtered; }, [puestos, puestoSearchTerm, puestoAreaFilter, puestoNivelFilter, puestoSortConfig, areas, departamentos]);
  const sortedAndFilteredSistemas = useMemo(() => { setSistemasCurrentPage(1); let filtered = sistemas.filter(s => (s.nombre.toLowerCase().includes(sistemaSearchTerm.toLowerCase())) && (sistemaScopeFilter === 'all' || s.scope === sistemaScopeFilter)); if (sistemaSortConfig) { filtered.sort((a, b) => { const getVal = (s: Sistema, key: SortableSistemaKeys) => key === 'costoAnual' ? getSystemAnnualCostValue(s.id, costosSistemas) : s[key as keyof Sistema]; const valA = getVal(a, sistemaSortConfig.key); const valB = getVal(b, sistemaSortConfig.key); if (valA < valB) return sistemaSortConfig.direction === 'ascending' ? -1 : 1; if (valA > valB) return sistemaSortConfig.direction === 'ascending' ? 1 : -1; return 0; }); } return filtered; }, [sistemas, sistemaSearchTerm, sistemaScopeFilter, sistemaSortConfig, costosSistemas]);
  
  // Pagination
  const paginatedAreas = useMemo(() => sortedAndFilteredAreas.slice((areasCurrentPage - 1) * ITEMS_PER_PAGE_CONFIG, areasCurrentPage * ITEMS_PER_PAGE_CONFIG), [sortedAndFilteredAreas, areasCurrentPage]);
  const totalAreasPages = Math.ceil(sortedAndFilteredAreas.length / ITEMS_PER_PAGE_CONFIG);
  const paginatedDepartamentos = useMemo(() => sortedAndFilteredDepartamentos.slice((departamentosCurrentPage - 1) * ITEMS_PER_PAGE_CONFIG, departamentosCurrentPage * ITEMS_PER_PAGE_CONFIG), [sortedAndFilteredDepartamentos, departamentosCurrentPage]);
  const totalDepartamentosPages = Math.ceil(sortedAndFilteredDepartamentos.length / ITEMS_PER_PAGE_CONFIG);
  const paginatedPuestos = useMemo(() => sortedAndFilteredPuestos.slice((puestosCurrentPage - 1) * ITEMS_PER_PAGE_CONFIG, puestosCurrentPage * ITEMS_PER_PAGE_CONFIG), [sortedAndFilteredPuestos, puestosCurrentPage]);
  const totalPuestosPages = Math.ceil(sortedAndFilteredPuestos.length / ITEMS_PER_PAGE_CONFIG);
  const paginatedSistemas = useMemo(() => sortedAndFilteredSistemas.slice((sistemasCurrentPage - 1) * ITEMS_PER_PAGE_CONFIG, sistemasCurrentPage * ITEMS_PER_PAGE_CONFIG), [sortedAndFilteredSistemas, sistemasCurrentPage]);
  const totalSistemasPages = Math.ceil(sortedAndFilteredSistemas.length / ITEMS_PER_PAGE_CONFIG);

  const costsForSelectedSystem = useMemo(() => selectedSystemForCosts ? getCostsForSystem(selectedSystemForCosts.id) : [], [selectedSystemForCosts, getCostsForSystem]);
  const paginatedCostosDialog = useMemo(() => costsForSelectedSystem.slice((costosDialogCurrentPage - 1) * ITEMS_PER_PAGE_CONFIG, costosDialogCurrentPage * ITEMS_PER_PAGE_CONFIG), [costsForSelectedSystem, costosDialogCurrentPage]);
  const totalCostosDialogPages = Math.ceil(costsForSelectedSystem.length / ITEMS_PER_PAGE_CONFIG);
  
  const watchedSistemaScope = sistemaForm.watch('scope');
  const watchedPuestoAreaId = puestoForm.watch('areaId');
  const filteredDepartamentosForPuestoForm = useMemo(() => watchedPuestoAreaId ? departamentos.filter(d => d.areaId === watchedPuestoAreaId) : [], [watchedPuestoAreaId, departamentos]);
  
  const configSections: Array<{ value: string; label: string; icon: ReactNode; fullDescription: string; }> = [
    { value: 'areas', label: 'Áreas', icon: <Building className="h-5 w-5 mr-2" />, fullDescription: 'Administrar las áreas o divisiones principales de la empresa.' },
    { value: 'departamentos', label: 'Departamentos', icon: <Building2 className="h-5 w-5 mr-2" />, fullDescription: 'Administrar los departamentos dentro de cada área.' },
    { value: 'puestos', label: 'Puestos', icon: <Users className="h-5 w-5 mr-2" />, fullDescription: 'Administrar los roles o puestos de trabajo, asignándolos a un departamento.' },
    { value: 'sistemas', label: 'Sistemas y Costos', icon: <Laptop className="h-5 w-5 mr-2" />, fullDescription: 'Mantener el inventario de sistemas tecnológicos y sus costos asociados.' },
  ];

  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center gap-2">
          <Settings className="h-6 w-6 text-primary" />
          <CardTitle className="text-2xl font-headline">Módulo de Configuración</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-6">
            Centraliza la gestión de las listas maestras y parámetros fundamentales que el sistema utiliza en toda su operativa.
          </p>
          <Tabs defaultValue="areas" className="w-full">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 md:grid-cols-4 mb-4">
              {configSections.map(section => (
                <TabsTrigger key={section.value} value={section.value} className="flex items-center justify-center text-xs sm:text-sm">
                  {section.icon}
                  {section.label}
                </TabsTrigger>
              ))}
            </TabsList>
            
            <TabsContent value="areas">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center"><Building className="h-5 w-5 mr-2" /> Áreas</CardTitle>
                    <p className="text-sm text-muted-foreground">{configSections.find(s=>s.value==='areas')?.fullDescription}</p>
                  </CardHeader>
                  <CardContent>
                      <div className="flex justify-between items-center mb-4">
                        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" /><Input placeholder="Buscar área..." value={areaSearchTerm} onChange={(e) => setAreaSearchTerm(e.target.value)} className="w-full pl-10" /></div>
                        <Dialog open={isAreaDialogOpen} onOpenChange={(isOpen) => { setIsAreaDialogOpen(isOpen); if (!isOpen) setEditingArea(null); }}>
                          <DialogTrigger asChild><Button onClick={() => { setEditingArea(null); areaForm.reset(); }}><PlusCircle className="mr-2 h-4 w-4" /> Agregar Área</Button></DialogTrigger>
                          <DialogContent className="sm:max-w-[425px]"><DialogHeader><DialogTitle>{editingArea ? 'Editar Área' : 'Agregar Nueva Área'}</DialogTitle></DialogHeader><Form {...areaForm}><form onSubmit={areaForm.handleSubmit(handleAreaSubmit)} className="space-y-4 py-4"><FormField control={areaForm.control} name="nombre" render={({ field }) => (<FormItem><FormLabel>Nombre del Área</FormLabel><FormControl><Input placeholder="Ej: Finanzas, Operaciones" {...field} /></FormControl><FormMessage /></FormItem>)} /><DialogFooter><DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose><Button type="submit">{editingArea ? 'Guardar Cambios' : 'Agregar Área'}</Button></DialogFooter></form></Form></DialogContent>
                        </Dialog>
                      </div>
                      {isLoadingAreas ? (<PlaceholderContent title="Cargando áreas..." description="Por favor espere." icon={<Loader2 className="h-12 w-12 text-muted-foreground" />} isLoading />) : areas.length === 0 ? (<PlaceholderContent title="No hay áreas registradas" description="Comienza agregando áreas para organizar tu empresa." icon={<Building className="h-12 w-12 text-muted-foreground" />} />) : (
                        <><Card><Table><TableHeader><TableRow><TableHead className="cursor-pointer hover:bg-muted/50 group" onClick={() => requestAreaSort('nombre')}><div className="flex items-center">Nombre del Área {getAreaSortIcon('nombre')}</div></TableHead><TableHead className="text-right w-[120px]">Acciones</TableHead></TableRow></TableHeader><TableBody>{paginatedAreas.map((area) => (<TableRow key={area.id}><TableCell>{area.nombre}</TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => handleEditArea(area)} className="mr-2"><Edit2 className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => promptDelete(area.id, area.nombre, 'area')} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></TableCell></TableRow>))}</TableBody></Table></Card>
                        {totalAreasPages > 1 && (<div className="flex items-center justify-end space-x-2 py-4"><span className="text-sm text-muted-foreground">Página {areasCurrentPage} de {totalAreasPages} ({sortedAndFilteredAreas.length} total)</span><Button variant="outline" size="sm" onClick={() => setAreasCurrentPage(p => Math.max(1, p - 1))} disabled={areasCurrentPage === 1}>Anterior</Button><Button variant="outline" size="sm" onClick={() => setAreasCurrentPage(p => Math.min(totalAreasPages, p + 1))} disabled={areasCurrentPage === totalAreasPages}>Siguiente</Button></div>)}</>
                      )}
                  </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="departamentos">
                <Card>
                  <CardHeader><CardTitle className="flex items-center"><Building2 className="h-5 w-5 mr-2" /> Departamentos</CardTitle><p className="text-sm text-muted-foreground">{configSections.find(s=>s.value==='departamentos')?.fullDescription}</p></CardHeader>
                  <CardContent>
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                        <div className="flex-grow flex gap-4"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" /><Input placeholder="Buscar depto..." value={deptoSearchTerm} onChange={(e) => setDeptoSearchTerm(e.target.value)} className="w-full sm:w-[200px] pl-10" /></div><Select value={deptoAreaFilter} onValueChange={setDeptoAreaFilter}><SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Filtrar por área..." /></SelectTrigger><SelectContent><SelectItem value="all">Todas las Áreas</SelectItem>{areas.map(a => <SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>)}</SelectContent></Select></div>
                        <Dialog open={isDepartamentoDialogOpen} onOpenChange={(isOpen) => { setIsDepartamentoDialogOpen(isOpen); if (!isOpen) setEditingDepartamento(null); }}><DialogTrigger asChild><Button onClick={() => { setEditingDepartamento(null); departamentoForm.reset(); }}><PlusCircle className="mr-2 h-4 w-4" /> Agregar Depto.</Button></DialogTrigger><DialogContent className="sm:max-w-[425px]"><DialogHeader><DialogTitle>{editingDepartamento ? 'Editar Departamento' : 'Agregar Nuevo Departamento'}</DialogTitle></DialogHeader><Form {...departamentoForm}><form onSubmit={departamentoForm.handleSubmit(handleDepartamentoSubmit)} className="space-y-4 py-4"><FormField control={departamentoForm.control} name="nombre" render={({ field }) => (<FormItem><FormLabel>Nombre del Departamento</FormLabel><FormControl><Input placeholder="Ej: Contabilidad, Tesorería" {...field} /></FormControl><FormMessage /></FormItem>)} /><FormField control={departamentoForm.control} name="areaId" render={({ field }) => (<FormItem><FormLabel>Área a la que pertenece</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={isLoadingAreas}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione un área" /></SelectTrigger></FormControl><SelectContent>{areas.map(a => <SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} /><DialogFooter><DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose><Button type="submit">{editingDepartamento ? 'Guardar Cambios' : 'Agregar'}</Button></DialogFooter></form></Form></DialogContent></Dialog>
                      </div>
                      {isLoadingDepartamentos ? (<PlaceholderContent title="Cargando departamentos..." description="Por favor espere." icon={<Loader2 className="h-12 w-12 text-muted-foreground" />} isLoading />) : departamentos.length === 0 ? (<PlaceholderContent title="No hay departamentos registrados" description="Comienza agregando departamentos dentro de las áreas." icon={<Building2 className="h-12 w-12 text-muted-foreground" />} />) : (
                        <><Card><Table><TableHeader><TableRow><TableHead className="cursor-pointer hover:bg-muted/50 group" onClick={() => requestDeptoSort('nombre')}><div className="flex items-center">Nombre Depto. {getDeptoSortIcon('nombre')}</div></TableHead><TableHead className="cursor-pointer hover:bg-muted/50 group" onClick={() => requestDeptoSort('areaNombre')}><div className="flex items-center">Área {getDeptoSortIcon('areaNombre')}</div></TableHead><TableHead className="text-right w-[120px]">Acciones</TableHead></TableRow></TableHeader><TableBody>{paginatedDepartamentos.map((depto) => (<TableRow key={depto.id}><TableCell>{depto.nombre}</TableCell><TableCell>{areas.find(a => a.id === depto.areaId)?.nombre || 'N/A'}</TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => handleEditDepartamento(depto)} className="mr-2"><Edit2 className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => promptDelete(depto.id, depto.nombre, 'departamento')} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></TableCell></TableRow>))}</TableBody></Table></Card>
                        {totalDepartamentosPages > 1 && (<div className="flex items-center justify-end space-x-2 py-4"><span className="text-sm text-muted-foreground">Página {departamentosCurrentPage} de {totalDepartamentosPages} ({sortedAndFilteredDepartamentos.length} total)</span><Button variant="outline" size="sm" onClick={() => setDepartamentosCurrentPage(p => Math.max(1, p - 1))} disabled={departamentosCurrentPage === 1}>Anterior</Button><Button variant="outline" size="sm" onClick={() => setDepartamentosCurrentPage(p => Math.min(totalDepartamentosPages, p + 1))} disabled={departamentosCurrentPage === totalDepartamentosPages}>Siguiente</Button></div>)}</>
                      )}
                  </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="puestos">
              <Card>
                <CardHeader><CardTitle className="flex items-center"><Users className="h-5 w-5 mr-2" /> Puestos</CardTitle><p className="text-sm text-muted-foreground">{configSections.find(s=>s.value==='puestos')?.fullDescription}</p></CardHeader>
                <CardContent>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                      <div className="flex-grow flex flex-wrap gap-4"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" /><Input placeholder="Buscar puesto..." value={puestoSearchTerm} onChange={(e) => setPuestoSearchTerm(e.target.value)} className="w-full sm:w-[200px] pl-10" /></div><Select value={puestoAreaFilter} onValueChange={setPuestoAreaFilter}><SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Filtrar por área..." /></SelectTrigger><SelectContent><SelectItem value="all">Todas las Áreas</SelectItem>{areas.map(a => <SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>)}</SelectContent></Select><Select value={puestoNivelFilter} onValueChange={setPuestoNivelFilter}><SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Filtrar por nivel..." /></SelectTrigger><SelectContent><SelectItem value="all">Todos los Niveles</SelectItem>{nivelesOrganizacionales.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent></Select></div>
                      <Dialog open={isPuestoDialogOpen} onOpenChange={(isOpen) => { setIsPuestoDialogOpen(isOpen); if (!isOpen) setEditingPuesto(null); }}><DialogTrigger asChild><Button onClick={() => { setEditingPuesto(null); puestoForm.reset(); }}><PlusCircle className="mr-2 h-4 w-4" /> Agregar Puesto</Button></DialogTrigger><DialogContent className="sm:max-w-[525px]"><DialogHeader><DialogTitle>{editingPuesto ? 'Editar Puesto' : 'Agregar Nuevo Puesto'}</DialogTitle></DialogHeader><Form {...puestoForm}><form onSubmit={puestoForm.handleSubmit(handlePuestoSubmit)} className="space-y-4 py-4"><FormField control={puestoForm.control} name="nombre" render={({ field }) => (<FormItem><FormLabel>Nombre del Puesto</FormLabel><FormControl><Input placeholder="Ej: Analista Financiero" {...field} /></FormControl><FormMessage /></FormItem>)} /><FormField control={puestoForm.control} name="areaId" render={({ field }) => (<FormItem><FormLabel>Área</FormLabel><Select onValueChange={(value) => { field.onChange(value); puestoForm.setValue('departamentoId', NO_DEPARTAMENTO_VALUE); }} value={field.value} disabled={isLoadingAreas}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione un área" /></SelectTrigger></FormControl><SelectContent>{areas.map(a => <SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} /><FormField control={puestoForm.control} name="departamentoId" render={({ field }) => (<FormItem><FormLabel>Departamento (Opcional)</FormLabel><Select onValueChange={field.onChange} value={field.value || NO_DEPARTAMENTO_VALUE} disabled={!watchedPuestoAreaId || isLoadingDepartamentos}><FormControl><SelectTrigger><SelectValue placeholder={!watchedPuestoAreaId ? "Seleccione un área primero" : "Seleccione depto..."} /></SelectTrigger></FormControl><SelectContent><SelectItem value={NO_DEPARTAMENTO_VALUE}>Nivel de Área / Sin Depto.</SelectItem>{filteredDepartamentosForPuestoForm.map(d => <SelectItem key={d.id} value={d.id}>{d.nombre}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} /><FormField control={puestoForm.control} name="jefeInmediato" render={({ field }) => (<FormItem><FormLabel>Jefe Inmediato (Opcional)</FormLabel><Select onValueChange={field.onChange} value={field.value || NO_JEFE_VALUE} disabled={isLoadingPuestos}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione un jefe" /></SelectTrigger></FormControl><SelectContent><SelectItem value={NO_JEFE_VALUE}>Sin Jefe</SelectItem>{puestos.filter(p => !editingPuesto || p.id !== editingPuesto.id).map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} /><div className="grid grid-cols-2 gap-4"><FormField control={puestoForm.control} name="nivelOrganizacional" render={({ field }) => (<FormItem><FormLabel>Nivel</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger></FormControl><SelectContent>{nivelesOrganizacionales.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} /><FormField control={puestoForm.control} name="numeroPersonas" render={({ field }) => (<FormItem><FormLabel>Nº Personas</FormLabel><FormControl><Input type="number" placeholder="Ej: 5" {...field} value={field.value ?? ''} min="0" /></FormControl><FormMessage /></FormItem>)} /></div><DialogFooter><DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose><Button type="submit">{editingPuesto ? 'Guardar Cambios' : 'Agregar'}</Button></DialogFooter></form></Form></DialogContent></Dialog>
                    </div>
                    {isLoadingPuestos ? (<PlaceholderContent title="Cargando puestos..." description="Por favor espere." icon={<Loader2 className="h-12 w-12 text-muted-foreground" />} isLoading />) : puestos.length === 0 ? (<PlaceholderContent title="No hay puestos registrados" description="Comienza agregando puestos para definir la estructura de roles." icon={<Users className="h-12 w-12 text-muted-foreground" />} />) : (
                      <><Card><Table><TableHeader><TableRow><TableHead className="cursor-pointer hover:bg-muted/50 group" onClick={() => requestPuestoSort('nombre')}><div className="flex items-center">Nombre Puesto {getPuestoSortIcon('nombre')}</div></TableHead><TableHead className="cursor-pointer hover:bg-muted/50 group" onClick={() => requestPuestoSort('deptoNombre')}><div className="flex items-center">Depto. {getPuestoSortIcon('deptoNombre')}</div></TableHead><TableHead className="cursor-pointer hover:bg-muted/50 group" onClick={() => requestPuestoSort('areaNombre')}><div className="flex items-center">Área {getPuestoSortIcon('areaNombre')}</div></TableHead><TableHead className="cursor-pointer hover:bg-muted/50 group" onClick={() => requestPuestoSort('jefeNombre')}><div className="flex items-center">Jefe Inmediato {getPuestoSortIcon('jefeNombre')}</div></TableHead><TableHead className="text-right w-[120px]">Acciones</TableHead></TableRow></TableHeader><TableBody>{paginatedPuestos.map((puesto) => {const depto = departamentos.find(d => d.id === puesto.departamentoId); const area = areas.find(a => a.id === puesto.areaId); const jefe = puestos.find(p => p.id === puesto.jefeInmediato); return (<TableRow key={puesto.id}><TableCell>{puesto.nombre}</TableCell><TableCell>{depto?.nombre || '-'}</TableCell><TableCell>{area?.nombre || 'N/A'}</TableCell><TableCell>{jefe?.nombre || '-'}</TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => handleEditPuesto(puesto)} className="mr-2"><Edit2 className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => promptDelete(puesto.id, puesto.nombre, 'puesto')} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></TableCell></TableRow>);})}</TableBody></Table></Card>
                      {totalPuestosPages > 1 && (<div className="flex items-center justify-end space-x-2 py-4"><span className="text-sm text-muted-foreground">Página {puestosCurrentPage} de {totalPuestosPages} ({sortedAndFilteredPuestos.length} total)</span><Button variant="outline" size="sm" onClick={() => setPuestosCurrentPage(p => Math.max(1, p - 1))} disabled={puestosCurrentPage === 1}>Anterior</Button><Button variant="outline" size="sm" onClick={() => setPuestosCurrentPage(p => Math.min(totalPuestosPages, p + 1))} disabled={puestosCurrentPage === totalPuestosPages}>Siguiente</Button></div>)}</>
                    )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sistemas">
               <Card>
                <CardHeader><CardTitle className="flex items-center"><Laptop className="h-5 w-5 mr-2" /> Sistemas y Costos</CardTitle><p className="text-sm text-muted-foreground">{configSections.find(s=>s.value==='sistemas')?.fullDescription}</p></CardHeader>
                <CardContent>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                        <div className="flex-grow flex flex-wrap gap-4"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" /><Input placeholder="Buscar sistema..." value={sistemaSearchTerm} onChange={(e) => setSistemaSearchTerm(e.target.value)} className="w-full sm:w-[200px] pl-10" /></div><Select value={sistemaScopeFilter} onValueChange={setSistemaScopeFilter}><SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Filtrar por ámbito..." /></SelectTrigger><SelectContent><SelectItem value="all">Todos los Ámbitos</SelectItem>{sistemaScopeOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent></Select></div>
                        <Dialog open={isSistemaDialogOpen} onOpenChange={(isOpen) => { setIsSistemaDialogOpen(isOpen); if (!isOpen) setEditingSistema(null); }}><DialogTrigger asChild><Button onClick={() => { setEditingSistema(null); sistemaForm.reset(); }}><PlusCircle className="mr-2 h-4 w-4" /> Agregar Sistema</Button></DialogTrigger><DialogContent className="sm:max-w-[480px]"><DialogHeader><DialogTitle>{editingSistema ? 'Editar Sistema' : 'Agregar Nuevo Sistema'}</DialogTitle></DialogHeader><Form {...sistemaForm}><form onSubmit={sistemaForm.handleSubmit(handleSistemaSubmit)} className="space-y-4 py-4"><FormField control={sistemaForm.control} name="nombre" render={({ field }) => (<FormItem><FormLabel>Nombre del Sistema</FormLabel><FormControl><Input placeholder="Ej: SAP, Salesforce" {...field} /></FormControl><FormMessage /></FormItem>)} /><FormField control={sistemaForm.control} name="scope" render={({ field }) => (<FormItem><FormLabel>Ámbito del Sistema</FormLabel><Select onValueChange={(value) => { field.onChange(value); sistemaForm.setValue('scopeId', undefined); }} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione ámbito" /></SelectTrigger></FormControl><SelectContent>{sistemaScopeOptions.map(opt => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />{watchedSistemaScope === "Área" && (<FormField control={sistemaForm.control} name="scopeId" render={({ field }) => (<FormItem><FormLabel>Seleccionar Área</FormLabel><Select onValueChange={field.onChange} value={field.value || NO_SCOPE_ID_VALUE} disabled={isLoadingAreas}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione área" /></SelectTrigger></FormControl><SelectContent><SelectItem value={NO_SCOPE_ID_VALUE} disabled>Seleccione...</SelectItem>{areas.map(a => (<SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />)}{watchedSistemaScope === "Departamento" && (<FormField control={sistemaForm.control} name="scopeId" render={({ field }) => (<FormItem><FormLabel>Seleccionar Departamento</FormLabel><Select onValueChange={field.onChange} value={field.value || NO_SCOPE_ID_VALUE} disabled={isLoadingDepartamentos}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione depto." /></SelectTrigger></FormControl><SelectContent><SelectItem value={NO_SCOPE_ID_VALUE} disabled>Seleccione...</SelectItem>{departamentos.map(d => (<SelectItem key={d.id} value={d.id}>{d.nombre}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />)}{watchedSistemaScope === "Puesto" && (<FormField control={sistemaForm.control} name="scopeId" render={({ field }) => (<FormItem><FormLabel>Seleccionar Puesto</FormLabel><Select onValueChange={field.onChange} value={field.value || NO_SCOPE_ID_VALUE} disabled={isLoadingPuestos}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione puesto" /></SelectTrigger></FormControl><SelectContent><SelectItem value={NO_SCOPE_ID_VALUE} disabled>Seleccione...</SelectItem>{puestos.map(p => (<SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />}<DialogFooter><DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose><Button type="submit">{editingSistema ? 'Guardar' : 'Agregar'}</Button></DialogFooter></form></Form></DialogContent></Dialog>
                    </div>
                    {isLoadingSistemasCostos ? (<PlaceholderContent title="Cargando sistemas..." description="Por favor espere." icon={<Loader2 className="h-12 w-12 text-muted-foreground" />} isLoading />) : sistemas.length === 0 ? (<PlaceholderContent title="No hay sistemas registrados" description="Comienza agregando sistemas." icon={<Laptop className="h-12 w-12 text-muted-foreground" />} />) : (
                      <><Card><Table><TableHeader><TableRow><TableHead className="cursor-pointer hover:bg-muted/50 group" onClick={() => requestSistemaSort('nombre')}><div className="flex items-center">Nombre {getSistemaSortIcon('nombre')}</div></TableHead><TableHead className="cursor-pointer hover:bg-muted/50 group" onClick={() => requestSistemaSort('scope')}><div className="flex items-center">Ámbito {getSistemaSortIcon('scope')}</div></TableHead><TableHead className="cursor-pointer hover:bg-muted/50 group" onClick={() => requestSistemaSort('costoAnual')}><div className="flex items-center">Costo Anual {getSistemaSortIcon('costoAnual')}</div></TableHead><TableHead className="text-right w-[220px]">Acciones</TableHead></TableRow></TableHeader><TableBody>{paginatedSistemas.map((sistema) => { let scopeDisplay = sistema.scope; if (sistema.scopeId) { if (sistema.scope === "Área") scopeDisplay = `Área: ${areas.find(a => a.id === sistema.scopeId)?.nombre || 'N/A'}`; else if (sistema.scope === "Departamento") scopeDisplay = `Depto: ${departamentos.find(d => d.id === sistema.scopeId)?.nombre || 'N/A'}`; else if (sistema.scope === "Puesto") scopeDisplay = `Puesto: ${puestos.find(p => p.id === sistema.scopeId)?.nombre || 'N/A'}`; } return (<TableRow key={sistema.id}><TableCell>{sistema.nombre}</TableCell><TableCell>{scopeDisplay}</TableCell><TableCell>{getSystemAnnualCost(sistema.id, costosSistemas, sistemas)}</TableCell><TableCell className="text-right space-x-1"><Button variant="outline" size="sm" onClick={() => openManageCostsDialog(sistema)}><DollarSign className="mr-2 h-4 w-4" /> Costos</Button><Button variant="ghost" size="icon" onClick={() => handleEditSistema(sistema)} className="mr-1"><Edit2 className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => handleDeleteSistema(sistema.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></TableCell></TableRow>); })}</TableBody></Table></Card>
                      {totalSistemasPages > 1 && (<div className="flex items-center justify-end space-x-2 py-4"><span className="text-sm text-muted-foreground">Página {sistemasCurrentPage} de {totalSistemasPages} ({sortedAndFilteredSistemas.length} total)</span><Button variant="outline" size="sm" onClick={() => setSistemasCurrentPage(p => Math.max(1, p - 1))} disabled={sistemasCurrentPage === 1}>Anterior</Button><Button variant="outline" size="sm" onClick={() => setSistemasCurrentPage(p => Math.min(totalSistemasPages, p + 1))} disabled={sistemasCurrentPage === totalSistemasPages}>Siguiente</Button></div>)}</>
                    )}
                    <Dialog open={isManageCostsDialogOpen} onOpenChange={(isOpen) => { setIsManageCostsDialogOpen(isOpen); if (!isOpen) setSelectedSystemForCosts(null); }}><DialogContent className="sm:max-w-5xl"><DialogHeader><DialogTitle>Gestionar Costos para {selectedSystemForCosts?.nombre}</DialogTitle></DialogHeader><div className="py-4"><div className="flex justify-end mb-4"><Button onClick={openAddCostoDialogForSelectedSystem}><PlusCircle className="mr-2 h-4 w-4" /> Agregar Costo</Button></div>{costsForSelectedSystem.length === 0 ? (<PlaceholderContent title="No hay costos registrados" description={`Aún no se han registrado costos para ${selectedSystemForCosts?.nombre}.`} icon={<DollarSign className="h-12 w-12 text-muted-foreground" />} />) : (
                        <><Card><Table><TableHeader><TableRow><TableHead>Tipos de Costo</TableHead><TableHead className="text-right">Monto Uso</TableHead><TableHead className="text-right">Num. Lic.</TableHead><TableHead className="text-right">Costo Unit. Lic.</TableHead><TableHead className="text-right">Total Periódico</TableHead><TableHead>Frecuencia</TableHead><TableHead>Acciones</TableHead></TableRow></TableHeader><TableBody>{paginatedCostosDialog.map((costo) => {const cUso = costo.montoUso || 0; const cLic = (costo.costoPorLicencia || 0) * (costo.numeroLicencias || 0); const cTotal = cUso + cLic; return (<TableRow key={costo.id}><TableCell>{costo.tipoCosto.join(', ')}</TableCell><TableCell className="text-right">{formatCurrency(costo.montoUso, costo.moneda)}</TableCell><TableCell className="text-right">{costo.numeroLicencias ?? '-'}</TableCell><TableCell className="text-right">{formatCurrency(costo.costoPorLicencia, costo.moneda)}</TableCell><TableCell className="text-right">{formatCurrency(cTotal, costo.moneda)}</TableCell><TableCell>{costo.frecuencia}</TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => handleEditCostoSistema(costo)} className="mr-2"><Edit2 className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => handleDeleteCostoSistema(costo.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button></TableCell></TableRow>);})}</TableBody></Table></Card>
                        {totalCostosDialogPages > 1 && (<div className="flex items-center justify-end space-x-2 py-4"><span className="text-sm text-muted-foreground">Página {costosDialogCurrentPage} de {totalCostosDialogPages}</span><Button variant="outline" size="sm" onClick={() => setCostosDialogCurrentPage(p => Math.max(1, p - 1))} disabled={costosDialogCurrentPage === 1}>Anterior</Button><Button variant="outline" size="sm" onClick={() => setCostosDialogCurrentPage(p => Math.min(totalCostosDialogPages, p + 1))} disabled={costosDialogCurrentPage === totalCostosDialogPages}>Siguiente</Button></div>)}</>
                      )}</div><DialogFooter><DialogClose asChild><Button type="button" variant="outline">Cerrar</Button></DialogClose></DialogFooter></DialogContent>
                    </Dialog>
                    <Dialog open={isCostoSistemaDialogOpen} onOpenChange={(isOpen) => { setIsCostoSistemaDialogOpen(isOpen); if (!isOpen) { setEditingCostoSistema(null); costoSistemaForm.reset(); } }}><DialogContent className="sm:max-w-[620px]"><DialogHeader><DialogTitle>{editingCostoSistema ? `Editar Costo` : `Agregar Costo para ${selectedSystemForCosts?.nombre}`}</DialogTitle></DialogHeader><Form {...costoSistemaForm}><form onSubmit={costoSistemaForm.handleSubmit(handleCostoSistemaSubmit)} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2"><FormField control={costoSistemaForm.control} name="tipoCosto" render={() => (<FormItem><FormLabel>Tipo de Costo</FormLabel><div className="grid grid-cols-2 gap-4 pt-2">{tiposDeCostoOptions.map((tipo) => (<FormField key={tipo} control={costoSistemaForm.control} name="tipoCosto" render={({ field }) => (<FormItem className="flex flex-row items-center space-x-2 space-y-0 rounded-md border p-3"><FormControl><Checkbox checked={field.value?.includes(tipo)} onCheckedChange={(checked) => {field.onChange(checked ? [...(field.value || []), tipo] : (field.value || []).filter((v) => v !== tipo));}} /></FormControl><FormLabel className="font-normal text-sm">{tipo}</FormLabel></FormItem>)} />))}</div><FormMessage /></FormItem>)} />{costoSistemaForm.watch('tipoCosto')?.includes('Por Uso del Sistema') && (<FormField control={costoSistemaForm.control} name="montoUso" render={({ field }) => (<FormItem><FormLabel>Monto por Uso</FormLabel><FormControl><Input type="number" placeholder="150.00" {...field} step="0.01" value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />)}{costoSistemaForm.watch('tipoCosto')?.includes('Por Licencias') && (<div className="grid grid-cols-2 gap-4"><FormField control={costoSistemaForm.control} name="numeroLicencias" render={({ field }) => (<FormItem><FormLabel>Nº Licencias</FormLabel><FormControl><Input type="number" placeholder="10" {...field} step="1" value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} /><FormField control={costoSistemaForm.control} name="costoPorLicencia" render={({ field }) => (<FormItem><FormLabel>Costo/Licencia</FormLabel><FormControl><Input type="number" placeholder="25.00" {...field} step="0.01" value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} /></div>)}<div className="grid grid-cols-3 gap-4"><FormField control={costoSistemaForm.control} name="formaPago" render={({ field }) => (<FormItem><FormLabel>Forma de Pago</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione..." /></SelectTrigger></FormControl><SelectContent>{formasDePagoOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} /><FormField control={costoSistemaForm.control} name="frecuencia" render={({ field }) => (<FormItem><FormLabel>Frecuencia</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione..." /></SelectTrigger></FormControl><SelectContent>{frecuenciasDePagoOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} /><FormField control={costoSistemaForm.control} name="moneda" render={({ field }) => (<FormItem><FormLabel>Moneda</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione..." /></SelectTrigger></FormControl><SelectContent>{tiposDeMonedaOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} /></div><FormField control={costoSistemaForm.control} name="descripcion" render={({ field }) => (<FormItem><FormLabel>Descripción</FormLabel><FormControl><Textarea placeholder="Detalles adicionales..." {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} /><DialogFooter><DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose><Button type="submit">{editingCostoSistema ? 'Guardar' : 'Agregar'}</Button></DialogFooter></form></Form></DialogContent>
                    </Dialog>
                </CardContent>
              </Card>
            </TabsContent>

          </Tabs>
        </CardContent>
      </Card>
      
      <AlertDialog open={isConfirmDeleteDialogOpen} onOpenChange={setIsConfirmDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <div className="flex items-center">
                <AlertTriangle className="h-5 w-5 mr-2 text-destructive" />
                Confirmar Eliminación
              </div>
            </AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro de que desea eliminar "{itemToDelete?.name}"? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setItemToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={executeDelete} className={cn(buttonVariants({ variant: "destructive" }))}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
