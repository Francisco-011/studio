
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


import { Button } from '@/components/ui/button';
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
import { Settings, PlusCircle, Edit2, Trash2, Building, Users, Laptop, DollarSign, Share2, ClipboardList, Loader2, UploadCloud, Building2 } from 'lucide-react';

const NO_AREA_VALUE = "__NO_AREA__";
const NO_DEPARTAMENTO_VALUE = "__NO_DEPARTAMENTO__";
const NO_JEFE_VALUE = "__NO_JEFE__";
const NO_SCOPE_ID_VALUE = "__NO_SCOPE_ID__";

const ITEMS_PER_PAGE_CONFIG = 5; 

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
    z.number().nonnegative("El monto por uso debe ser positivo o cero.").optional()
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

  if (usoSelected && data.montoUso === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "El monto por uso es requerido si 'Por Uso del Sistema' está seleccionado.",
      path: ["montoUso"],
    });
  }

  if (licenciasSelected) {
    if (data.numeroLicencias === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El número de licencias es requerido si 'Por Licencias' está seleccionado.",
        path: ["numeroLicencias"],
      });
    }
    if (data.costoPorLicencia === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El costo por licencia es requerido si 'Por Licencias' está seleccionado.",
        path: ["costoPorLicencia"],
      });
    }
  }
});
type SistemaCostoFormData = z.infer<typeof costoSistemaFormSchema>;


interface ConfigSectionProps {
  title: string;
  icon: ReactNode;
  description: string;
  content?: ReactNode;
}

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

function getSystemAnnualCost(systemId: string, allCosts: SistemaCosto[], allSistemas: Sistema[]): string {
  const system = allSistemas.find(s => s.id === systemId);
  if (!system) return "N/A";

  const costsForSystem = allCosts.filter(cost => cost.sistemaId === systemId);
  if (costsForSystem.length === 0) return formatCurrency(0, 'USD'); 

  const displayCurrency = costsForSystem[0].moneda; 
  let totalAnnualCost = 0;

  costsForSystem.forEach(cost => {
    if (cost.moneda === displayCurrency) {
      const costFromUsage = cost.montoUso || 0;
      const costFromLicenses = (cost.costoPorLicencia || 0) * (cost.numeroLicencias || 0);
      const baseAmount = costFromUsage + costFromLicenses;

      if (cost.frecuencia === "Mensual") {
        totalAnnualCost += baseAmount * 12;
      } else if (cost.frecuencia === "Anual") {
        totalAnnualCost += baseAmount;
      }
    }
  });
  return formatCurrency(totalAnnualCost, displayCurrency);
}


