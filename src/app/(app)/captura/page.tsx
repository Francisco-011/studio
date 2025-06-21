
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { parseISO, isValid } from 'date-fns';

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClipboardEdit, Save, ChevronDown, DollarSign, Clock, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useAreas } from "@/contexts/AreasContext";
import { usePuestos } from "@/contexts/PuestosContext";
import { useSistemasCostos, type Sistema } from '@/contexts/SistemasCostosContext';
import type { CapturedProcess } from '../procesos-y-flujos-registrados/page';


export const frecuenciaOptions = ["Diario", "Semanal", "Quincenal", "Mensual", "Bimestral", "Trimestral", "Semestral", "Anual", "A demanda", "Otro"] as const;
export const monedaOptions = ["USD", "MXN", "EUR", "CAD", "GBP"] as const;
export type Moneda = typeof monedaOptions[number];

const capturaFormSchema = z.object({
  area: z.string().min(1, "El área es requerida."),
  puesto: z.string().min(1, "El puesto es requerido."),
  proceso: z.string().min(3, "El nombre del proceso es requerido y debe tener al menos 3 caracteres."),
  descripcion: z.string().min(1, "La descripción del proceso es requerida."),
  frecuencia: z.enum(frecuenciaOptions, { errorMap: () => ({ message: "Seleccione una frecuencia válida."}) }),
  tiempoEstimado: z.preprocess(
    (val) => (String(val).trim() === '' ? undefined : parseInt(String(val), 10)),
    z.number().int("El tiempo debe ser un número entero.").nonnegative("El tiempo estimado debe ser un número positivo o cero.").optional()
  ),
  tiempoIdeal: z.preprocess(
    (val) => (String(val).trim() === '' ? undefined : parseInt(String(val), 10)),
    z.number().int("El tiempo debe ser un número entero.").nonnegative("El tiempo ideal debe ser un número positivo o cero.").optional()
  ),
  costoEstimado: z.preprocess(
    (val) => (String(val).trim() === '' ? undefined : parseFloat(String(val))),
    z.number().nonnegative("El costo estimado debe ser un número positivo.").optional()
  ),
  costoIdeal: z.preprocess(
    (val) => (String(val).trim() === '' ? undefined : parseFloat(String(val))),
    z.number().nonnegative("El costo ideal debe ser un número positivo.").optional()
  ),
  monedaCosto: z.enum(monedaOptions).optional(),
  sistemas: z.array(z.string()).optional().default([]),
  informacionRecibe: z.string().min(1, "La descripción de la información que recibe es requerida."),
  procesosEntrada: z.array(z.string()).optional().default([]),
  informacionEntrega: z.string().min(1, "La descripción de la información que entrega es requerida."),
  procesosSalida: z.array(z.string()).optional().default([]),
  activityOrder: z.array(z.string()).optional().default([]),
}).refine(data => {
  if ((data.costoEstimado !== undefined || data.costoIdeal !== undefined) && !data.monedaCosto) {
    return false;
  }
  return true;
}, {
  message: "Debe seleccionar una moneda si especifica un costo.",
  path: ["monedaCosto"],
});


export type CapturaFormData = z.infer<typeof capturaFormSchema>;

const CAPTURED_DATA_LOCAL_STORAGE_KEY = 'proceza-captured-data';
const SPECIAL_ENTRADA_OPTION = "Iniciador";
const SPECIAL_SALIDA_OPTION = "Finalizador";

const defaultFormValues: Partial<CapturaFormData> = {
  area: undefined,
  puesto: undefined,
  proceso: "",
  descripcion: "",
  frecuencia: undefined,
  tiempoEstimado: undefined,
  tiempoIdeal: undefined,
  costoEstimado: undefined,
  costoIdeal: undefined,
  monedaCosto: undefined,
  sistemas: [],
  informacionRecibe: "",
  procesosEntrada: [],
  informacionEntrega: "",
  procesosSalida: [],
  activityOrder: [],
};


