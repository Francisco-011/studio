
'use client';

import * as React from 'react'; 
import { useState, useEffect, type ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useAreas, type Area } from '@/contexts/AreasContext';
import { usePuestos, type Puesto, type NivelOrganizacional, nivelesOrganizacionales, type PuestoCreationData } from '@/contexts/PuestosContext';
import { useFuentesDestinos, type FuenteDestino } from '@/contexts/FuentesDestinosContext';


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
import { Settings, PlusCircle, Edit2, Trash2, Building, Users, Laptop, DollarSign, Share2, ClipboardList } from 'lucide-react';

const NO_AREA_VALUE = "__NO_AREA__";
const NO_JEFE_VALUE = "__NO_JEFE__";


interface Sistema {
  id: string;
  nombre: string;
}

const tiposDeCostoOptions = ["Por Uso del Sistema", "Por Licencias"] as const;
type TipoCosto = typeof tiposDeCostoOptions[number];

const formasDePagoOptions = ["Transferencia", "Efectivo", "Tarjeta", "Otros"] as const;
type FormaPago = typeof formasDePagoOptions[number];

const frecuenciasDePagoOptions = ["Mensual", "Anual", "Otro"] as const;
type FrecuenciaPago = typeof frecuenciasDePagoOptions[number];

const tiposDeMonedaOptions = ["MXN", "USD", "EUR", "CAD", "GBP"] as const;
type TipoMoneda = typeof tiposDeMonedaOptions[number];

interface SistemaCosto {
  id: string;
  sistemaId: string;
  tipoCosto: TipoCosto[];
  montoUso?: number;
  numeroLicencias?: number;
  costoPorLicencia?: number;
  formaPago: FormaPago;
  frecuencia: FrecuenciaPago;
  moneda: TipoMoneda;
  descripcion?: string;
}

// Zod schemas
const areaFormSchema = z.object({
  id: z.string().optional(),
  nombre: z.string().min(1, 'El nombre del área es requerido.'),
});
type AreaFormData = z.infer<typeof areaFormSchema>;

const puestoFormSchema = z.object({
  id: z.string().optional(),
  nombre: z.string().min(1, 'El nombre del puesto es requerido.'),
  areaId: z.string().optional().or(z.literal(NO_AREA_VALUE).transform(() => undefined)),
  jefeInmediato: z.string().optional().or(z.literal(NO_JEFE_VALUE).transform(() => undefined)),
  nivelOrganizacional: z.enum(nivelesOrganizacionales, {
    errorMap: () => ({ message: "Debe seleccionar un nivel organizacional válido." }),
  }),
});
type PuestoFormData = z.infer<typeof puestoFormSchema>;