export default function ConfiguracionPage() {
  const router = useRouter();
  const { areas, addArea, updateArea: updateContextArea, deleteArea: deleteContextArea, isLoading: isLoadingAreas } = useAreas();
  const { departamentos, addDepartamento, updateDepartamento: updateContextDepartamento, deleteDepartamento: deleteContextDepartamento, isLoading: isLoadingDepartamentos } = useDepartamentos();
  const { puestos, addPuesto, updatePuesto: updateContextPuesto, deletePuesto: deleteContextPuesto, isLoadingPuestos } = usePuestos();
  const { 
    sistemas, 
    costosSistemas, 
    addSistema: addContextSistema, 
    updateSistema: updateContextSistema, 
    deleteSistema: deleteContextSistema, 
    addCostoSistema: addContextCostoSistema,
    updateCostoSistema: updateContextCostoSistema,
    deleteCostoSistema: deleteContextCostoSistema,
    isLoadingSistemasCostos,
    getCostsForSystem,
  } = useSistemasCostos();


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

  const [areasCurrentPage, setAreasCurrentPage] = useState(1);
  const [departamentosCurrentPage, setDepartamentosCurrentPage] = useState(1);
  const [puestosCurrentPage, setPuestosCurrentPage] = useState(1);
  const [sistemasCurrentPage, setSistemasCurrentPage] = useState(1);
  const [costosDialogCurrentPage, setCostosDialogCurrentPage] = useState(1);


  const areaForm = useForm<AreaFormData>({
    resolver: zodResolver(areaFormSchema),
    defaultValues: { nombre: '' },
  });

  const departamentoForm = useForm<DepartamentoFormData>({
    resolver: zodResolver(departamentoFormSchema),
    defaultValues: { nombre: '', areaId: '' },
  });

  const puestoForm = useForm<PuestoFormData>({
    resolver: zodResolver(puestoFormSchema),
    defaultValues: {
      nombre: '',
      areaId: '',
      departamentoId: undefined,
      jefeInmediato: undefined,
      nivelOrganizacional: undefined,
      numeroPersonas: undefined,
    },
  });

  const sistemaForm = useForm<SistemaFormData>({
    resolver: zodResolver(sistemaFormSchema),
    defaultValues: { nombre: '', scope: "Empresa", scopeId: undefined },
  });

  const costoSistemaForm = useForm<SistemaCostoFormData>({
    resolver: zodResolver(costoSistemaFormSchema),
    defaultValues: {
      sistemaId: '',
      tipoCosto: [],
      montoUso: undefined,
      numeroLicencias: undefined,
      costoPorLicencia: undefined,
      formaPago: undefined,
      frecuencia: undefined,
      moneda: 'USD',
      descripcion: '',
    },
  });


  useEffect(() => {
    if (editingArea) areaForm.reset({ id: editingArea.id, nombre: editingArea.nombre });
    else areaForm.reset({ nombre: '' });
  }, [editingArea, areaForm]);

  useEffect(() => {
    if (editingDepartamento) departamentoForm.reset({ id: editingDepartamento.id, nombre: editingDepartamento.nombre, areaId: editingDepartamento.areaId });
    else departamentoForm.reset({ nombre: '', areaId: '' });
  }, [editingDepartamento, departamentoForm]);

  useEffect(() => {
    if (editingPuesto) {
      puestoForm.reset({
        id: editingPuesto.id,
        nombre: editingPuesto.nombre,
        areaId: editingPuesto.areaId,
        departamentoId: editingPuesto.departamentoId || NO_DEPARTAMENTO_VALUE,
        jefeInmediato: editingPuesto.jefeInmediato || NO_JEFE_VALUE,
        nivelOrganizacional: editingPuesto.nivelOrganizacional,
        numeroPersonas: editingPuesto.numeroPersonas,
      });
    } else {
      puestoForm.reset({
        nombre: '',
        areaId: '',
        departamentoId: NO_DEPARTAMENTO_VALUE,
        jefeInmediato: NO_JEFE_VALUE,
        nivelOrganizacional: undefined,
        numeroPersonas: undefined,
      });
    }
  }, [editingPuesto, puestoForm, departamentos]);

  useEffect(() => {
    if (editingSistema) {
      sistemaForm.reset({ 
        id: editingSistema.id, 
        nombre: editingSistema.nombre,
        scope: editingSistema.scope,
        scopeId: editingSistema.scope === "Empresa" ? undefined : editingSistema.scopeId,
      });
    } else {
      sistemaForm.reset({ nombre: '', scope: "Empresa", scopeId: undefined });
    }
  }, [editingSistema, sistemaForm]);


  useEffect(() => {
    if (isCostoSistemaDialogOpen) {
        if (editingCostoSistema) {
            costoSistemaForm.reset({
                id: editingCostoSistema.id,
                sistemaId: editingCostoSistema.sistemaId,
                tipoCosto: editingCostoSistema.tipoCosto,
                montoUso: editingCostoSistema.montoUso,
                numeroLicencias: editingCostoSistema.numeroLicencias,
                costoPorLicencia: editingCostoSistema.costoPorLicencia,
                formaPago: editingCostoSistema.formaPago,
                frecuencia: editingCostoSistema.frecuencia,
                moneda: editingCostoSistema.moneda,
                descripcion: editingCostoSistema.descripcion,
            });
        } else if (selectedSystemForCosts) { 
            costoSistemaForm.reset({
                sistemaId: selectedSystemForCosts.id,
                tipoCosto: [],
                montoUso: undefined,
                numeroLicencias: undefined,
                costoPorLicencia: undefined,
                formaPago: undefined,
                frecuencia: undefined,
                moneda: 'USD',
                descripcion: '',
            });
        }
    }
  }, [editingCostoSistema, isCostoSistemaDialogOpen, selectedSystemForCosts, costoSistemaForm]);


  function handleAreaSubmit(data: AreaFormData) {
    if (editingArea && editingArea.id) {
      updateContextArea(editingArea.id, data.nombre);
      toast({ title: 'Área Actualizada', description: 'El área ha sido actualizada exitosamente.' });
    } else {
      addArea(data.nombre);
      toast({ title: 'Área Agregada', description: 'El área ha sido agregada exitosamente.' });
    }
    setEditingArea(null);
    setIsAreaDialogOpen(false);
    areaForm.reset();
  }
  function handleEditArea(area: Area) {
    setEditingArea(area);
    setIsAreaDialogOpen(true);
  }
  function handleDeleteArea(areaId: string) {
    const isAreaInUseByDepto = departamentos.some(depto => depto.areaId === areaId);
    const isAreaInUseByPuesto = puestos.some(puesto => puesto.areaId === areaId);
    const isAreaInUseBySistema = sistemas.some(sistema => sistema.scope === "Área" && sistema.scopeId === areaId);
    
    if (isAreaInUseByDepto || isAreaInUseBySistema || isAreaInUseByPuesto) {
      let message = 'El área no puede ser eliminada porque está asignada a:';
      if (isAreaInUseByDepto) message += ' uno o más departamentos';
      if (isAreaInUseByPuesto) message += `${isAreaInUseByDepto ? ', ' : ''} uno o más puestos`;
      if (isAreaInUseBySistema) message += `${(isAreaInUseByDepto || isAreaInUseByPuesto) ? ' y' : ''} uno o más sistemas`;
      message += '.';
      toast({ title: 'Error al eliminar', description: message, variant: 'destructive' });
      return;
    }
    deleteContextArea(areaId);
    toast({ title: 'Área Eliminada', description: 'El área ha sido eliminada exitosamente.', variant: 'destructive' });
  }

  function handleDepartamentoSubmit(data: DepartamentoFormData) {
    if (editingDepartamento && editingDepartamento.id) {
      updateContextDepartamento(editingDepartamento.id, data.nombre, data.areaId);
      toast({ title: 'Departamento Actualizado' });
    } else {
      addDepartamento(data.nombre, data.areaId);
      toast({ title: 'Departamento Agregado' });
    }
    setEditingDepartamento(null);
    setIsDepartamentoDialogOpen(false);
    departamentoForm.reset();
  }
  function handleEditDepartamento(depto: Departamento) {
    setEditingDepartamento(depto);
    setIsDepartamentoDialogOpen(true);
  }
  function handleDeleteDepartamento(deptoId: string) {
    const isInUseByPuesto = puestos.some(p => p.departamentoId === deptoId);
    const isInUseBySistema = sistemas.some(s => s.scope === "Departamento" && s.scopeId === deptoId);
    if (isInUseByPuesto || isInUseBySistema) {
      toast({ title: 'Error al eliminar', description: 'El departamento no puede ser eliminado porque está en uso por un Puesto o Sistema.', variant: 'destructive' });
      return;
    }
    deleteContextDepartamento(deptoId);
    toast({ title: 'Departamento Eliminado', variant: 'destructive' });
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
    if (editingPuesto && editingPuesto.id) {
      updateContextPuesto(editingPuesto.id, puestoDataToSave);
      toast({ title: 'Puesto Actualizado' });
    } else {
      addPuesto(puestoDataToSave);
      toast({ title: 'Puesto Agregado' });
    }
    setEditingPuesto(null);
    setIsPuestoDialogOpen(false);
    puestoForm.reset();
  }
  function handleEditPuesto(puesto: Puesto) {
    setEditingPuesto(puesto);
    setIsPuestoDialogOpen(true);
  }
  function handleDeletePuesto(puestoId: string) {
    const isJefeInmediato = puestos.some(p => p.jefeInmediato === puestoId);
    const isPuestoInUseBySistema = sistemas.some(sistema => sistema.scope === "Puesto" && sistema.scopeId === puestoId);
    if (isJefeInmediato || isPuestoInUseBySistema) {
      let message = 'El puesto no puede ser eliminado porque:';
      if (isJefeInmediato) message += ' es Jefe Inmediato de otro puesto';
      if (isJefeInmediato && isPuestoInUseBySistema) message += ' y';
      if (isPuestoInUseBySistema) message += ' está asignado a uno o más sistemas';
      message += '.';
      toast({ title: 'Error al eliminar', description: message, variant: 'destructive' });
      return;
    }
    deleteContextPuesto(puestoId);
    toast({ title: 'Puesto Eliminado', variant: 'destructive' });
  }

 function handleSistemaSubmit(data: SistemaFormData) {
    const sistemaData: SistemaCreationData | SistemaUpdateData = {
        nombre: data.nombre,
        scope: data.scope,
        scopeId: data.scope === "Empresa" ? undefined : (data.scopeId === NO_SCOPE_ID_VALUE ? undefined : data.scopeId),
    };

    if (editingSistema && editingSistema.id) {
      updateContextSistema(editingSistema.id, sistemaData as SistemaUpdateData);
      toast({ title: 'Sistema Actualizado' });
    } else {
      const newSystem = addContextSistema(sistemaData as SistemaCreationData);
      toast({ title: 'Sistema Agregado' });
      openManageCostsDialog(newSystem); 
    }
    setEditingSistema(null);
    setIsSistemaDialogOpen(false);
    sistemaForm.reset({ nombre: '', scope: "Empresa", scopeId: undefined });
  }
  function handleEditSistema(sistema: Sistema) {
    setEditingSistema(sistema);
    setIsSistemaDialogOpen(true);
  }
  function handleDeleteSistema(sistemaId: string) {
    deleteContextSistema(sistemaId);
    toast({ title: 'Sistema Eliminado', description: 'El sistema y sus costos asociados han sido eliminados.', variant: 'destructive' });
  }

  function handleCostoSistemaSubmit(data: SistemaCostoFormData) {
    const costoDataToSave: Omit<SistemaCosto, 'id'> = {
      sistemaId: data.sistemaId,
      tipoCosto: data.tipoCosto,
      montoUso: data.tipoCosto.includes("Por Uso del Sistema") ? data.montoUso : undefined,
      numeroLicencias: data.tipoCosto.includes("Por Licencias") ? data.numeroLicencias : undefined,
      costoPorLicencia: data.tipoCosto.includes("Por Licencias") ? data.costoPorLicencia : undefined,
      formaPago: data.formaPago,
      frecuencia: data.frecuencia,
      moneda: data.moneda,
      descripcion: data.descripcion,
    };
    if (editingCostoSistema && editingCostoSistema.id) {
      updateContextCostoSistema(editingCostoSistema.id, costoDataToSave);
      toast({ title: 'Costo de Sistema Actualizado' });
    } else {
      addContextCostoSistema(costoDataToSave);
      toast({ title: 'Costo de Sistema Agregado' });
    }
    setEditingCostoSistema(null);
    setIsCostoSistemaDialogOpen(false); 
    costoSistemaForm.reset();
  }
  function handleEditCostoSistema(costo: SistemaCosto) {
    setEditingCostoSistema(costo);
    const systemForCost = sistemas.find(s => s.id === costo.sistemaId);
    if (systemForCost) setSelectedSystemForCosts(systemForCost);
    setIsCostoSistemaDialogOpen(true);
  }
  function handleDeleteCostoSistema(costoId: string) {
    deleteContextCostoSistema(costoId);
    toast({ title: 'Costo de Sistema Eliminado', variant: 'destructive' });
  }
  function openManageCostsDialog(sistema: Sistema) {
    setSelectedSystemForCosts(sistema);
    setCostosDialogCurrentPage(1); 
    setIsManageCostsDialogOpen(true);
  }
  function openAddCostoDialogForSelectedSystem() {
    if (!selectedSystemForCosts) return;
    setEditingCostoSistema(null); 
    setIsCostoSistemaDialogOpen(true);
  }

  const paginatedAreas = useMemo(() => areas.slice((areasCurrentPage - 1) * ITEMS_PER_PAGE_CONFIG, areasCurrentPage * ITEMS_PER_PAGE_CONFIG), [areas, areasCurrentPage]);
  const totalAreasPages = Math.ceil(areas.length / ITEMS_PER_PAGE_CONFIG);
  
  const paginatedDepartamentos = useMemo(() => departamentos.slice((departamentosCurrentPage - 1) * ITEMS_PER_PAGE_CONFIG, departamentosCurrentPage * ITEMS_PER_PAGE_CONFIG), [departamentos, departamentosCurrentPage]);
  const totalDepartamentosPages = Math.ceil(departamentos.length / ITEMS_PER_PAGE_CONFIG);

  const paginatedPuestos = useMemo(() => puestos.slice((puestosCurrentPage - 1) * ITEMS_PER_PAGE_CONFIG, puestosCurrentPage * ITEMS_PER_PAGE_CONFIG), [puestos, puestosCurrentPage]);
  const totalPuestosPages = Math.ceil(puestos.length / ITEMS_PER_PAGE_CONFIG);

  const paginatedSistemas = useMemo(() => sistemas.slice((sistemasCurrentPage - 1) * ITEMS_PER_PAGE_CONFIG, sistemasCurrentPage * ITEMS_PER_PAGE_CONFIG), [sistemas, sistemasCurrentPage]);
  const totalSistemasPages = Math.ceil(sistemas.length / ITEMS_PER_PAGE_CONFIG);

  const costsForSelectedSystem = useMemo(() => selectedSystemForCosts ? getCostsForSystem(selectedSystemForCosts.id) : [], [selectedSystemForCosts, getCostsForSystem]);

  const paginatedCostosDialog = useMemo(() => costsForSelectedSystem.slice((costosDialogCurrentPage - 1) * ITEMS_PER_PAGE_CONFIG, costosDialogCurrentPage * ITEMS_PER_PAGE_CONFIG), [costsForSelectedSystem, costosDialogCurrentPage]);
  const totalCostosDialogPages = Math.ceil(costsForSelectedSystem.length / ITEMS_PER_PAGE_CONFIG);
  
  const watchedSistemaScope = sistemaForm.watch('scope');
  const watchedPuestoAreaId = puestoForm.watch('areaId');
  const filteredDepartamentosForPuestoForm = useMemo(() => watchedPuestoAreaId ? departamentos.filter(d => d.areaId === watchedPuestoAreaId) : [], [watchedPuestoAreaId, departamentos]);
  

  const configSections: Array<{ value: string; label: string; icon: ReactNode; fullDescription: string; content: ReactNode; }> = [
    { value: 'areas', label: 'Áreas', icon: <Building className="h-5 w-5 mr-2" />, fullDescription: 'Administrar las áreas o divisiones principales de la empresa.', content: <div>...</div> },
    { value: 'departamentos', label: 'Departamentos', icon: <Building2 className="h-5 w-5 mr-2" />, fullDescription: 'Administrar los departamentos dentro de cada área.', content: <div>...</div> },
    { value: 'puestos', label: 'Puestos', icon: <Users className="h-5 w-5 mr-2" />, fullDescription: 'Administrar los roles o puestos de trabajo, asignándolos a un departamento.', content: <div>...</div> },
    { value: 'sistemas', label: 'Sistemas y Costos', icon: <Laptop className="h-5 w-5 mr-2" />, fullDescription: 'Mantener el inventario de sistemas tecnológicos y sus costos asociados.', content: <div>...</div> },
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
            
            {/* AREAS TAB */}
            <TabsContent value="areas">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center"><Building className="h-5 w-5 mr-2" /> Áreas</CardTitle>
                    <p className="text-sm text-muted-foreground">{configSections.find(s=>s.value==='areas')?.fullDescription}</p>
                  </CardHeader>
                  <CardContent>
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-semibold">Gestión de Áreas</h3>
                        <Dialog open={isAreaDialogOpen} onOpenChange={(isOpen) => { setIsAreaDialogOpen(isOpen); if (!isOpen) setEditingArea(null); }}>
                          <DialogTrigger asChild><Button onClick={() => { setEditingArea(null); areaForm.reset(); }}><PlusCircle className="mr-2 h-4 w-4" /> Agregar Área</Button></DialogTrigger>
                          <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader><DialogTitle>{editingArea ? 'Editar Área' : 'Agregar Nueva Área'}</DialogTitle></DialogHeader>
                            <Form {...areaForm}><form onSubmit={areaForm.handleSubmit(handleAreaSubmit)} className="space-y-4 py-4"><FormField control={areaForm.control} name="nombre" render={({ field }) => (<FormItem><FormLabel>Nombre del Área</FormLabel><FormControl><Input placeholder="Ej: Finanzas, Operaciones" {...field} /></FormControl><FormMessage /></FormItem>)} /><DialogFooter><DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose><Button type="submit">{editingArea ? 'Guardar Cambios' : 'Agregar Área'}</Button></DialogFooter></form></Form>
                          </DialogContent>
                        </Dialog>
                      </div>
                      {isLoadingAreas ? (<PlaceholderContent title="Cargando áreas..." description="Por favor espere." icon={<Loader2 className="h-12 w-12 text-muted-foreground" />} isLoading />) : areas.length === 0 ? (<PlaceholderContent title="No hay áreas registradas" description="Comienza agregando áreas para organizar tu empresa." icon={<Building className="h-12 w-12 text-muted-foreground" />} />) : (
                        <><Card><Table><TableHeader><TableRow><TableHead>Nombre del Área</TableHead><TableHead className="text-right w-[120px]">Acciones</TableHead></TableRow></TableHeader><TableBody>{paginatedAreas.map((area) => (<TableRow key={area.id}><TableCell>{area.nombre}</TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => handleEditArea(area)} className="mr-2"><Edit2 className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => handleDeleteArea(area.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></TableCell></TableRow>))}</TableBody></Table></Card>
                        {totalAreasPages > 1 && (<div className="flex items-center justify-end space-x-2 py-4"><span className="text-sm text-muted-foreground">Página {areasCurrentPage} de {totalAreasPages}</span><Button variant="outline" size="sm" onClick={() => setAreasCurrentPage(p => Math.max(1, p - 1))} disabled={areasCurrentPage === 1}>Anterior</Button><Button variant="outline" size="sm" onClick={() => setAreasCurrentPage(p => Math.min(totalAreasPages, p + 1))} disabled={areasCurrentPage === totalAreasPages}>Siguiente</Button></div>)}</>
                      )}
                    </div>
                  </CardContent>
                </Card>
            </TabsContent>

            {/* DEPARTAMENTOS TAB */}
            <TabsContent value="departamentos">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center"><Building2 className="h-5 w-5 mr-2" /> Departamentos</CardTitle>
                    <p className="text-sm text-muted-foreground">{configSections.find(s=>s.value==='departamentos')?.fullDescription}</p>
                  </CardHeader>
                  <CardContent>
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-semibold">Gestión de Departamentos</h3>
                        <Dialog open={isDepartamentoDialogOpen} onOpenChange={(isOpen) => { setIsDepartamentoDialogOpen(isOpen); if (!isOpen) setEditingDepartamento(null); }}>
                          <DialogTrigger asChild><Button onClick={() => { setEditingDepartamento(null); departamentoForm.reset(); }}><PlusCircle className="mr-2 h-4 w-4" /> Agregar Departamento</Button></DialogTrigger>
                          <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader><DialogTitle>{editingDepartamento ? 'Editar Departamento' : 'Agregar Nuevo Departamento'}</DialogTitle></DialogHeader>
                            <Form {...departamentoForm}><form onSubmit={departamentoForm.handleSubmit(handleDepartamentoSubmit)} className="space-y-4 py-4">
                              <FormField control={departamentoForm.control} name="nombre" render={({ field }) => (<FormItem><FormLabel>Nombre del Departamento</FormLabel><FormControl><Input placeholder="Ej: Contabilidad, Tesorería" {...field} /></FormControl><FormMessage /></FormItem>)} />
                              <FormField control={departamentoForm.control} name="areaId" render={({ field }) => (<FormItem><FormLabel>Área a la que pertenece</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={isLoadingAreas}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione un área" /></SelectTrigger></FormControl><SelectContent>{areas.map(a => <SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                              <DialogFooter><DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose><Button type="submit">{editingDepartamento ? 'Guardar Cambios' : 'Agregar'}</Button></DialogFooter>
                            </form></Form>
                          </DialogContent>
                        </Dialog>
                      </div>
                      {isLoadingDepartamentos ? (<PlaceholderContent title="Cargando departamentos..." description="Por favor espere." icon={<Loader2 className="h-12 w-12 text-muted-foreground" />} isLoading />) : departamentos.length === 0 ? (<PlaceholderContent title="No hay departamentos registrados" description="Comienza agregando departamentos dentro de las áreas." icon={<Building2 className="h-12 w-12 text-muted-foreground" />} />) : (
                        <><Card><Table><TableHeader><TableRow><TableHead>Nombre Departamento</TableHead><TableHead>Área</TableHead><TableHead className="text-right w-[120px]">Acciones</TableHead></TableRow></TableHeader><TableBody>{paginatedDepartamentos.map((depto) => (<TableRow key={depto.id}><TableCell>{depto.nombre}</TableCell><TableCell>{areas.find(a => a.id === depto.areaId)?.nombre || 'N/A'}</TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => handleEditDepartamento(depto)} className="mr-2"><Edit2 className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => handleDeleteDepartamento(depto.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></TableCell></TableRow>))}</TableBody></Table></Card>
                        {totalDepartamentosPages > 1 && (<div className="flex items-center justify-end space-x-2 py-4"><span className="text-sm text-muted-foreground">Página {departamentosCurrentPage} de {totalDepartamentosPages}</span><Button variant="outline" size="sm" onClick={() => setDepartamentosCurrentPage(p => Math.max(1, p - 1))} disabled={departamentosCurrentPage === 1}>Anterior</Button><Button variant="outline" size="sm" onClick={() => setDepartamentosCurrentPage(p => Math.min(totalDepartamentosPages, p + 1))} disabled={departamentosCurrentPage === totalDepartamentosPages}>Siguiente</Button></div>)}</>
                      )}
                    </div>
                  </CardContent>
                </Card>
            </TabsContent>

            {/* PUESTOS TAB */}
            <TabsContent value="puestos">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center"><Users className="h-5 w-5 mr-2" /> Puestos</CardTitle>
                  <p className="text-sm text-muted-foreground">{configSections.find(s=>s.value==='puestos')?.fullDescription}</p>
                </CardHeader>
                <CardContent>
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-semibold">Gestión de Puestos</h3>
                      <Dialog open={isPuestoDialogOpen} onOpenChange={(isOpen) => { setIsPuestoDialogOpen(isOpen); if (!isOpen) setEditingPuesto(null); }}>
                        <DialogTrigger asChild><Button onClick={() => { setEditingPuesto(null); puestoForm.reset(); }}><PlusCircle className="mr-2 h-4 w-4" /> Agregar Puesto</Button></DialogTrigger>
                        <DialogContent className="sm:max-w-[525px]">
                          <DialogHeader><DialogTitle>{editingPuesto ? 'Editar Puesto' : 'Agregar Nuevo Puesto'}</DialogTitle></DialogHeader>
                          <Form {...puestoForm}><form onSubmit={puestoForm.handleSubmit(handlePuestoSubmit)} className="space-y-4 py-4">
                            <FormField control={puestoForm.control} name="nombre" render={({ field }) => (<FormItem><FormLabel>Nombre del Puesto</FormLabel><FormControl><Input placeholder="Ej: Analista Financiero" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={puestoForm.control} name="areaId" render={({ field }) => (<FormItem><FormLabel>Área</FormLabel><Select onValueChange={(value) => { field.onChange(value); puestoForm.setValue('departamentoId', NO_DEPARTAMENTO_VALUE); }} value={field.value} disabled={isLoadingAreas}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione un área" /></SelectTrigger></FormControl><SelectContent>{areas.map(a => <SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                            <FormField control={puestoForm.control} name="departamentoId" render={({ field }) => (<FormItem><FormLabel>Departamento (Opcional)</FormLabel><Select onValueChange={field.onChange} value={field.value || NO_DEPARTAMENTO_VALUE} disabled={!watchedPuestoAreaId || isLoadingDepartamentos}><FormControl><SelectTrigger><SelectValue placeholder={!watchedPuestoAreaId ? "Seleccione un área primero" : "Seleccione depto..."} /></SelectTrigger></FormControl><SelectContent><SelectItem value={NO_DEPARTAMENTO_VALUE}>Nivel de Área / Sin Depto.</SelectItem>{filteredDepartamentosForPuestoForm.map(d => <SelectItem key={d.id} value={d.id}>{d.nombre}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                            <FormField control={puestoForm.control} name="jefeInmediato" render={({ field }) => (<FormItem><FormLabel>Jefe Inmediato (Opcional)</FormLabel><Select onValueChange={field.onChange} value={field.value || NO_JEFE_VALUE} disabled={isLoadingPuestos}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione un jefe" /></SelectTrigger></FormControl><SelectContent><SelectItem value={NO_JEFE_VALUE}>Sin Jefe</SelectItem>{puestos.filter(p => !editingPuesto || p.id !== editingPuesto.id).map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                            <div className="grid grid-cols-2 gap-4"><FormField control={puestoForm.control} name="nivelOrganizacional" render={({ field }) => (<FormItem><FormLabel>Nivel</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione" /></SelectTrigger></FormControl><SelectContent>{nivelesOrganizacionales.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} /><FormField control={puestoForm.control} name="numeroPersonas" render={({ field }) => (<FormItem><FormLabel>Nº Personas</FormLabel><FormControl><Input type="number" placeholder="Ej: 5" {...field} value={field.value ?? ''} min="0" /></FormControl><FormMessage /></FormItem>)} /></div>
                            <DialogFooter><DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose><Button type="submit">{editingPuesto ? 'Guardar Cambios' : 'Agregar'}</Button></DialogFooter>
                          </form></Form>
                        </DialogContent>
                      </Dialog>
                    </div>
                    {isLoadingPuestos ? (<PlaceholderContent title="Cargando puestos..." description="Por favor espere." icon={<Loader2 className="h-12 w-12 text-muted-foreground" />} isLoading />) : puestos.length === 0 ? (<PlaceholderContent title="No hay puestos registrados" description="Comienza agregando puestos para definir la estructura de roles." icon={<Users className="h-12 w-12 text-muted-foreground" />} />) : (
                      <><Card><Table><TableHeader><TableRow><TableHead>Nombre del Puesto</TableHead><TableHead>Departamento</TableHead><TableHead>Área</TableHead><TableHead>Jefe Inmediato</TableHead><TableHead className="text-right w-[120px]">Acciones</TableHead></TableRow></TableHeader><TableBody>{paginatedPuestos.map((puesto) => {const depto = departamentos.find(d => d.id === puesto.departamentoId); const area = areas.find(a => a.id === puesto.areaId); const jefe = puestos.find(p => p.id === puesto.jefeInmediato); return (<TableRow key={puesto.id}><TableCell>{puesto.nombre}</TableCell><TableCell>{depto?.nombre || '-'}</TableCell><TableCell>{area?.nombre || 'N/A'}</TableCell><TableCell>{jefe?.nombre || '-'}</TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => handleEditPuesto(puesto)} className="mr-2"><Edit2 className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => handleDeletePuesto(puesto.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></TableCell></TableRow>);})}</TableBody></Table></Card>
                      {totalPuestosPages > 1 && (<div className="flex items-center justify-end space-x-2 py-4"><span className="text-sm text-muted-foreground">Página {puestosCurrentPage} de {totalPuestosPages}</span><Button variant="outline" size="sm" onClick={() => setPuestosCurrentPage(p => Math.max(1, p - 1))} disabled={puestosCurrentPage === 1}>Anterior</Button><Button variant="outline" size="sm" onClick={() => setPuestosCurrentPage(p => Math.min(totalPuestosPages, p + 1))} disabled={puestosCurrentPage === totalPuestosPages}>Siguiente</Button></div>)}</>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* SISTEMAS TAB */}
            <TabsContent value="sistemas">
               <Card>
                <CardHeader>
                  <CardTitle className="flex items-center"><Laptop className="h-5 w-5 mr-2" /> Sistemas y Costos</CardTitle>
                  <p className="text-sm text-muted-foreground">{configSections.find(s=>s.value==='sistemas')?.fullDescription}</p>
                </CardHeader>
                <CardContent>
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-semibold">Gestión de Sistemas</h3>
                      <Dialog open={isSistemaDialogOpen} onOpenChange={(isOpen) => { setIsSistemaDialogOpen(isOpen); if (!isOpen) setEditingSistema(null); }}>
                        <DialogTrigger asChild><Button onClick={() => { setEditingSistema(null); sistemaForm.reset(); }}><PlusCircle className="mr-2 h-4 w-4" /> Agregar Sistema</Button></DialogTrigger>
                        <DialogContent className="sm:max-w-[480px]">
                          <DialogHeader><DialogTitle>{editingSistema ? 'Editar Sistema' : 'Agregar Nuevo Sistema'}</DialogTitle></DialogHeader>
                          <Form {...sistemaForm}><form onSubmit={sistemaForm.handleSubmit(handleSistemaSubmit)} className="space-y-4 py-4">
                            <FormField control={sistemaForm.control} name="nombre" render={({ field }) => (<FormItem><FormLabel>Nombre del Sistema</FormLabel><FormControl><Input placeholder="Ej: SAP, Salesforce" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={sistemaForm.control} name="scope" render={({ field }) => (<FormItem><FormLabel>Ámbito del Sistema</FormLabel><Select onValueChange={(value) => { field.onChange(value); sistemaForm.setValue('scopeId', undefined); }} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione ámbito" /></SelectTrigger></FormControl><SelectContent>{sistemaScopeOptions.map(opt => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
                            {watchedSistemaScope === "Área" && (<FormField control={sistemaForm.control} name="scopeId" render={({ field }) => (<FormItem><FormLabel>Seleccionar Área</FormLabel><Select onValueChange={field.onChange} value={field.value || NO_SCOPE_ID_VALUE} disabled={isLoadingAreas}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione área" /></SelectTrigger></FormControl><SelectContent><SelectItem value={NO_SCOPE_ID_VALUE} disabled>Seleccione...</SelectItem>{areas.map(a => (<SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />)}
                            {watchedSistemaScope === "Departamento" && (<FormField control={sistemaForm.control} name="scopeId" render={({ field }) => (<FormItem><FormLabel>Seleccionar Departamento</FormLabel><Select onValueChange={field.onChange} value={field.value || NO_SCOPE_ID_VALUE} disabled={isLoadingDepartamentos}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione depto." /></SelectTrigger></FormControl><SelectContent><SelectItem value={NO_SCOPE_ID_VALUE} disabled>Seleccione...</SelectItem>{departamentos.map(d => (<SelectItem key={d.id} value={d.id}>{d.nombre}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />)}
                            {watchedSistemaScope === "Puesto" && (<FormField control={sistemaForm.control} name="scopeId" render={({ field }) => (<FormItem><FormLabel>Seleccionar Puesto</FormLabel><Select onValueChange={field.onChange} value={field.value || NO_SCOPE_ID_VALUE} disabled={isLoadingPuestos}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione puesto" /></SelectTrigger></FormControl><SelectContent><SelectItem value={NO_SCOPE_ID_VALUE} disabled>Seleccione...</SelectItem>{puestos.map(p => (<SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />)}
                            <DialogFooter><DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose><Button type="submit">{editingSistema ? 'Guardar' : 'Agregar'}</Button></DialogFooter>
                          </form></Form>
                        </DialogContent>
                      </Dialog>
                    </div>
                    {isLoadingSistemasCostos ? (<PlaceholderContent title="Cargando sistemas..." description="Por favor espere." icon={<Loader2 className="h-12 w-12 text-muted-foreground" />} isLoading />) : sistemas.length === 0 ? (<PlaceholderContent title="No hay sistemas registrados" description="Comienza agregando sistemas." icon={<Laptop className="h-12 w-12 text-muted-foreground" />} />) : (
                      <><Card><Table><TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Ámbito</TableHead><TableHead>Costo Anual</TableHead><TableHead className="text-right w-[220px]">Acciones</TableHead></TableRow></TableHeader><TableBody>{paginatedSistemas.map((sistema) => {
                        let scopeDisplay = sistema.scope;
                        if (sistema.scopeId) {
                          if (sistema.scope === "Área") scopeDisplay = `Área: ${areas.find(a => a.id === sistema.scopeId)?.nombre || 'N/A'}`;
                          else if (sistema.scope === "Departamento") scopeDisplay = `Depto: ${departamentos.find(d => d.id === sistema.scopeId)?.nombre || 'N/A'}`;
                          else if (sistema.scope === "Puesto") scopeDisplay = `Puesto: ${puestos.find(p => p.id === sistema.scopeId)?.nombre || 'N/A'}`;
                        }
                        return (<TableRow key={sistema.id}><TableCell>{sistema.nombre}</TableCell><TableCell>{scopeDisplay}</TableCell><TableCell>{getSystemAnnualCost(sistema.id, costosSistemas, sistemas)}</TableCell><TableCell className="text-right space-x-1"><Button variant="outline" size="sm" onClick={() => openManageCostsDialog(sistema)}><DollarSign className="mr-2 h-4 w-4" /> Costos</Button><Button variant="ghost" size="icon" onClick={() => handleEditSistema(sistema)} className="mr-1"><Edit2 className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => handleDeleteSistema(sistema.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></TableCell></TableRow>);
                      })}</TableBody></Table></Card>
                      {totalSistemasPages > 1 && (<div className="flex items-center justify-end space-x-2 py-4"><span className="text-sm text-muted-foreground">Página {sistemasCurrentPage} de {totalSistemasPages}</span><Button variant="outline" size="sm" onClick={() => setSistemasCurrentPage(p => Math.max(1, p - 1))} disabled={sistemasCurrentPage === 1}>Anterior</Button><Button variant="outline" size="sm" onClick={() => setSistemasCurrentPage(p => Math.min(totalSistemasPages, p + 1))} disabled={sistemasCurrentPage === totalSistemasPages}>Siguiente</Button></div>)}</>
                    )}
                    <Dialog open={isManageCostsDialogOpen} onOpenChange={(isOpen) => { setIsManageCostsDialogOpen(isOpen); if (!isOpen) setSelectedSystemForCosts(null); }}>
                      <DialogContent className="sm:max-w-5xl"><DialogHeader><DialogTitle>Gestionar Costos para {selectedSystemForCosts?.nombre}</DialogTitle></DialogHeader><div className="py-4"><div className="flex justify-end mb-4"><Button onClick={openAddCostoDialogForSelectedSystem}><PlusCircle className="mr-2 h-4 w-4" /> Agregar Costo</Button></div>{costsForSelectedSystem.length === 0 ? (<PlaceholderContent title="No hay costos registrados" description={`Aún no se han registrado costos para ${selectedSystemForCosts?.nombre}.`} icon={<DollarSign className="h-12 w-12 text-muted-foreground" />} />) : (
                        <><Card><Table><TableHeader><TableRow><TableHead>Tipos de Costo</TableHead><TableHead className="text-right">Monto Uso</TableHead><TableHead className="text-right">Num. Lic.</TableHead><TableHead className="text-right">Costo Unit. Lic.</TableHead><TableHead className="text-right">Total Periódico</TableHead><TableHead>Frecuencia</TableHead><TableHead>Acciones</TableHead></TableRow></TableHeader><TableBody>{paginatedCostosDialog.map((costo) => {const cUso = costo.montoUso || 0; const cLic = (costo.costoPorLicencia || 0) * (costo.numeroLicencias || 0); const cTotal = cUso + cLic; return (<TableRow key={costo.id}><TableCell>{costo.tipoCosto.join(', ')}</TableCell><TableCell className="text-right">{formatCurrency(costo.montoUso, costo.moneda)}</TableCell><TableCell className="text-right">{costo.numeroLicencias ?? '-'}</TableCell><TableCell className="text-right">{formatCurrency(costo.costoPorLicencia, costo.moneda)}</TableCell><TableCell className="text-right">{formatCurrency(cTotal, costo.moneda)}</TableCell><TableCell>{costo.frecuencia}</TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => handleEditCostoSistema(costo)} className="mr-2"><Edit2 className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => handleDeleteCostoSistema(costo.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button></TableCell></TableRow>);})}</TableBody></Table></Card>
                        {totalCostosDialogPages > 1 && (<div className="flex items-center justify-end space-x-2 py-4"><span className="text-sm text-muted-foreground">Página {costosDialogCurrentPage} de {totalCostosDialogPages}</span><Button variant="outline" size="sm" onClick={() => setCostosDialogCurrentPage(p => Math.max(1, p - 1))} disabled={costosDialogCurrentPage === 1}>Anterior</Button><Button variant="outline" size="sm" onClick={() => setCostosDialogCurrentPage(p => Math.min(totalCostosDialogPages, p + 1))} disabled={costosDialogCurrentPage === totalCostosDialogPages}>Siguiente</Button></div>)}</>
                      )}</div><DialogFooter><DialogClose asChild><Button type="button" variant="outline">Cerrar</Button></DialogClose></DialogFooter></DialogContent>
                    </Dialog>
                    <Dialog open={isCostoSistemaDialogOpen} onOpenChange={(isOpen) => { setIsCostoSistemaDialogOpen(isOpen); if (!isOpen) { setEditingCostoSistema(null); costoSistemaForm.reset(); } }}>
                      <DialogContent className="sm:max-w-[620px]"><DialogHeader><DialogTitle>{editingCostoSistema ? `Editar Costo` : `Agregar Costo para ${selectedSystemForCosts?.nombre}`}</DialogTitle></DialogHeader><Form {...costoSistemaForm}><form onSubmit={costoSistemaForm.handleSubmit(handleCostoSistemaSubmit)} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
                        <FormField control={costoSistemaForm.control} name="tipoCosto" render={() => (<FormItem><FormLabel>Tipo de Costo</FormLabel><div className="grid grid-cols-2 gap-4 pt-2">{tiposDeCostoOptions.map((tipo) => (<FormField key={tipo} control={costoSistemaForm.control} name="tipoCosto" render={({ field }) => (<FormItem className="flex flex-row items-center space-x-2 space-y-0 rounded-md border p-3"><FormControl><Checkbox checked={field.value?.includes(tipo)} onCheckedChange={(checked) => {field.onChange(checked ? [...(field.value || []), tipo] : (field.value || []).filter((v) => v !== tipo));}} /></FormControl><FormLabel className="font-normal text-sm">{tipo}</FormLabel></FormItem>)} />))}</div><FormMessage /></FormItem>)} />
                        {costoSistemaForm.watch('tipoCosto')?.includes('Por Uso del Sistema') && (<FormField control={costoSistemaForm.control} name="montoUso" render={({ field }) => (<FormItem><FormLabel>Monto por Uso</FormLabel><FormControl><Input type="number" placeholder="150.00" {...field} step="0.01" value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />)}
                        {costoSistemaForm.watch('tipoCosto')?.includes('Por Licencias') && (<div className="grid grid-cols-2 gap-4"><FormField control={costoSistemaForm.control} name="numeroLicencias" render={({ field }) => (<FormItem><FormLabel>Nº Licencias</FormLabel><FormControl><Input type="number" placeholder="10" {...field} step="1" value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} /><FormField control={costoSistemaForm.control} name="costoPorLicencia" render={({ field }) => (<FormItem><FormLabel>Costo/Licencia</FormLabel><FormControl><Input type="number" placeholder="25.00" {...field} step="0.01" value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} /></div>)}
                        <div className="grid grid-cols-3 gap-4"><FormField control={costoSistemaForm.control} name="formaPago" render={({ field }) => (<FormItem><FormLabel>Forma de Pago</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione..." /></SelectTrigger></FormControl><SelectContent>{formasDePagoOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} /><FormField control={costoSistemaForm.control} name="frecuencia" render={({ field }) => (<FormItem><FormLabel>Frecuencia</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione..." /></SelectTrigger></FormControl><SelectContent>{frecuenciasDePagoOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} /><FormField control={costoSistemaForm.control} name="moneda" render={({ field }) => (<FormItem><FormLabel>Moneda</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione..." /></SelectTrigger></FormControl><SelectContent>{tiposDeMonedaOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} /></div>
                        <FormField control={costoSistemaForm.control} name="descripcion" render={({ field }) => (<FormItem><FormLabel>Descripción</FormLabel><FormControl><Textarea placeholder="Detalles adicionales..." {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                        <DialogFooter><DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose><Button type="submit">{editingCostoSistema ? 'Guardar' : 'Agregar'}</Button></DialogFooter>
                      </form></Form></DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
