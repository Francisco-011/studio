
'use client';

import { useState, useMemo, useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { useRouter } from 'next/navigation';

import { useAreas, type Area } from '@/contexts/AreasContext';
import { useDepartamentos, type Departamento } from '@/contexts/DepartamentosContext';
import { usePuestos, type Puesto, type PuestoCreationData, nivelesOrganizacionales } from '@/contexts/PuestosContext';
import { useSistemasCostos, type Sistema, type SistemaCosto, formasDePagoOptions, frecuenciasDePagoOptions, tiposDeMonedaOptions, sistemaScopeOptions, type SistemaScope, type TipoMoneda } from '@/contexts/SistemasCostosContext';
import { useAcciones } from '@/contexts/AccionesContext';
import type { CapturedProcess } from '../procesos-y-flujos-registrados/page';
import { useActividades } from '@/contexts/ActividadesContext';

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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from '@/hooks/use-toast';
import { Settings, PlusCircle, Edit2, Trash2, Building, Users, Laptop, Loader2, Search, AlertTriangle, Building2, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";


// Schemas
const areaFormSchema = z.object({ id: z.string().optional(), nombre: z.string().min(1, 'El nombre del área es requerido.') });
type AreaFormData = z.infer<typeof areaFormSchema>;

const departamentoFormSchema = z.object({ id: z.string().optional(), nombre: z.string().min(1, 'El nombre es requerido.'), areaId: z.string({ required_error: 'Debe seleccionar un área.' }) });
type DepartamentoFormData = z.infer<typeof departamentoFormSchema>;

const puestoFormSchema = z.object({
  id: z.string().optional(),
  nombre: z.string().min(1, "El nombre es requerido."),
  areaId: z.string({ required_error: 'El área es requerida.' }),
  departamentoId: z.string().optional(),
  jefeInmediato: z.string().optional(),
  nivelOrganizacional: z.enum(nivelesOrganizacionales, { errorMap: () => ({ message: "Seleccione un nivel." }) }),
  numeroPersonas: z.preprocess(val => (String(val).trim() === '' ? undefined : parseInt(String(val), 10)), z.number().int().nonnegative().optional())
});
type PuestoFormData = z.infer<typeof puestoFormSchema>;

const sistemaFormSchema = z.object({
  id: z.string().optional(),
  nombre: z.string().min(1, "El nombre es requerido."),
  scope: z.enum(sistemaScopeOptions),
  scopeId: z.string().optional(),
}).refine(data => data.scope === 'Empresa' || !!data.scopeId, { message: "Debe seleccionar un ámbito específico si el alcance no es 'Empresa'.", path: ["scopeId"] });
type SistemaFormData = z.infer<typeof sistemaFormSchema>;

const costoSistemaFormSchema = z.object({
    id: z.string().optional(),
    sistemaId: z.string(),
    descripcion: z.string().min(1, "La descripción es requerida."),
    montoUso: z.preprocess(
      (val) => (val === undefined || val === null || String(val).trim() === '' ? undefined : parseFloat(String(val))),
      z.number({ invalid_type_error: "Debe ser un número." }).nonnegative("Debe ser positivo.").optional()
    ),
    numeroLicencias: z.preprocess(
      (val) => (val === undefined || val === null || String(val).trim() === '' ? undefined : parseInt(String(val), 10)),
      z.number({ invalid_type_error: "Debe ser un número." }).int("Debe ser entero.").nonnegative("Debe ser positivo.").optional()
    ),
    costoPorLicencia: z.preprocess(
      (val) => (val === undefined || val === null || String(val).trim() === '' ? undefined : parseFloat(String(val))),
      z.number({ invalid_type_error: "Debe ser un número." }).nonnegative("Debe ser positivo.").optional()
    ),
    formaPago: z.enum(formasDePagoOptions as [string, ...string[]]).optional(),
    frecuencia: z.enum(frecuenciasDePagoOptions as [string, ...string[]]).optional(),
    moneda: z.enum(tiposDeMonedaOptions as [string, ...string[]]).optional(),
});
type CostoSistemaFormData = z.infer<typeof costoSistemaFormSchema>;


const PlaceholderContent = ({ title, description, icon }: { title: string, description: string, icon: React.ReactNode }) => (
  <div className="mt-6 p-8 border border-dashed border-border rounded-lg flex flex-col items-center justify-center min-h-[200px] bg-muted/20">
    {icon}
    <p className="text-lg font-semibold text-foreground mt-4">{title}</p>
    <p className="text-sm text-muted-foreground text-center">{description}</p>
  </div>
);


export default function ConfiguracionPage() {
  // Contexts
  const { areas, addArea, updateArea, deleteArea, isLoading: isLoadingAreas } = useAreas();
  const { departamentos, addDepartamento, updateDepartamento, deleteDepartamento, isLoading: isLoadingDepartamentos } = useDepartamentos();
  const { puestos, addPuesto, updatePuesto, deletePuesto, isLoadingPuestos } = usePuestos();
  const { sistemas, costosSistemas, addSistema, updateSistema, deleteSistema, addCostoSistema, updateCostoSistema, deleteCostoSistema, isLoadingSistemasCostos } = useSistemasCostos();
  const { acciones } = useAcciones();
  const [allProcesses, setAllProcesses] = useState<CapturedProcess[]>([]);
  const { actividades } = useActividades();

  useEffect(() => {
      const storedData = localStorage.getItem('proceza-captured-data');
      if (storedData) setAllProcesses(JSON.parse(storedData));
  }, []);

  // Dialog states
  const [isAreaDialogOpen, setIsAreaDialogOpen] = useState(false);
  const [isDeptoDialogOpen, setIsDeptoDialogOpen] = useState(false);
  const [isPuestoDialogOpen, setIsPuestoDialogOpen] = useState(false);
  const [isSistemaDialogOpen, setIsSistemaDialogOpen] = useState(false);
  const [isCostoDialogOpen, setIsCostoDialogOpen] = useState(false);
  const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] = useState(false);

  // Editing states
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [editingDepto, setEditingDepto] = useState<Departamento | null>(null);
  const [editingPuesto, setEditingPuesto] = useState<Puesto | null>(null);
  const [editingSistema, setEditingSistema] = useState<Sistema | null>(null);
  const [editingCosto, setEditingCosto] = useState<SistemaCosto | null>(null);
  const [currentSistemaForCosto, setCurrentSistemaForCosto] = useState<Sistema | null>(null);
  
  // Search states
  const [areaSearchTerm, setAreaSearchTerm] = useState('');
  const [deptoSearchTerm, setDeptoSearchTerm] = useState('');
  const [puestoSearchTerm, setPuestoSearchTerm] = useState('');
  const [sistemaSearchTerm, setSistemaSearchTerm] = useState('');

  // Deletion state
  const [itemToDelete, setItemToDelete] = useState<{ id: string; name: string; type: 'area' | 'departamento' | 'puesto' | 'sistema' | 'costoSistema' } | null>(null);
  
  // Forms
  const areaForm = useForm<AreaFormData>({ resolver: zodResolver(areaFormSchema), defaultValues: { nombre: '' } });
  const deptoForm = useForm<DepartamentoFormData>({ resolver: zodResolver(departamentoFormSchema) });
  const puestoForm = useForm<PuestoFormData>({ resolver: zodResolver(puestoFormSchema) });
  const sistemaForm = useForm<SistemaFormData>({ resolver: zodResolver(sistemaFormSchema) });
  const costoForm = useForm<CostoSistemaFormData>({ resolver: zodResolver(costoSistemaFormSchema) });

  const isLoading = isLoadingAreas || isLoadingDepartamentos || isLoadingPuestos || isLoadingSistemasCostos;

  // Effects to reset forms when dialogs open/close
  useEffect(() => { areaForm.reset(editingArea ? { id: editingArea.id, nombre: editingArea.nombre } : { nombre: '' }); }, [editingArea, areaForm]);
  useEffect(() => { deptoForm.reset(editingDepto || { nombre: '', areaId: '' }); }, [editingDepto, deptoForm]);
  useEffect(() => { puestoForm.reset(editingPuesto || { nombre: '', areaId: '' }); }, [editingPuesto, puestoForm]);
  useEffect(() => { sistemaForm.reset(editingSistema || { nombre: '', scope: 'Empresa' }); }, [editingSistema, sistemaForm]);
  useEffect(() => {
    if (isCostoDialogOpen) {
      costoForm.reset(editingCosto || { sistemaId: currentSistemaForCosto?.id || '', descripcion: '' });
    }
  }, [isCostoDialogOpen, editingCosto, currentSistemaForCosto, costoForm]);

  // Filtered data
  const filteredAreas = useMemo(() => areas.filter(a => a.nombre.toLowerCase().includes(areaSearchTerm.toLowerCase())), [areas, areaSearchTerm]);
  const filteredDeptos = useMemo(() => departamentos.map(d => ({ ...d, areaNombre: areas.find(a => a.id === d.areaId)?.nombre || 'N/A' })).filter(d => d.nombre.toLowerCase().includes(deptoSearchTerm.toLowerCase()) || d.areaNombre.toLowerCase().includes(deptoSearchTerm.toLowerCase())), [departamentos, areas, deptoSearchTerm]);
  const filteredPuestos = useMemo(() => puestos.map(p => ({ ...p, areaNombre: areas.find(a => a.id === p.areaId)?.nombre || 'N/A', deptoNombre: departamentos.find(d => d.id === p.departamentoId)?.nombre || 'N/A' })).filter(p => p.nombre.toLowerCase().includes(puestoSearchTerm.toLowerCase()) || p.areaNombre.toLowerCase().includes(puestoSearchTerm.toLowerCase()) || p.deptoNombre.toLowerCase().includes(puestoSearchTerm.toLowerCase())), [puestos, areas, departamentos, puestoSearchTerm]);
  const filteredSistemas = useMemo(() => sistemas.filter(s => s.nombre.toLowerCase().includes(sistemaSearchTerm.toLowerCase())), [sistemas, sistemaSearchTerm]);

  // Submit Handlers
  async function handleAreaSubmit(data: AreaFormData) {
    if (editingArea) await updateArea(editingArea.id, data.nombre); else await addArea(data.nombre);
    setIsAreaDialogOpen(false);
  }
  function handleDeptoSubmit(data: DepartamentoFormData) {
    if (editingDepto) updateDepartamento(editingDepto.id, data.nombre, data.areaId); else addDepartamento(data.nombre, data.areaId);
    setIsDeptoDialogOpen(false);
  }
  function handlePuestoSubmit(data: PuestoFormData) {
    const puestoData: PuestoCreationData = { ...data, departamentoId: data.departamentoId === 'none' ? undefined : data.departamentoId };
    if (editingPuesto) updatePuesto(editingPuesto.id, puestoData); else addPuesto(puestoData);
    setIsPuestoDialogOpen(false);
  }
  function handleSistemaSubmit(data: SistemaFormData) {
    if (editingSistema) updateSistema(editingSistema.id, data); else addSistema(data);
    setIsSistemaDialogOpen(false);
  }
  function handleCostoSistemaSubmit(data: CostoSistemaFormData) {
    const costoData = { ...data };
    if (editingCosto) updateCostoSistema(editingCosto.id, costoData); else addCostoSistema(costoData);
    setIsCostoDialogOpen(false);
  }

  // Edit Handlers
  function handleEdit<T>(item: T, setEditing: (item: T | null) => void, setOpen: (open: boolean) => void) { setEditing(item); setOpen(true); }
  
  // Delete Logic
  function promptDelete(id: string, name: string, type: 'area' | 'departamento' | 'puesto' | 'sistema' | 'costoSistema') { setItemToDelete({ id, name, type }); setIsConfirmDeleteDialogOpen(true); }
  async function executeDelete() {
    if (!itemToDelete) return;
    const { id, name, type } = itemToDelete;
    let isUsed = false;
    let usageMessage = '';

    switch (type) {
        case 'area':
            const isUsedInDeptos = departamentos.some(d => d.areaId === id);
            const isUsedInPuestos = puestos.some(p => p.areaId === id);
            isUsed = isUsedInDeptos || isUsedInPuestos;
            usageMessage = isUsedInDeptos ? 'Departamentos' : (isUsedInPuestos ? 'Puestos' : '');
            if (!isUsed) await deleteArea(id);
            break;
        case 'departamento':
            isUsed = puestos.some(p => p.departamentoId === id);
            usageMessage = 'Puestos';
            if (!isUsed) deleteDepartamento(id);
            break;
        case 'puesto':
            isUsed = allProcesses.some(p => p.puesto === name) || acciones.some(a => a.puesto === name);
            usageMessage = allProcesses.some(p => p.puesto === name) ? 'Procesos Capturados' : 'Acciones de Mejora';
            if (!isUsed) deletePuesto(id);
            break;
        case 'sistema':
            isUsed = allProcesses.some(p => p.sistemas?.includes(name)) || actividades.some(a => a.sistemaUtilizado === name);
            usageMessage = allProcesses.some(p => p.sistemas?.includes(name)) ? 'Procesos Capturados' : 'Actividades';
            if (!isUsed) deleteSistema(id);
            break;
        case 'costoSistema':
            deleteCostoSistema(id);
            break;
    }
    
    if (isUsed) {
        toast({ title: "Eliminación Bloqueada", description: `"${name}" está en uso por ${usageMessage} y no puede ser eliminado.`, variant: "destructive", duration: 7000 });
    } else {
        toast({ title: 'Elemento Eliminado', variant: "destructive" });
    }
    setItemToDelete(null);
    setIsConfirmDeleteDialogOpen(false);
  }

  const watchedPuestoArea = puestoForm.watch('areaId');
  const filteredDeptosForPuestoForm = useMemo(() => departamentos.filter(d => d.areaId === watchedPuestoArea), [departamentos, watchedPuestoArea]);

  const watchedSistemaScope = sistemaForm.watch('scope');
  const scopeOptions = useMemo(() => {
      switch (watchedSistemaScope) {
          case 'Área': return areas.map(a => ({ id: a.id, nombre: a.nombre }));
          case 'Departamento': return departamentos.map(d => ({ id: d.id, nombre: `${d.nombre} (${areas.find(a => a.id === d.areaId)?.nombre})` }));
          case 'Puesto': return puestos.map(p => ({ id: p.id, nombre: `${p.nombre} (${areas.find(a => a.id === p.areaId)?.nombre})` }));
          default: return [];
      }
  }, [watchedSistemaScope, areas, departamentos, puestos]);

  const configSections = [
    { value: 'areas', label: 'Áreas', icon: <Building className="h-5 w-5 mr-2" /> },
    { value: 'departamentos', label: 'Departamentos', icon: <Building2 className="h-5 w-5 mr-2" /> },
    { value: 'puestos', label: 'Puestos', icon: <Users className="h-5 w-5 mr-2" /> },
    { value: 'sistemas', label: 'Sistemas y Costos', icon: <Laptop className="h-5 w-5 mr-2" /> },
  ];

  const calculateTotalAnnualCost = (sistemaId: string) => {
    const costsForSystem = costosSistemas.filter(cost => cost.sistemaId === sistemaId);
    if (costsForSystem.length === 0) return [];

    const totalsByCurrency = new Map<TipoMoneda, number>();

    costsForSystem.forEach(cost => {
      const usageCost = cost.montoUso || 0;
      const licenseCost = (cost.costoPorLicencia || 0) * (cost.numeroLicencias || 0);
      const baseAmount = usageCost + licenseCost;
      
      let annualCost = 0;
      if (cost.frecuencia === "Mensual") {
        annualCost = baseAmount * 12;
      } else { // "Anual" or "Otro" are treated as annual
        annualCost = baseAmount;
      }

      if (cost.moneda) {
        const currentTotal = totalsByCurrency.get(cost.moneda) || 0;
        totalsByCurrency.set(cost.moneda, currentTotal + annualCost);
      }
    });

    return Array.from(totalsByCurrency.entries()).map(([currency, total]) => ({
      currency,
      total,
    }));
  };


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
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 mb-4">
              {configSections.map(section => (
                <TabsTrigger key={section.value} value={section.value} className="flex items-center justify-center text-xs sm:text-sm">
                  {section.icon}
                  {section.label}
                </TabsTrigger>
              ))}
            </TabsList>
            
            <TabsContent value="areas">
                <Card><CardHeader><CardTitle>Áreas</CardTitle><CardDescription>Administrar las áreas o divisiones principales de la empresa.</CardDescription></CardHeader>
                  <CardContent>
                      <div className="flex justify-between items-center mb-4">
                        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" /><Input placeholder="Buscar área..." value={areaSearchTerm} onChange={(e) => setAreaSearchTerm(e.target.value)} className="w-full pl-10" /></div>
                        <Button onClick={() => handleEdit(null, setEditingArea, setIsAreaDialogOpen)}><PlusCircle className="mr-2 h-4 w-4" /> Agregar Área</Button>
                      </div>
                      {isLoading ? <PlaceholderContent title="Cargando..." description="" icon={<Loader2 className="h-12 w-12 text-muted-foreground animate-spin" />} /> :
                       filteredAreas.length > 0 ? (
                        <Card><Table><TableHeader><TableRow><TableHead>Nombre del Área</TableHead><TableHead className="text-right w-[120px]">Acciones</TableHead></TableRow></TableHeader>
                            <TableBody>{filteredAreas.map((area) => (
                                <TableRow key={area.id}>
                                  <TableCell>{area.nombre}</TableCell>
                                  <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => handleEdit(area, setEditingArea, setIsAreaDialogOpen)} className="mr-2"><Edit2 className="h-4 w-4" /></Button>
                                    <Button variant="ghost" size="icon" onClick={() => promptDelete(area.id, area.nombre, 'area')} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                                  </TableCell>
                                </TableRow>
                              ))}</TableBody>
                          </Table></Card>) : 
                          <PlaceholderContent title="No hay áreas" description="Comience agregando una nueva área." icon={<Building className="h-12 w-12 text-muted-foreground" />} />}
                  </CardContent></Card>
            </TabsContent>

            <TabsContent value="departamentos">
                 <Card><CardHeader><CardTitle>Departamentos</CardTitle><CardDescription>Administrar los departamentos dentro de cada área.</CardDescription></CardHeader>
                  <CardContent>
                      <div className="flex justify-between items-center mb-4">
                        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" /><Input placeholder="Buscar depto o área..." value={deptoSearchTerm} onChange={(e) => setDeptoSearchTerm(e.target.value)} className="w-full pl-10" /></div>
                        <Button onClick={() => handleEdit(null, setEditingDepto, setIsDeptoDialogOpen)}><PlusCircle className="mr-2 h-4 w-4" /> Agregar Depto.</Button>
                      </div>
                      {isLoading ? <PlaceholderContent title="Cargando..." description="" icon={<Loader2 className="h-12 w-12 text-muted-foreground animate-spin" />} /> :
                       filteredDeptos.length > 0 ? (
                        <Card><Table><TableHeader><TableRow><TableHead>Nombre del Depto.</TableHead><TableHead>Área</TableHead><TableHead className="text-right w-[120px]">Acciones</TableHead></TableRow></TableHeader>
                            <TableBody>{filteredDeptos.map((depto) => (
                                <TableRow key={depto.id}>
                                  <TableCell>{depto.nombre}</TableCell><TableCell>{depto.areaNombre}</TableCell>
                                  <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => handleEdit(depto, setEditingDepto, setIsDeptoDialogOpen)} className="mr-2"><Edit2 className="h-4 w-4" /></Button>
                                    <Button variant="ghost" size="icon" onClick={() => promptDelete(depto.id, depto.nombre, 'departamento')} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                                  </TableCell>
                                </TableRow>
                              ))}</TableBody>
                          </Table></Card>) : 
                          <PlaceholderContent title="No hay departamentos" description="Comience agregando un nuevo departamento." icon={<Building2 className="h-12 w-12 text-muted-foreground" />} />}
                  </CardContent></Card>
            </TabsContent>

            <TabsContent value="puestos">
                 <Card><CardHeader><CardTitle>Puestos</CardTitle><CardDescription>Administrar los puestos o roles dentro de la organización.</CardDescription></CardHeader>
                  <CardContent>
                      <div className="flex justify-between items-center mb-4">
                        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" /><Input placeholder="Buscar puesto, área, depto..." value={puestoSearchTerm} onChange={(e) => setPuestoSearchTerm(e.target.value)} className="w-full pl-10" /></div>
                        <Button onClick={() => handleEdit(null, setEditingPuesto, setIsPuestoDialogOpen)}><PlusCircle className="mr-2 h-4 w-4" /> Agregar Puesto</Button>
                      </div>
                      {isLoading ? <PlaceholderContent title="Cargando..." description="" icon={<Loader2 className="h-12 w-12 text-muted-foreground animate-spin" />} /> :
                       filteredPuestos.length > 0 ? (
                        <Card><Table><TableHeader><TableRow><TableHead>Puesto</TableHead><TableHead>Área</TableHead><TableHead>Depto.</TableHead><TableHead>Nivel</TableHead><TableHead># Personas</TableHead><TableHead className="text-right w-[120px]">Acciones</TableHead></TableRow></TableHeader>
                            <TableBody>{filteredPuestos.map((puesto) => (
                                <TableRow key={puesto.id}>
                                  <TableCell>{puesto.nombre}</TableCell><TableCell>{puesto.areaNombre}</TableCell><TableCell>{puesto.deptoNombre}</TableCell><TableCell>{puesto.nivelOrganizacional}</TableCell><TableCell>{puesto.numeroPersonas || '-'}</TableCell>
                                  <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => handleEdit(puesto, setEditingPuesto, setIsPuestoDialogOpen)} className="mr-2"><Edit2 className="h-4 w-4" /></Button>
                                    <Button variant="ghost" size="icon" onClick={() => promptDelete(puesto.id, puesto.nombre, 'puesto')} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                                  </TableCell>
                                </TableRow>
                              ))}</TableBody>
                          </Table></Card>) : 
                          <PlaceholderContent title="No hay puestos" description="Comience agregando un nuevo puesto." icon={<Users className="h-12 w-12 text-muted-foreground" />} />}
                  </CardContent></Card>
            </TabsContent>
            
            <TabsContent value="sistemas">
                 <Card><CardHeader><CardTitle>Sistemas y Costos</CardTitle><CardDescription>Administrar los sistemas de software y sus costos asociados. Un sistema puede tener múltiples entradas de costo (ej. licencias y uso) que se suman para un total anual.</CardDescription></CardHeader>
                  <CardContent>
                      <div className="flex justify-between items-center mb-4">
                        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" /><Input placeholder="Buscar sistema..." value={sistemaSearchTerm} onChange={(e) => setSistemaSearchTerm(e.target.value)} className="w-full pl-10" /></div>
                        <Button onClick={() => handleEdit(null, setEditingSistema, setIsSistemaDialogOpen)}><PlusCircle className="mr-2 h-4 w-4" /> Agregar Sistema</Button>
                      </div>
                      {isLoading ? <PlaceholderContent title="Cargando..." description="" icon={<Loader2 className="h-12 w-12 text-muted-foreground animate-spin" />} /> :
                       filteredSistemas.length > 0 ? (
                        <Accordion type="single" collapsible className="w-full">
                          {filteredSistemas.map(sistema => (
                            <Card key={sistema.id} className="mb-2"><AccordionItem value={sistema.id} className="border-b-0">
                              <div className="flex w-full items-center p-4">
                                <AccordionTrigger className="flex-1 text-left hover:no-underline p-0">
                                    <div className="flex items-center gap-4">
                                        <span className="font-semibold">{sistema.nombre}</span>
                                        <Badge variant="outline">{sistema.scope}</Badge>
                                    </div>
                                </AccordionTrigger>
                                <div className="pr-4 pl-2 flex-shrink-0">
                                  <Button variant="ghost" size="icon" onClick={() => handleEdit(sistema, setEditingSistema, setIsSistemaDialogOpen)} className="mr-2"><Edit2 className="h-4 w-4" /></Button>
                                  <Button variant="ghost" size="icon" onClick={() => promptDelete(sistema.id, sistema.nombre, 'sistema')} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                                </div>
                              </div>
                              <AccordionContent className="p-4 pt-0">
                                {(() => {
                                  const annualCosts = calculateTotalAnnualCost(sistema.id);
                                  const systemCosts = costosSistemas.filter(c => c.sistemaId === sistema.id);

                                  return (
                                    <>
                                      <div className="p-4 border rounded-md bg-muted/30 mb-4">
                                        <h4 className="font-semibold text-sm text-muted-foreground">Costo Anual Total Estimado</h4>
                                        {annualCosts.length > 0 ? (
                                          annualCosts.map(({ currency, total }) => (
                                            <p key={currency} className="text-2xl font-bold text-primary">
                                              {new Intl.NumberFormat('es-MX', { style: 'currency', currency, currencyDisplay: 'code' }).format(total)}
                                            </p>
                                          ))
                                        ) : (
                                          <p className="text-2xl font-bold text-primary">
                                            {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'USD', currencyDisplay: 'code' }).format(0)}
                                          </p>
                                        )}
                                      </div>

                                      <div className="flex justify-end mb-2">
                                        <Button size="sm" variant="outline" onClick={() => { setCurrentSistemaForCosto(sistema); handleEdit(null, setEditingCosto, setIsCostoDialogOpen); }}><PlusCircle className="mr-2 h-4 w-4" /> Agregar costo</Button>
                                      </div>
                                      
                                      {systemCosts.length > 0 ? (
                                        <Table>
                                          <TableHeader><TableRow><TableHead>Descripción</TableHead><TableHead>Costo por Periodo</TableHead><TableHead>Periodo de Pago</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
                                          <TableBody>
                                            {systemCosts.map(costo => {
                                                const usageCost = costo.montoUso || 0;
                                                const licenseCost = (costo.costoPorLicencia || 0) * (costo.numeroLicencias || 0);
                                                const totalPeriodicCost = usageCost + licenseCost;
                                                return (
                                                  <TableRow key={costo.id}>
                                                    <TableCell>{costo.descripcion}</TableCell>
                                                    <TableCell>{costo.moneda ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: costo.moneda, currencyDisplay: 'code' }).format(totalPeriodicCost) : (totalPeriodicCost > 0 ? totalPeriodicCost.toFixed(2) : "-")}</TableCell>
                                                    <TableCell>{costo.frecuencia}</TableCell>
                                                    <TableCell className="text-right">
                                                      <Button variant="ghost" size="icon" onClick={() => { setCurrentSistemaForCosto(sistema); handleEdit(costo, setEditingCosto, setIsCostoDialogOpen); }} className="mr-2"><Edit2 className="h-4 w-4" /></Button>
                                                      <Button variant="ghost" size="icon" onClick={() => promptDelete(costo.id, `Costo de ${sistema.nombre}`, 'costoSistema')} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                                                    </TableCell>
                                                  </TableRow>
                                                )
                                            })}
                                          </TableBody>
                                        </Table>
                                      ) : (
                                        <p className="text-center text-sm text-muted-foreground mt-4">Este sistema no tiene detalles de costos registrados.</p>
                                      )}
                                    </>
                                  )
                                })()}
                              </AccordionContent>
                            </AccordionItem></Card>
                          ))}
                        </Accordion>) : 
                        <PlaceholderContent title="No hay sistemas" description="Comience agregando un nuevo sistema." icon={<Laptop className="h-12 w-12 text-muted-foreground" />} />}
                  </CardContent></Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      
      {/* Dialogs */}
      <Dialog open={isAreaDialogOpen} onOpenChange={setIsAreaDialogOpen}>
        <DialogContent><DialogHeader><DialogTitle>{editingArea ? 'Editar Área' : 'Agregar Área'}</DialogTitle></DialogHeader>
          <Form {...areaForm}><form onSubmit={areaForm.handleSubmit(handleAreaSubmit)} className="space-y-4 py-4">
            <FormField control={areaForm.control} name="nombre" render={({ field }) => (<FormItem><FormLabel>Nombre</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            <DialogFooter><DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose><Button type="submit">Guardar</Button></DialogFooter>
          </form></Form>
        </DialogContent>
      </Dialog>
      <Dialog open={isDeptoDialogOpen} onOpenChange={setIsDeptoDialogOpen}>
        <DialogContent><DialogHeader><DialogTitle>{editingDepto ? 'Editar Depto.' : 'Agregar Depto.'}</DialogTitle></DialogHeader>
          <Form {...deptoForm}><form onSubmit={deptoForm.handleSubmit(handleDeptoSubmit)} className="space-y-4 py-4">
            <FormField control={deptoForm.control} name="areaId" render={({ field }) => (<FormItem><FormLabel>Área</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione un área..." /></SelectTrigger></FormControl><SelectContent>{areas.map(a => <SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
            <FormField control={deptoForm.control} name="nombre" render={({ field }) => (<FormItem><FormLabel>Nombre</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            <DialogFooter><DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose><Button type="submit">Guardar</Button></DialogFooter>
          </form></Form>
        </DialogContent>
      </Dialog>
      <Dialog open={isPuestoDialogOpen} onOpenChange={setIsPuestoDialogOpen}>
        <DialogContent><DialogHeader><DialogTitle>{editingPuesto ? 'Editar Puesto' : 'Agregar Puesto'}</DialogTitle></DialogHeader>
          <Form {...puestoForm}><form onSubmit={puestoForm.handleSubmit(handlePuestoSubmit)} className="space-y-4 py-4">
            <FormField control={puestoForm.control} name="areaId" render={({ field }) => (<FormItem><FormLabel>Área</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione un área..." /></SelectTrigger></FormControl><SelectContent>{areas.map(a => <SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
            <FormField control={puestoForm.control} name="departamentoId" render={({ field }) => (<FormItem><FormLabel>Departamento (Opcional)</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione depto..." /></SelectTrigger></FormControl><SelectContent><SelectItem value="none">Sin Departamento</SelectItem>{filteredDeptosForPuestoForm.map(d => <SelectItem key={d.id} value={d.id}>{d.nombre}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
            <FormField control={puestoForm.control} name="nombre" render={({ field }) => (<FormItem><FormLabel>Nombre Puesto</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={puestoForm.control} name="nivelOrganizacional" render={({ field }) => (<FormItem><FormLabel>Nivel Organizacional</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione nivel..." /></SelectTrigger></FormControl><SelectContent>{nivelesOrganizacionales.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
            <FormField control={puestoForm.control} name="jefeInmediato" render={({ field }) => (<FormItem><FormLabel>Jefe Inmediato (Opcional)</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione jefe..." /></SelectTrigger></FormControl><SelectContent><SelectItem value="none">Ninguno</SelectItem>{puestos.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
            <FormField control={puestoForm.control} name="numeroPersonas" render={({ field }) => (<FormItem><FormLabel># Personas en el Puesto</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
            <DialogFooter><DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose><Button type="submit">Guardar</Button></DialogFooter>
          </form></Form>
        </DialogContent>
      </Dialog>
      <Dialog open={isSistemaDialogOpen} onOpenChange={setIsSistemaDialogOpen}>
        <DialogContent><DialogHeader><DialogTitle>{editingSistema ? 'Editar Sistema' : 'Agregar Sistema'}</DialogTitle></DialogHeader>
          <Form {...sistemaForm}><form onSubmit={sistemaForm.handleSubmit(handleSistemaSubmit)} className="space-y-4 py-4">
            <FormField control={sistemaForm.control} name="nombre" render={({ field }) => (<FormItem><FormLabel>Nombre</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={sistemaForm.control} name="scope" render={({ field }) => (<FormItem><FormLabel>Alcance</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione alcance..." /></SelectTrigger></FormControl><SelectContent>{sistemaScopeOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
            {watchedSistemaScope !== 'Empresa' && <FormField control={sistemaForm.control} name="scopeId" render={({ field }) => (<FormItem><FormLabel>Ámbito Específico</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder={`Seleccione ${watchedSistemaScope}...`} /></SelectTrigger></FormControl><SelectContent>{scopeOptions.map(o => <SelectItem key={o.id} value={o.id}>{o.nombre}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />}
            <DialogFooter><DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose><Button type="submit">Guardar</Button></DialogFooter>
          </form></Form>
        </DialogContent>
      </Dialog>
      <Dialog open={isCostoDialogOpen} onOpenChange={setIsCostoDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCosto ? 'Editar Costo' : 'Agregar costo'}</DialogTitle>
            <DialogDescription>Añada un componente de costo específico para el sistema {currentSistemaForCosto?.nombre}.</DialogDescription>
          </DialogHeader>
          <Form {...costoForm}>
            <form onSubmit={costoForm.handleSubmit(handleCostoSistemaSubmit)} className="space-y-4 py-4">
              <FormField
                  control={costoForm.control}
                  name="descripcion"
                  render={({ field }) => (
                      <FormItem>
                          <FormLabel>Descripción</FormLabel>
                          <FormControl><Textarea placeholder="Ej: Licencia anual equipo de ventas, Consumo mensual API..." {...field} /></FormControl>
                          <FormDescription>Identificador único para este costo específico.</FormDescription>
                          <FormMessage />
                      </FormItem>
                  )}
              />
              <div className="space-y-2 rounded-md border p-4">
                  <h4 className="font-medium text-sm">Por Uso del Sistema</h4>
                  <FormField control={costoForm.control} name="montoUso" render={({ field }) => (<FormItem><FormLabel>Monto por Uso</FormLabel><FormControl><Input type="number" placeholder="Ej: 100" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              </div>

              <div className="space-y-2 rounded-md border p-4">
                  <h4 className="font-medium text-sm">Por Licencias</h4>
                  <div className="grid grid-cols-2 gap-4">
                      <FormField control={costoForm.control} name="numeroLicencias" render={({ field }) => (<FormItem><FormLabel># Licencias</FormLabel><FormControl><Input type="number" placeholder="Ej: 10" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={costoForm.control} name="costoPorLicencia" render={({ field }) => (<FormItem><FormLabel>Costo/Licencia</FormLabel><FormControl><Input type="number" placeholder="Ej: 50" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                  </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField control={costoForm.control} name="frecuencia" render={({ field }) => (<FormItem><FormLabel>Frecuencia Pago</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione..."/></SelectTrigger></FormControl><SelectContent>{(frecuenciasDePagoOptions as readonly string[]).map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={costoForm.control} name="moneda" render={({ field }) => (<FormItem><FormLabel>Moneda</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione..."/></SelectTrigger></FormControl><SelectContent>{(tiposDeMonedaOptions as readonly string[]).map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
              </div>
              <FormField control={costoForm.control} name="formaPago" render={({ field }) => (<FormItem><FormLabel>Forma de Pago</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione..."/></SelectTrigger></FormControl><SelectContent>{(formasDePagoOptions as readonly string[]).map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
              
              <DialogFooter><DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose><Button type="submit">Guardar</Button></DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isConfirmDeleteDialogOpen} onOpenChange={setIsConfirmDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle><div className="flex items-center"><AlertTriangle className="h-5 w-5 mr-2 text-destructive" />Confirmar Eliminación</div></AlertDialogTitle><AlertDialogDescription>¿Está seguro de que desea eliminar "{itemToDelete?.name}"? Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel onClick={() => setItemToDelete(null)}>Cancelar</AlertDialogCancel><AlertDialogAction onClick={executeDelete} className={cn(buttonVariants({ variant: "destructive" }))}>Eliminar</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