const sistemaFormSchema = z.object({
  id: z.string().optional(),
  nombre: z.string().min(1, 'El nombre del sistema es requerido.'),
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

const fuenteDestinoFormSchema = z.object({
  id: z.string().optional(),
  nombre: z.string().min(1, 'El nombre es requerido.'),
});
type FuenteDestinoFormData = z.infer<typeof fuenteDestinoFormSchema>;


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

const LOCAL_STORAGE_SISTEMAS_KEY = 'proceza-sistemas';
const LOCAL_STORAGE_COSTOS_SISTEMAS_KEY = 'proceza-costos-sistemas';

export default function ConfiguracionPage() {
  const { areas, addArea, updateArea: updateContextArea, deleteArea: deleteContextArea, isLoading: isLoadingAreas } = useAreas();
  const { puestos, addPuesto, updatePuesto: updateContextPuesto, deletePuesto: deleteContextPuesto, isLoadingPuestos } = usePuestos();
  const { fuentesDestinos, addFuenteDestino, updateFuenteDestino: updateContextFuenteDestino, deleteFuenteDestino: deleteContextFuenteDestino, isLoadingFuentesDestinos } = useFuentesDestinos();


  const [isAreaDialogOpen, setIsAreaDialogOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  
  const [isPuestoDialogOpen, setIsPuestoDialogOpen] = useState(false);
  const [editingPuesto, setEditingPuesto] = useState<Puesto | null>(null);

  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [isSistemaDialogOpen, setIsSistemaDialogOpen] = useState(false);
  const [editingSistema, setEditingSistema] = useState<Sistema | null>(null);

  const [costosSistemas, setCostosSistemas] = useState<SistemaCosto[]>([]);
  const [isCostoSistemaDialogOpen, setIsCostoSistemaDialogOpen] = useState(false);
  const [editingCostoSistema, setEditingCostoSistema] = useState<SistemaCosto | null>(null);
  const [selectedSystemForCosts, setSelectedSystemForCosts] = useState<Sistema | null>(null);
  const [isManageCostsDialogOpen, setIsManageCostsDialogOpen] = useState(false);

  const [isFuenteDestinoDialogOpen, setIsFuenteDestinoDialogOpen] = useState(false);
  const [editingFuenteDestino, setEditingFuenteDestino] = useState<FuenteDestino | null>(null);

  // Load sistemas from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedSistemas = localStorage.getItem(LOCAL_STORAGE_SISTEMAS_KEY);
        if (savedSistemas) {
          setSistemas(JSON.parse(savedSistemas));
        }
      } catch (error) {
        console.error("Failed to load sistemas from localStorage", error);
        setSistemas([]);
      }
    }
  }, []);

  // Save sistemas to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(LOCAL_STORAGE_SISTEMAS_KEY, JSON.stringify(sistemas));
      } catch (error) {
        console.error("Failed to save sistemas to localStorage", error);
      }
    }
  }, [sistemas]);

  // Load costosSistemas from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedCostosSistemas = localStorage.getItem(LOCAL_STORAGE_COSTOS_SISTEMAS_KEY);
        if (savedCostosSistemas) {
          setCostosSistemas(JSON.parse(savedCostosSistemas));
        }
      } catch (error) {
        console.error("Failed to load costosSistemas from localStorage", error);
        setCostosSistemas([]);
      }
    }
  }, []);

  // Save costosSistemas to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(LOCAL_STORAGE_COSTOS_SISTEMAS_KEY, JSON.stringify(costosSistemas));
      } catch (error) {
        console.error("Failed to save costosSistemas to localStorage", error);
      }
    }
  }, [costosSistemas]);


  const areaForm = useForm<AreaFormData>({
    resolver: zodResolver(areaFormSchema),
    defaultValues: {
      nombre: '',
    },
  });

  const puestoForm = useForm<PuestoFormData>({
    resolver: zodResolver(puestoFormSchema),
    defaultValues: {
      nombre: '',
      areaId: undefined,
      jefeInmediato: undefined,
      nivelOrganizacional: undefined,
    },
  });

  const sistemaForm = useForm<SistemaFormData>({
    resolver: zodResolver(sistemaFormSchema),
    defaultValues: {
      nombre: '',
    },
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

  const fuenteDestinoForm = useForm<FuenteDestinoFormData>({
    resolver: zodResolver(fuenteDestinoFormSchema),
    defaultValues: {
      nombre: '',
    },
  });

  useEffect(() => {
    if (editingArea) {
      areaForm.reset({ id: editingArea.id, nombre: editingArea.nombre });
    } else {
      areaForm.reset({ nombre: '' });
    }
  }, [editingArea, areaForm]);

  useEffect(() => {
    if (editingPuesto) {
      puestoForm.reset({
        id: editingPuesto.id,
        nombre: editingPuesto.nombre,
        areaId: editingPuesto.areaId || NO_AREA_VALUE,
        jefeInmediato: editingPuesto.jefeInmediato || NO_JEFE_VALUE,
        nivelOrganizacional: editingPuesto.nivelOrganizacional,
      });
    } else {
      puestoForm.reset({
        nombre: '',
        areaId: NO_AREA_VALUE,
        jefeInmediato: NO_JEFE_VALUE,
        nivelOrganizacional: undefined,
      });
    }
  }, [editingPuesto, puestoForm]);

  useEffect(() => {
    if (editingSistema) {
      sistemaForm.reset({ id: editingSistema.id, nombre: editingSistema.nombre });
    } else {
      sistemaForm.reset({ nombre: '' });
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

  useEffect(() => {
    if (editingFuenteDestino) {
      fuenteDestinoForm.reset({ id: editingFuenteDestino.id, nombre: editingFuenteDestino.nombre });
    } else {
      fuenteDestinoForm.reset({ nombre: '' });
    }
  }, [editingFuenteDestino, fuenteDestinoForm]);


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
    const isAreaInUse = puestos.some(puesto => puesto.areaId === areaId);
    if (isAreaInUse) {
      toast({
        title: 'Error al eliminar',
        description: 'El área no puede ser eliminada porque está asignada a uno o más puestos.',
        variant: 'destructive',
      });
      return;
    }
    deleteContextArea(areaId);
    toast({ title: 'Área Eliminada', description: 'El área ha sido eliminada exitosamente.', variant: 'destructive' });
  }

  function handlePuestoSubmit(data: PuestoFormData) {
    const puestoDataToSave: PuestoCreationData = {
      nombre: data.nombre,
      areaId: data.areaId === NO_AREA_VALUE ? undefined : data.areaId,
      jefeInmediato: data.jefeInmediato === NO_JEFE_VALUE ? undefined : data.jefeInmediato,
      nivelOrganizacional: data.nivelOrganizacional,
    };
    
    if (editingPuesto && editingPuesto.id) {
      updateContextPuesto(editingPuesto.id, puestoDataToSave);
      toast({ title: 'Puesto Actualizado', description: 'El puesto ha sido actualizado exitosamente.' });
    } else {
      addPuesto(puestoDataToSave);
      toast({ title: 'Puesto Agregado', description: 'El puesto ha sido agregado exitosamente.' });
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
    if (isJefeInmediato) {
      toast({
        title: 'Error al eliminar',
        description: 'El puesto no puede ser eliminado porque es Jefe Inmediato de otro puesto.',
        variant: 'destructive',
      });
      return;
    }
    deleteContextPuesto(puestoId);
    toast({ title: 'Puesto Eliminado', description: 'El puesto ha sido eliminado exitosamente.', variant: 'destructive' });
  }

 function handleSistemaSubmit(data: SistemaFormData) {
    if (editingSistema) {
      setSistemas(sistemas.map((sistema) => (sistema.id === editingSistema.id ? { ...sistema, nombre: data.nombre } : sistema)));
      toast({ title: 'Sistema Actualizado', description: 'El sistema ha sido actualizado exitosamente.' });
      setEditingSistema(null);
      setIsSistemaDialogOpen(false);
      sistemaForm.reset();
    } else {
      const newSistema: Sistema = { id: Date.now().toString(), nombre: data.nombre };
      setSistemas([...sistemas, newSistema]);
      toast({ title: 'Sistema Agregado', description: 'El sistema ha sido agregado exitosamente.' });
      setIsSistemaDialogOpen(false); 
      sistemaForm.reset();
      openManageCostsDialog(newSistema); 
    }
  }

  function handleEditSistema(sistema: Sistema) {
    setEditingSistema(sistema);
    setIsSistemaDialogOpen(true);
  }

  function handleDeleteSistema(sistemaId: string) {
    setCostosSistemas(prevCostos => prevCostos.filter(costo => costo.sistemaId !== sistemaId));
    setSistemas(sistemas.filter((sistema) => sistema.id !== sistemaId));
    toast({ title: 'Sistema Eliminado', description: 'El sistema y sus costos asociados han sido eliminados.', variant: 'destructive' });
  }

  function handleCostoSistemaSubmit(data: SistemaCostoFormData) {
    const costoData: SistemaCosto = {
      id: editingCostoSistema ? editingCostoSistema.id : Date.now().toString(),
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

    if (editingCostoSistema) {
      setCostosSistemas(costosSistemas.map((c) => (c.id === editingCostoSistema.id ? costoData : c)));
      toast({ title: 'Costo de Sistema Actualizado', description: 'El costo ha sido actualizado exitosamente.' });
    } else {
      setCostosSistemas([...costosSistemas, costoData]);
      toast({ title: 'Costo de Sistema Agregado', description: 'El costo ha sido agregado exitosamente.' });
    }
    setEditingCostoSistema(null);
    setIsCostoSistemaDialogOpen(false); 
    costoSistemaForm.reset();
  }

  function handleEditCostoSistema(costo: SistemaCosto) {
    setEditingCostoSistema(costo);
    const systemForCost = sistemas.find(s => s.id === costo.sistemaId);
    if (systemForCost) {
        setSelectedSystemForCosts(systemForCost);
    }
    setIsCostoSistemaDialogOpen(true);
  }

  function handleDeleteCostoSistema(costoId: string) {
    setCostosSistemas(costosSistemas.filter((c) => c.id !== costoId));
    toast({ title: 'Costo de Sistema Eliminado', description: 'El costo ha sido eliminado exitosamente.', variant: 'destructive' });
  }

  function openManageCostsDialog(sistema: Sistema) {
    setSelectedSystemForCosts(sistema);
    setIsManageCostsDialogOpen(true);
  }

  function openAddCostoDialogForSelectedSystem() {
    if (!selectedSystemForCosts) return;
    setEditingCostoSistema(null); 
    setIsCostoSistemaDialogOpen(true);
  }

  function handleFuenteDestinoSubmit(data: FuenteDestinoFormData) {
    if (editingFuenteDestino && editingFuenteDestino.id) {
      updateContextFuenteDestino(editingFuenteDestino.id, data.nombre);
      toast({ title: 'Fuente/Destino Actualizado', description: 'El elemento ha sido actualizado exitosamente.' });
    } else {
      addFuenteDestino(data.nombre);
      toast({ title: 'Fuente/Destino Agregado', description: 'El elemento ha sido agregado exitosamente.' });
    }
    setEditingFuenteDestino(null);
    setIsFuenteDestinoDialogOpen(false);
    fuenteDestinoForm.reset();
  }

  function handleEditFuenteDestino(fd: FuenteDestino) {
    setEditingFuenteDestino(fd);
    setIsFuenteDestinoDialogOpen(true);
  }

  function handleDeleteFuenteDestino(fdId: string) {
    deleteContextFuenteDestino(fdId);
    toast({ title: 'Fuente/Destino Eliminado', description: 'El elemento ha sido eliminado exitosamente.', variant: 'destructive' });
  }
  
  const configSections: Array<{
    value: string;
    label: string;
    icon: ReactNode;
    content: ReactNode;
    fullDescription: string;
  }> = [
    {
      value: 'areas',
      label: 'Áreas',
      icon: <Building className="h-5 w-5 mr-2" />,
      fullDescription: 'Administrar las áreas organizacionales de la empresa. Al agregar una nueva área, la matriz en el módulo de Análisis se actualiza automáticamente con la nueva columna.',
      content: (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold">Gestión de Áreas</h3>
            <Dialog open={isAreaDialogOpen} onOpenChange={(isOpen) => {
              setIsAreaDialogOpen(isOpen);
              if (!isOpen) {
                setEditingArea(null);
                areaForm.reset({nombre: ''});
              }
            }}>
              <DialogTrigger asChild>
                <Button onClick={() => { setEditingArea(null); areaForm.reset({nombre: ''}); setIsAreaDialogOpen(true); }}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Agregar Área
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>{editingArea ? 'Editar Área' : 'Agregar Nueva Área'}</DialogTitle>
                  <DialogDescription>
                    {editingArea ? 'Modifica los detalles del área.' : 'Completa la información para agregar una nueva área.'}
                  </DialogDescription>
                </DialogHeader>
                <Form {...areaForm}>
                  <form onSubmit={areaForm.handleSubmit(handleAreaSubmit)} className="space-y-4 py-4">
                    <FormField
                      control={areaForm.control}
                      name="nombre"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nombre del Área</FormLabel>
                          <FormControl>
                            <Input placeholder="Ej: Finanzas, Operaciones" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter>
                      <DialogClose asChild>
                         <Button type="button" variant="outline" onClick={() => {setIsAreaDialogOpen(false); setEditingArea(null);}}>Cancelar</Button>
                      </DialogClose>
                      <Button type="submit">{editingArea ? 'Guardar Cambios' : 'Agregar Área'}</Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
          {isLoadingAreas ? (
            <PlaceholderContent title="Cargando áreas..." description="Por favor espere." icon={<Building className="h-12 w-12 text-muted-foreground" />} isLoading />
          ) : areas.length === 0 ? (
             <PlaceholderContent title="No hay áreas registradas" description="Comienza agregando áreas para organizar tu empresa." icon={<Building className="h-12 w-12 text-muted-foreground" />} />
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre del Área</TableHead>
                    <TableHead className="text-right w-[120px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {areas.map((area) => (
                    <TableRow key={area.id}>
                      <TableCell>{area.nombre}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleEditArea(area)} className="mr-2">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteArea(area.id)} className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      ),
    },
    {
      value: 'puestos',
      label: 'Puestos',
      icon: <Users className="h-5 w-5 mr-2" />,
      fullDescription: 'Administrar los diferentes roles o puestos de trabajo dentro de la organización. Campos: Nombre del puesto, Área, Jefe Inmediato, Nivel Organizacional.',
      content: (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold">Gestión de Puestos</h3>
            <Dialog open={isPuestoDialogOpen} onOpenChange={(isOpen) => {
              setIsPuestoDialogOpen(isOpen);
              if (!isOpen) {
                setEditingPuesto(null);
                puestoForm.reset({nombre: '', areaId: NO_AREA_VALUE, jefeInmediato: NO_JEFE_VALUE, nivelOrganizacional: undefined});
              }
            }}>
              <DialogTrigger asChild>
                <Button onClick={() => { setEditingPuesto(null); puestoForm.reset({nombre: '', areaId: NO_AREA_VALUE, jefeInmediato: NO_JEFE_VALUE, nivelOrganizacional: undefined}); setIsPuestoDialogOpen(true); }}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Agregar Puesto
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[525px]">
                <DialogHeader>
                  <DialogTitle>{editingPuesto ? 'Editar Puesto' : 'Agregar Nuevo Puesto'}</DialogTitle>
                  <DialogDescription>
                    {editingPuesto ? 'Modifica los detalles del puesto.' : 'Completa la información para agregar un nuevo puesto.'}
                  </DialogDescription>
                </DialogHeader>
                <Form {...puestoForm}>
                  <form onSubmit={puestoForm.handleSubmit(handlePuestoSubmit)} className="space-y-4 py-4">
                    <FormField
                      control={puestoForm.control}
                      name="nombre"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nombre del Puesto</FormLabel>
                          <FormControl>
                            <Input placeholder="Ej: Analista Financiero, Gerente de Logística" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                     <FormField
                      control={puestoForm.control}
                      name="areaId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Área a la que pertenece (Opcional)</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value || NO_AREA_VALUE}
                            disabled={isLoadingAreas}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={isLoadingAreas ? "Cargando áreas..." : "Seleccione un área"} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                               <SelectItem value={NO_AREA_VALUE}>Sin Área Asignada</SelectItem>
                              {isLoadingAreas ? (
                                <SelectItem value="loading-areas" disabled>Cargando áreas...</SelectItem>
                              ) : areas.length === 0 ? (
                                <SelectItem value="no-areas-disabled" disabled>No hay áreas disponibles</SelectItem>
                              ) : (
                                areas.map((area) => (
                                  <SelectItem key={area.id} value={area.id}>
                                    {area.nombre}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={puestoForm.control}
                      name="jefeInmediato"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Jefe Inmediato (Opcional)</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value || NO_JEFE_VALUE}
                            disabled={isLoadingPuestos || puestos.filter(p => !editingPuesto || p.id !== editingPuesto.id).length === 0}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={isLoadingPuestos ? "Cargando puestos..." : "Seleccione un jefe inmediato"} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value={NO_JEFE_VALUE}>Sin Jefe Inmediato</SelectItem>
                              {isLoadingPuestos ? (
                                <SelectItem value="loading-puestos" disabled>Cargando puestos...</SelectItem>
                              ) : (
                                puestos
                                  .filter(p => !editingPuesto || p.id !== editingPuesto.id) 
                                  .map((puesto) => (
                                    <SelectItem key={puesto.id} value={puesto.id}>
                                      {puesto.nombre}
                                    </SelectItem>
                                  ))
                              )}
                              {!isLoadingPuestos && puestos.filter(p => !editingPuesto || p.id !== editingPuesto.id).length === 0 && (
                                   <SelectItem value="no-puestos-disabled" disabled>No hay otros puestos disponibles</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={puestoForm.control}
                      name="nivelOrganizacional"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nivel Organizacional</FormLabel>
                           <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccione un nivel" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {nivelesOrganizacionales.map((nivel) => (
                                <SelectItem key={nivel} value={nivel}>
                                  {nivel}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter>
                       <DialogClose asChild>
                        <Button type="button" variant="outline" onClick={() => { setIsPuestoDialogOpen(false); setEditingPuesto(null); }}>Cancelar</Button>
                       </DialogClose>
                      <Button type="submit">{editingPuesto ? 'Guardar Cambios' : 'Agregar Puesto'}</Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
          {isLoadingPuestos ? (
            <PlaceholderContent title="Cargando puestos..." description="Por favor espere." icon={<Users className="h-12 w-12 text-muted-foreground" />} isLoading />
          ) : puestos.length === 0 ? (
             <PlaceholderContent title="No hay puestos registrados" description="Comienza agregando puestos para definir la estructura de roles." icon={<Users className="h-12 w-12 text-muted-foreground" />} />
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre del Puesto</TableHead>
                    <TableHead>Área</TableHead>
                    <TableHead>Nivel Organizacional</TableHead>
                    <TableHead>Jefe Inmediato</TableHead>
                    <TableHead className="text-right w-[120px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {puestos.map((puesto) => {
                    const areaPuesto = puesto.areaId ? areas.find(a => a.id === puesto.areaId) : null;
                    const jefeInmediato = puesto.jefeInmediato ? puestos.find(p => p.id === puesto.jefeInmediato) : null;
                    return (
                      <TableRow key={puesto.id}>
                        <TableCell>{puesto.nombre}</TableCell>
                        <TableCell>{areaPuesto ? areaPuesto.nombre : 'Sin Área'}</TableCell>
                        <TableCell>{puesto.nivelOrganizacional}</TableCell>
                        <TableCell>{jefeInmediato ? jefeInmediato.nombre : '-'}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => handleEditPuesto(puesto)} className="mr-2">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeletePuesto(puesto.id)} className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      ),
    },
    {
      value: 'sistemas',
      label: 'Sistemas y Costos',
      icon: <Laptop className="h-5 w-5 mr-2" />,
      fullDescription: 'Mantener el inventario de sistemas tecnológicos y sus costos asociados. Campos: Nombre del sistema. Acciones: Agregar, Editar, Eliminar Sistema; Gestionar Costos.',
      content: (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold">Gestión de Sistemas y Costos</h3>
            <Dialog open={isSistemaDialogOpen} onOpenChange={(isOpen) => {
              setIsSistemaDialogOpen(isOpen);
              if (!isOpen) {
                setEditingSistema(null);
                sistemaForm.reset({nombre: ''});
              }
            }}>
              <DialogTrigger asChild>
                <Button onClick={() => { setEditingSistema(null); sistemaForm.reset({nombre: ''}); setIsSistemaDialogOpen(true); }}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Agregar Sistema
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>{editingSistema ? 'Editar Sistema' : 'Agregar Nuevo Sistema'}</DialogTitle>
                  <DialogDescription>
                    {editingSistema ? 'Modifica los detalles del sistema.' : 'Completa la información para agregar un nuevo sistema.'}
                  </DialogDescription>
                </DialogHeader>
                <Form {...sistemaForm}>
                  <form onSubmit={sistemaForm.handleSubmit(handleSistemaSubmit)} className="space-y-4 py-4">
                    <FormField
                      control={sistemaForm.control}
                      name="nombre"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nombre del Sistema</FormLabel>
                          <FormControl>
                            <Input placeholder="Ej: SAP, Salesforce, ERP Interno" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter>
                      <DialogClose asChild>
                         <Button type="button" variant="outline" onClick={() => {setIsSistemaDialogOpen(false); setEditingSistema(null);}}>Cancelar</Button>
                      </DialogClose>
                      <Button type="submit">{editingSistema ? 'Guardar Cambios' : 'Agregar Sistema'}</Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
          {sistemas.length === 0 ? (
             <PlaceholderContent title="No hay sistemas registrados" description="Comienza agregando sistemas para gestionar tu inventario tecnológico y sus costos." icon={<Laptop className="h-12 w-12 text-muted-foreground" />} />
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre del Sistema</TableHead>
                    <TableHead>Total Costo Anual Estimado</TableHead>
                    <TableHead className="text-right w-[220px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sistemas.map((sistema) => (
                    <TableRow key={sistema.id}>
                      <TableCell>{sistema.nombre}</TableCell>
                      <TableCell>{getSystemAnnualCost(sistema.id, costosSistemas, sistemas)}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="outline" size="sm" onClick={() => openManageCostsDialog(sistema)}>
                          <DollarSign className="mr-2 h-4 w-4" /> Gestionar Costos
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleEditSistema(sistema)} className="mr-1">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteSistema(sistema.id)} className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}

          {/* Manage Costs Dialog */}
          <Dialog open={isManageCostsDialogOpen} onOpenChange={(isOpen) => {
            setIsManageCostsDialogOpen(isOpen);
            if (!isOpen) setSelectedSystemForCosts(null);
          }}>
            <DialogContent className="sm:max-w-[1000px] md:max-w-[calc(100vw-4rem)] lg:max-w-5xl">
              <DialogHeader>
                <DialogTitle>Gestionar Costos para {selectedSystemForCosts?.nombre}</DialogTitle>
                <DialogDescription>
                  Agregue, edite o elimine los costos asociados a este sistema.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <div className="flex justify-end mb-4">
                  <Button onClick={openAddCostoDialogForSelectedSystem}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Agregar Costo
                  </Button>
                </div>
                {costosSistemas.filter(c => c.sistemaId === selectedSystemForCosts?.id).length === 0 ? (
                   <PlaceholderContent title="No hay costos registrados" description={`Aún no se han registrado costos para ${selectedSystemForCosts?.nombre}. Comience agregando uno.`} icon={<DollarSign className="h-12 w-12 text-muted-foreground" />} />
                ) : (
                  <Card>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[15%]">Tipos de Costo</TableHead>
                          <TableHead className="text-right">Monto Uso</TableHead>
                          <TableHead className="text-right">Num. Lic.</TableHead>
                          <TableHead className="text-right">Costo Unit. Lic.</TableHead>
                          <TableHead className="text-right">Total Periódico</TableHead>
                          <TableHead>Frecuencia</TableHead>
                          <TableHead>Forma de Pago</TableHead>
                          <TableHead>Descripción</TableHead>
                          <TableHead className="text-right w-[120px]">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {costosSistemas
                          .filter(c => c.sistemaId === selectedSystemForCosts?.id)
                          .map((costo) => {
                            const costoUso = costo.montoUso || 0;
                            const costoLicenciasTotal = (costo.costoPorLicencia || 0) * (costo.numeroLicencias || 0);
                            const costoTotalPeriodico = costoUso + costoLicenciasTotal;
                            return (
                              <TableRow key={costo.id}>
                                <TableCell>{costo.tipoCosto.join(', ')}</TableCell>
                                <TableCell className="text-right">{formatCurrency(costo.montoUso, costo.moneda)}</TableCell>
                                <TableCell className="text-right">{costo.numeroLicencias ?? '-'}</TableCell>
                                <TableCell className="text-right">{formatCurrency(costo.costoPorLicencia, costo.moneda)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(costoTotalPeriodico, costo.moneda)}</TableCell>
                                <TableCell>{costo.frecuencia}</TableCell>
                                <TableCell>{costo.formaPago}</TableCell>
                                <TableCell className="truncate max-w-[150px]">{costo.descripcion || '-'}</TableCell>
                                <TableCell className="text-right">
                                  <Button variant="ghost" size="icon" onClick={() => handleEditCostoSistema(costo)} className="mr-2">
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => handleDeleteCostoSistema(costo.id)} className="text-destructive hover:text-destructive">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                      </TableBody>
                    </Table>
                  </Card>
                )}
              </div>
               <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">Cerrar</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Add/Edit CostoSistema Dialog */}
          <Dialog open={isCostoSistemaDialogOpen} onOpenChange={(isOpen) => {
            setIsCostoSistemaDialogOpen(isOpen);
            if (!isOpen) {
              setEditingCostoSistema(null); 
              costoSistemaForm.reset();
            }
          }}>
            <DialogContent className="sm:max-w-[620px]">
              <DialogHeader>
                <DialogTitle>{editingCostoSistema ? `Editar Costo para ${sistemas.find(s => s.id === editingCostoSistema?.sistemaId)?.nombre}` : `Agregar Costo para ${selectedSystemForCosts?.nombre}`}</DialogTitle>
                <DialogDescription>
                  {editingCostoSistema ? 'Modifica los detalles del costo.' : 'Completa la información para agregar un nuevo costo.'}
                </DialogDescription>
              </DialogHeader>
              <Form {...costoSistemaForm}>
                <form onSubmit={costoSistemaForm.handleSubmit(handleCostoSistemaSubmit)} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
                  <FormField
                    control={costoSistemaForm.control}
                    name="sistemaId"
                    render={({ field }) => (
                      <FormItem className="hidden">
                        <FormLabel>Sistema</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled >
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Sistema (auto-seleccionado)" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {sistemas.map((s) => (<SelectItem key={s.id} value={s.id}>{s.nombre}</SelectItem>))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={costoSistemaForm.control}
                    name="tipoCosto"
                    render={() => (
                      <FormItem>
                        <FormLabel>Tipo de Costo</FormLabel>
                        <FormDescription>Seleccione uno o ambos tipos de costo.</FormDescription>
                        <div className="grid grid-cols-2 gap-4 pt-2">
                        {tiposDeCostoOptions.map((tipo) => (
                          <FormField
                            key={tipo}
                            control={costoSistemaForm.control}
                            name="tipoCosto"
                            render={({ field }) => {
                              return (
                                <FormItem className="flex flex-row items-center space-x-2 space-y-0 rounded-md border p-3 shadow-sm">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(tipo)}
                                      onCheckedChange={(checked) => {
                                        const newValue = checked
                                          ? [...(field.value || []), tipo]
                                          : (field.value || []).filter((value) => value !== tipo);
                                        field.onChange(newValue);
                                      }}
                                    />
                                  </FormControl>
                                  <FormLabel className="font-normal text-sm leading-none">{tipo}</FormLabel>
                                </FormItem>
                              );
                            }}
                          />
                        ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {costoSistemaForm.watch('tipoCosto')?.includes('Por Uso del Sistema') && (
                    <FormField
                      control={costoSistemaForm.control}
                      name="montoUso"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Monto por Uso del Sistema</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="Ej: 150.00" {...field} step="0.01" value={field.value ?? ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  {costoSistemaForm.watch('tipoCosto')?.includes('Por Licencias') && (
                    <div className="grid grid-cols-2 gap-4">
                       <FormField
                        control={costoSistemaForm.control}
                        name="numeroLicencias"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Número de Licencias</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="Ej: 10" {...field} step="1" value={field.value ?? ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={costoSistemaForm.control}
                        name="costoPorLicencia"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Costo por Licencia</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="Ej: 25.00" {...field} step="0.01" value={field.value ?? ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={costoSistemaForm.control}
                      name="formaPago"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Forma de Pago</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Seleccione..." /></SelectTrigger></FormControl>
                            <SelectContent>
                              {formasDePagoOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                     <FormField
                      control={costoSistemaForm.control}
                      name="frecuencia"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Frecuencia</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Seleccione..." /></SelectTrigger></FormControl>
                            <SelectContent>
                              {frecuenciasDePagoOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={costoSistemaForm.control}
                      name="moneda"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Moneda</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Seleccione..." /></SelectTrigger></FormControl>
                            <SelectContent>
                              {tiposDeMonedaOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={costoSistemaForm.control}
                    name="descripcion"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descripción (Opcional)</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Detalles adicionales del costo..." {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button type="button" variant="outline" onClick={() => {setIsCostoSistemaDialogOpen(false); setEditingCostoSistema(null);}}>Cancelar</Button>
                    </DialogClose>
                    <Button type="submit">{editingCostoSistema ? 'Guardar Cambios' : 'Agregar Costo'}</Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      ),
    },
    {
      value: 'fuentesDestinos',
      label: 'Fuentes/Destinos',
      icon: <Share2 className="h-5 w-5 mr-2" />,
      fullDescription: 'Administrar listas para "Información que Recibe" y "Entrega" en Captura. Campos: Nombre de la fuente/destino/formato.',
      content: (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold">Gestión de Fuentes/Destinos de Información</h3>
             <Dialog open={isFuenteDestinoDialogOpen} onOpenChange={(isOpen) => {
                setIsFuenteDestinoDialogOpen(isOpen);
                if (!isOpen) {
                    setEditingFuenteDestino(null);
                    fuenteDestinoForm.reset({ nombre: '' });
                }
            }}>
              <DialogTrigger asChild>
                <Button onClick={() => { setEditingFuenteDestino(null); fuenteDestinoForm.reset({ nombre: '' }); setIsFuenteDestinoDialogOpen(true); }}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Agregar Elemento
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>{editingFuenteDestino ? 'Editar Elemento' : 'Agregar Nuevo Elemento'}</DialogTitle>
                  <DialogDescription>
                    {editingFuenteDestino ? 'Modifica el nombre del elemento.' : 'Completa la información para agregar un nuevo elemento a la lista.'}
                  </DialogDescription>
                </DialogHeader>
                <Form {...fuenteDestinoForm}>
                  <form onSubmit={fuenteDestinoForm.handleSubmit(handleFuenteDestinoSubmit)} className="space-y-4 py-4">
                    <FormField
                      control={fuenteDestinoForm.control}
                      name="nombre"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nombre del Elemento</FormLabel>
                          <FormControl>
                            <Input placeholder="Ej: Factura Cliente, Reporte Interno, API Externa" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button type="button" variant="outline" onClick={() => { setIsFuenteDestinoDialogOpen(false); setEditingFuenteDestino(null); }}>Cancelar</Button>
                      </DialogClose>
                      <Button type="submit">{editingFuenteDestino ? 'Guardar Cambios' : 'Agregar Elemento'}</Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
          {isLoadingFuentesDestinos ? (
            <PlaceholderContent title="Cargando elementos..." description="Por favor espere." icon={<Share2 className="h-12 w-12 text-muted-foreground" />} isLoading />
          ) : fuentesDestinos.length === 0 ? (
            <PlaceholderContent title="No hay elementos registrados" description="Comienza agregando fuentes, destinos o formatos de información." icon={<Share2 className="h-12 w-12 text-muted-foreground" />} />
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre del Elemento</TableHead>
                    <TableHead className="text-right w-[120px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fuentesDestinos.map((fd) => (
                    <TableRow key={fd.id}>
                      <TableCell>{fd.nombre}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleEditFuenteDestino(fd)} className="mr-2">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteFuenteDestino(fd.id)} className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      ),
    },
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
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-2 md:grid-cols-4 mb-4">
              {configSections.map(section => (
                <TabsTrigger key={section.value} value={section.value} className="flex items-center justify-center text-xs sm:text-sm">
                  {section.icon}
                  {section.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {configSections.map(section => (
              <TabsContent key={section.value} value={section.value}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                       {React.cloneElement(section.icon as React.ReactElement, { className: (section.icon as React.ReactElement).props.className?.replace('mr-2', '') })}
                       <span className="ml-2">{section.label}</span>
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">{section.fullDescription}</p>
                  </CardHeader>
                  <CardContent>
                    {section.content}
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
    