export default function CapturaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { areas, isLoading: isLoadingAreas } = useAreas();
  const { puestos, isLoadingPuestos } = usePuestos();
  const { sistemas: allConfiguredSistemas, isLoadingSistemasCostos } = useSistemasCostos();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [allProcesses, setAllProcesses] = useState<CapturedProcess[]>([]);
  const [similarProcessWarning, setSimilarProcessWarning] = useState<string | null>(null);


  const form = useForm<CapturaFormData>({
    resolver: zodResolver(capturaFormSchema),
    defaultValues: defaultFormValues as CapturaFormData,
  });
  
  const watchedAreaName = form.watch('area');
  const watchedPuestoName = form.watch('puesto');
  const watchedProcessName = form.watch('proceso');


  const availableSistemasForForm = useMemo(() => {
    if (isLoadingSistemasCostos || isLoadingAreas || isLoadingPuestos) return [];

    const selectedAreaObj = areas.find(a => a.nombre === watchedAreaName);
    const selectedPuestoObj = puestos.find(p => p.nombre === watchedPuestoName);

    return allConfiguredSistemas.filter(sistema => {
      if (sistema.scope === "Empresa") return true;
      if (sistema.scope === "Área" && selectedAreaObj && sistema.scopeId === selectedAreaObj.id) return true;
      if (sistema.scope === "Puesto" && selectedPuestoObj && sistema.scopeId === selectedPuestoObj.id) return true;
      return false;
    });
  }, [allConfiguredSistemas, watchedAreaName, watchedPuestoName, areas, puestos, isLoadingSistemasCostos, isLoadingAreas, isLoadingPuestos]);


  useEffect(() => {
    try {
      const storedData = localStorage.getItem(CAPTURED_DATA_LOCAL_STORAGE_KEY);
      if (storedData) {
        const parsedData: any[] = JSON.parse(storedData);
        // Data migration for older records
        const migratedData: CapturedProcess[] = parsedData.map(p => {
          const newP: any = {
            ...p,
            activo: p.activo === undefined ? true : p.activo,
            activityOrder: p.activityOrder || [],
            updatedAt: p.updatedAt || (p.capturedAt && isValid(parseISO(p.capturedAt)) ? parseISO(p.capturedAt).getTime() : Date.now()),
            sistemas: p.sistemas || [],
            tiempoIdeal: p.tiempoIdeal,
            costoEstimado: p.costoEstimado,
            costoIdeal: p.costoIdeal,
            monedaCosto: p.monedaCosto,
          };
          if (!newP.procesosEntrada && p.formatosRecibe) {
            newP.procesosEntrada = Array.isArray(p.formatosRecibe) ? p.formatosRecibe : [p.formatosRecibe];
          }
          if (!newP.procesosSalida && p.formatosEntrega) {
            newP.procesosSalida = Array.isArray(p.formatosEntrega) ? p.formatosEntrega : [p.formatosEntrega];
          }
          delete newP.formatosRecibe;
          delete newP.formatosEntrega;
          return newP;
        });
        setAllProcesses(migratedData);
      }
    } catch (error) {
      console.error("Error loading all processes from localStorage for dropdowns:", error);
      toast({ title: "Error al Cargar Procesos", description: "No se pudieron cargar los procesos para las listas de selección.", variant: "destructive" });
    }
  }, []);

  useEffect(() => {
    const editIdFromQuery = searchParams.get('editId');
  
    if (editIdFromQuery) {
      if (editingId !== editIdFromQuery) {
        setEditingId(editIdFromQuery);
      }
  
      if (!isLoadingAreas && !isLoadingPuestos && allProcesses.length > 0) {
        const processToEdit = allProcesses.find(p => p.id === editIdFromQuery);
        
        if (processToEdit) {
          // Merge with defaults to ensure all fields are present on the form
          const formValues = {
            ...(defaultFormValues as CapturaFormData),
            ...processToEdit,
          };
          form.reset(formValues);
        } else {
          toast({ title: "Error", description: "No se encontró el proceso para editar.", variant: "destructive" });
          if (editingId !== null) setEditingId(null); 
          router.push('/procesos-y-flujos-registrados');
        }
      }
    } else {
      if (editingId !== null) { 
          setEditingId(null);
          form.reset(defaultFormValues as CapturaFormData);
      }
    }
  }, [searchParams, form, router, isLoadingAreas, isLoadingPuestos, editingId, allProcesses]);
  
  useEffect(() => {
    if (watchedProcessName && allProcesses.length > 0) {
      const trimmedLowerName = watchedProcessName.trim().toLowerCase();
      if (!trimmedLowerName) {
        setSimilarProcessWarning(null);
        return;
      }
      
      const existingProcess = allProcesses.find(
        p => p.id !== editingId && p.proceso.trim().toLowerCase() === trimmedLowerName && !p.deletedAt
      );
      
      if (existingProcess) {
        setSimilarProcessWarning(`Advertencia: ya existe un proceso con un nombre idéntico: "${existingProcess.proceso}" en el área de "${existingProcess.area}".`);
      } else {
        setSimilarProcessWarning(null);
      }
    } else {
      setSimilarProcessWarning(null);
    }
  }, [watchedProcessName, allProcesses, editingId]);


  function onSubmit(values: CapturaFormData) {
    try {
      const existingDataString = localStorage.getItem(CAPTURED_DATA_LOCAL_STORAGE_KEY);
      let existingData: CapturedProcess[] = existingDataString ? JSON.parse(existingDataString) : [];
      const currentTime = new Date().getTime();

      const dataToSave: CapturaFormData = {
        ...values,
        procesosEntrada: values.procesosEntrada || [],
        procesosSalida: values.procesosSalida || [],
        activityOrder: values.activityOrder || [],
      };

      if (editingId) {
        const processToUpdate = existingData.find(p => p.id === editingId);
        if (processToUpdate) {
            const updatedProcess: CapturedProcess = {
                ...(processToUpdate as any), 
                ...dataToSave, 
                activo: processToUpdate.activo === undefined ? true : processToUpdate.activo,
                updatedAt: currentTime,
            };
            delete (updatedProcess as any).formatosRecibe;
            delete (updatedProcess as any).formatosEntrega;

            existingData = existingData.map(p => p.id === editingId ? updatedProcess : p);
            localStorage.setItem(CAPTURED_DATA_LOCAL_STORAGE_KEY, JSON.stringify(existingData));
            toast({
                title: "Proceso Actualizado",
                description: "La información del proceso ha sido actualizada exitosamente.",
            });
            router.push('/procesos-y-flujos-registrados'); 
        } else {
             toast({ title: "Error", description: "No se encontró el proceso para actualizar.", variant: "destructive" });
        }
      } else { // Creating a new process
        const newProcess: CapturedProcess = {
          ...dataToSave,
          id: Date.now().toString(),
          capturedAt: new Date().toISOString(),
          updatedAt: currentTime,
          activo: true, 
        };
        existingData.push(newProcess);
        localStorage.setItem(CAPTURED_DATA_LOCAL_STORAGE_KEY, JSON.stringify(existingData));
        toast({
          title: "Proceso Registrado",
          description: "El proceso ha sido guardado. Defina sus actividades a continuación.",
        });
        router.push(`/captura/${newProcess.id}/actividades`);
      }
    } catch (error) {
      console.error("Error saving to localStorage:", error);
      toast({
        title: "Error al Guardar",
        description: "No se pudo guardar el proceso. Revise la consola para más detalles.",
        variant: "destructive",
      });
    }
  }

  const renderMultiSelectDropdown = (
    field: any, 
    label: string,
    placeholder: string,
    options: { id: string; nombre: string }[],
    isLoading: boolean,
    specialOption?: string,
    dropdownType: 'sistemas' | 'procesos' = 'procesos'
  ) => {
    const currentSelectionNames = (field.value || [])
      .map((val: string) => {
        if (specialOption && val === specialOption) return specialOption;
        return options.find(opt => opt.nombre === val)?.nombre || val;
      })
      .filter(Boolean);
    
    let finalOptions = options;
    if (dropdownType === 'sistemas') {
        const currentSelectedSystemNames = new Set(field.value || []);
        const additionalSelectedSystems = allConfiguredSistemas.filter(
            sys => currentSelectedSystemNames.has(sys.nombre) && !options.some(opt => opt.id === sys.id)
        );
        finalOptions = [...options, ...additionalSelectedSystems.map(s => ({id: s.id, nombre: s.nombre}))]
                        .filter((option, index, self) => index === self.findIndex(o => o.id === option.id)) // distinct by id
                        .sort((a,b) => a.nombre.localeCompare(b.nombre)); 
    }


    return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <FormControl>
          <Button variant="outline" className="w-full justify-between text-left font-normal h-auto min-h-10">
            {currentSelectionNames.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {currentSelectionNames.map((itemName: string) => (
                  <Badge key={itemName} variant="secondary" className="font-normal">
                    {itemName}
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="text-muted-foreground">{isLoading ? "Cargando opciones..." : placeholder}</span>
            )}
            <ChevronDown className="ml-auto h-4 w-4 opacity-50 shrink-0" />
          </Button>
        </FormControl>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]" align="start">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isLoading ? (
           <div className="px-2 py-1.5 text-sm text-muted-foreground">Cargando...</div>
        ) : (
          <>
            {specialOption && (
              <DropdownMenuCheckboxItem
                key={specialOption}
                checked={field.value?.includes(specialOption)}
                onCheckedChange={(checked) => {
                  const currentSelected = field.value || [];
                  if (checked) {
                    field.onChange([...currentSelected, specialOption]);
                  } else {
                    field.onChange(currentSelected.filter((s: string) => s !== specialOption));
                  }
                }}
              >
                {specialOption}
              </DropdownMenuCheckboxItem>
            )}
            {finalOptions.length === 0 && !specialOption && dropdownType !== 'sistemas' ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                No hay elementos configurados.
              </div>
            ) : finalOptions.length === 0 && !specialOption && dropdownType === 'sistemas' ? (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    No hay sistemas disponibles para el Área/Puesto actual o no hay sistemas configurados.
                </div>
            ) : (
              finalOptions.map((option) => (
                <DropdownMenuCheckboxItem
                  key={option.id}
                  checked={field.value?.includes(option.nombre)}
                  onCheckedChange={(checked) => {
                    const currentSelected = field.value || [];
                    if (checked) {
                      field.onChange([...currentSelected, option.nombre]);
                    } else {
                      field.onChange(currentSelected.filter((s: string) => s !== option.nombre));
                    }
                  }}
                >
                  {option.nombre}
                </DropdownMenuCheckboxItem>
              ))
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )};
  
  const availableProcessesForSelection = allProcesses
    .filter(p => !p.deletedAt && p.id !== editingId) 
    .map(p => ({ id: p.id, nombre: p.proceso }));

  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center gap-2">
          <ClipboardEdit className="h-6 w-6 text-primary" />
          <CardTitle className="text-2xl font-headline">
            {editingId ? "Editar Proceso Capturado" : "Módulo de Captura de Proceso"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-6">
            {editingId 
              ? "Modifique los detalles del proceso seleccionado."
              : "Este es el punto de entrada principal para registrar de forma detallada todos los procesos operativos. Después de guardar, podrá definir sus actividades."
            }
          </p>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="area"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Área / Departamento</FormLabel>
                      <Select
                        onValueChange={(value) => {
                            field.onChange(value);
                            const currentSelectedSystems = form.getValues('sistemas') || [];
                            if (currentSelectedSystems.length > 0) {
                                const selectedAreaObj = areas.find(a => a.nombre === value);
                                const selectedPuestoObj = puestos.find(p => p.nombre === form.getValues('puesto'));
                                
                                const validSystemsForNewContext = allConfiguredSistemas.filter(sistema => {
                                    if (sistema.scope === "Empresa") return true;
                                    if (sistema.scope === "Área" && selectedAreaObj && sistema.scopeId === selectedAreaObj.id) return true;
                                    if (sistema.scope === "Puesto" && selectedPuestoObj && sistema.scopeId === selectedPuestoObj.id) return true;
                                    return false;
                                }).map(s => s.nombre);
                                
                                const newSelectedSystems = currentSelectedSystems.filter(sName => validSystemsForNewContext.includes(sName));
                                if (newSelectedSystems.length !== currentSelectedSystems.length) {
                                    form.setValue('sistemas', newSelectedSystems);
                                    toast({title: "Sistemas Ajustados", description: "Algunos sistemas seleccionados fueron removidos por no aplicar al nuevo contexto de Área/Puesto.", variant:"default"});
                                }
                            }
                        }}
                        value={field.value}
                        disabled={isLoadingAreas}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={isLoadingAreas ? "Cargando áreas..." : "Seleccione un área"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {isLoadingAreas ? (
                            <SelectItem value="loading" disabled>Cargando áreas...</SelectItem>
                          ) : areas.length === 0 ? (
                            <SelectItem value="no-areas" disabled>No hay áreas configuradas</SelectItem>
                          ) : (
                            areas.map((area) => (
                              <SelectItem key={area.id} value={area.nombre}>
                                {area.nombre}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        El área o departamento al que pertenece el proceso.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="puesto"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Puesto / Rol Principal</FormLabel>
                       <Select
                        onValueChange={(value) => {
                            field.onChange(value);
                            const currentSelectedSystems = form.getValues('sistemas') || [];
                             if (currentSelectedSystems.length > 0) {
                                const selectedAreaObj = areas.find(a => a.nombre === form.getValues('area'));
                                const selectedPuestoObj = puestos.find(p => p.nombre === value);
                                
                                const validSystemsForNewContext = allConfiguredSistemas.filter(sistema => {
                                    if (sistema.scope === "Empresa") return true;
                                    if (sistema.scope === "Área" && selectedAreaObj && sistema.scopeId === selectedAreaObj.id) return true;
                                    if (sistema.scope === "Puesto" && selectedPuestoObj && sistema.scopeId === selectedPuestoObj.id) return true;
                                    return false;
                                }).map(s => s.nombre);
                                
                                const newSelectedSystems = currentSelectedSystems.filter(sName => validSystemsForNewContext.includes(sName));
                                 if (newSelectedSystems.length !== currentSelectedSystems.length) {
                                    form.setValue('sistemas', newSelectedSystems);
                                     toast({title: "Sistemas Ajustados", description: "Algunos sistemas seleccionados fueron removidos por no aplicar al nuevo contexto de Área/Puesto.", variant:"default"});
                                }
                            }
                        }}
                        value={field.value}
                        disabled={isLoadingPuestos}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={isLoadingPuestos ? "Cargando puestos..." : "Seleccione un puesto"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {isLoadingPuestos ? (
                            <SelectItem value="loading" disabled>Cargando puestos...</SelectItem>
                          ) : puestos.length === 0 ? (
                            <SelectItem value="no-puestos" disabled>No hay puestos configurados</SelectItem>
                          ) : (
                            puestos.map((puesto) => (
                              <SelectItem key={puesto.id} value={puesto.nombre}>
                                {puesto.nombre}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        El puesto o rol responsable principal del proceso.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="proceso"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre del Proceso</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ej: Gestión de Pedidos de Clientes, Cierre Contable Mensual" 
                        {...field} 
                      />
                    </FormControl>
                     {similarProcessWarning ? (
                        <FormDescription className="text-amber-600 flex items-center gap-1 pt-1">
                          <AlertTriangle className="h-4 w-4" /> {similarProcessWarning}
                        </FormDescription>
                      ) : (
                        <FormDescription>
                          Ingrese el nombre descriptivo del proceso que está capturando.
                        </FormDescription>
                      )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="descripcion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción Detallada del Proceso</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describa el objetivo, alcance, inicio, fin y los pasos principales del proceso."
                        className="min-h-[120px]"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Proporcione una explicación clara y concisa del proceso.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="space-y-2">
                 <h3 className="text-lg font-medium">Métricas del Proceso</h3>
                 <p className="text-sm text-muted-foreground">Establezca los tiempos y costos estimados vs. ideales para este proceso.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="frecuencia"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Frecuencia</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccione la frecuencia" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {frecuenciaOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Periodicidad con la que se realiza este proceso.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                    control={form.control}
                    name="monedaCosto"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Moneda de Costos</FormLabel>
                         <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Seleccione una moneda" /></SelectTrigger></FormControl>
                            <SelectContent>
                              {monedaOptions.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                            </SelectContent>
                         </Select>
                         <FormDescription>Moneda para los costos del proceso.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 <FormField
                  control={form.control}
                  name="tiempoEstimado"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tiempo Estimado (min)</FormLabel>
                       <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <FormControl><Input type="number" placeholder="Ej: 60" {...field} value={field.value ?? ''} min="0" className="pl-9" /></FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="tiempoIdeal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tiempo Ideal (min)</FormLabel>
                       <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <FormControl><Input type="number" placeholder="Ej: 45" {...field} value={field.value ?? ''} min="0" className="pl-9" /></FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="costoEstimado"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Costo Estimado</FormLabel>
                       <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <FormControl><Input type="number" placeholder="Ej: 100" {...field} value={field.value ?? ''} min="0" step="any" className="pl-9"/></FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="costoIdeal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Costo Ideal</FormLabel>
                       <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <FormControl><Input type="number" placeholder="Ej: 80" {...field} value={field.value ?? ''} min="0" step="any" className="pl-9"/></FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="sistemas"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Sistemas / Aplicaciones Utilizadas (Opcional)</FormLabel>
                     {renderMultiSelectDropdown(field, "Sistemas Disponibles", "Seleccionar sistemas...", availableSistemasForForm, isLoadingSistemasCostos || isLoadingAreas || isLoadingPuestos, undefined, 'sistemas')}
                    <FormDescription>
                      Seleccione los sistemas o software involucrados en la ejecución del proceso. La lista se filtra según el Área y Puesto seleccionados.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="space-y-2">
                 <h3 className="text-lg font-medium">Flujo de Información Asociado</h3>
                 <p className="text-sm text-muted-foreground">Detalle las entradas, salidas y transformaciones clave de información.</p>
              </div>

              <FormField
                control={form.control}
                name="informacionRecibe"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Información que Recibe (Entradas)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describa la información o documentos que el proceso recibe como entrada (Ej: Solicitud de compra del cliente, Factura de proveedor, Reporte de ventas anterior)."
                        className="min-h-[80px]"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Detalle qué información es necesaria para iniciar o ejecutar el proceso.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="procesosEntrada"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Procesos de Entradas (Opcional)</FormLabel>
                    {renderMultiSelectDropdown(field, "Procesos Disponibles y Opción Especial", "Seleccionar procesos de entrada...", availableProcessesForSelection, allProcesses.length === 0 && !editingId, SPECIAL_ENTRADA_OPTION)}
                    <FormDescription>
                      Seleccione procesos capturados que preceden o inician este, o marque como 'Iniciador'.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="informacionEntrega"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Información que Entrega (Salidas)</FormLabel>
                     <FormControl>
                      <Textarea
                        placeholder="Describa la información o documentos que el proceso genera o entrega como resultado (Ej: Propuesta comercial enviada, Pedido procesado, Reporte financiero mensual)."
                        className="min-h-[80px]"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Detalle cuál es el producto o resultado informativo del proceso.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="procesosSalida"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Procesos de Salida (Opcional)</FormLabel>
                    {renderMultiSelectDropdown(field, "Procesos Disponibles y Opción Especial", "Seleccionar procesos de salida...", availableProcessesForSelection, allProcesses.length === 0 && !editingId, SPECIAL_SALIDA_OPTION)}
                    <FormDescription>
                      Seleccione procesos capturados que siguen a este, o marque como 'Finalizador'.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-2">
                {editingId && (
                   <Button type="button" variant="outline" onClick={() => router.push('/procesos-y-flujos-registrados')}>
                    Cancelar
                  </Button>
                )}
                <Button type="submit" size="lg">
                  <Save className="mr-2 h-5 w-5" />
                  {editingId ? "Guardar Cambios" : "Guardar Proceso y Definir Actividades"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
    
