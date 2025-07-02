

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClipboardEdit, Save, ChevronDown, DollarSign, Clock, AlertTriangle, CalendarCheck2 } from "lucide-react";
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
import { useDepartamentos } from "@/contexts/DepartamentosContext";
import { usePuestos } from "@/contexts/PuestosContext";
import { useProcesos, capturaFormSchema, type CapturaFormData, frecuenciaOptions, monedaOptions, clasificacionOptions, auditFrequencyOptions } from '@/contexts/ProcesosContext';


const SPECIAL_ENTRADA_OPTION = "Iniciador";
const SPECIAL_SALIDA_OPTION = "Finalizador";
const NO_DEPARTAMENTO_SELECTED = "__NO_DEPARTAMENTO__";


const defaultFormValues: Partial<CapturaFormData> = {
  area: undefined,
  departamento: undefined,
  puesto: undefined,
  proceso: "",
  descripcion: "",
  clasificacion: "Privado",
  frecuencia: undefined,
  tiempoEstimado: undefined,
  tiempoIdeal: undefined,
  costoEstimado: undefined,
  costoIdeal: undefined,
  monedaCosto: undefined,
  informacionRecibe: "",
  procesosEntrada: [],
  informacionEntrega: "",
  procesosSalida: [],
  procedimientoOrder: [],
  politicasAsociadas: [],
  auditFrequencyInDays: undefined,
};


export default function CapturaPage() {
  const router = useRouter();
  const { areas, isLoading: isLoadingAreas } = useAreas();
  const { departamentos, isLoading: isLoadingDepartamentos } = useDepartamentos();
  const { puestos, isLoadingPuestos } = usePuestos();
  const { procesos: allProcesses, addProceso, isLoadingProcesos } = useProcesos();

  const [similarProcessWarning, setSimilarProcessWarning] = useState<string | null>(null);
  
  const isMounted = useRef(false);

  const form = useForm<CapturaFormData>({
    resolver: zodResolver(capturaFormSchema),
    defaultValues: defaultFormValues as CapturaFormData,
  });
  
  const { watch, setValue } = form;
  const watchedAreaName = watch('area');
  const watchedDepartamentoName = watch('departamento');
  const watchedProcessName = watch('proceso');
  
  const filteredDepartamentos = useMemo(() => {
    if (!watchedAreaName || isLoadingDepartamentos || isLoadingAreas) return [];
    const areaId = areas.find(a => a.nombre === watchedAreaName)?.id;
    if (!areaId) return [];
    return departamentos.filter(d => d.areaId === areaId);
  }, [watchedAreaName, areas, departamentos, isLoadingDepartamentos, isLoadingAreas]);

  const filteredPuestos = useMemo(() => {
    if (!watchedAreaName || isLoadingPuestos || isLoadingAreas) return [];
    const areaId = areas.find(a => a.nombre === watchedAreaName)?.id;
    if (!areaId) return [];
    
    const puestosInArea = puestos.filter(p => p.areaId === areaId);

    if (watchedDepartamentoName && watchedDepartamentoName !== NO_DEPARTAMENTO_SELECTED) {
      const deptoId = departamentos.find(d => d.nombre === watchedDepartamentoName && d.areaId === areaId)?.id;
      if (deptoId) {
        return puestosInArea.filter(p => p.departamentoId === deptoId);
      }
    }
    // Return puestos in area but not in any depto if 'Sin Departamento' is selected
    if (watchedDepartamentoName === NO_DEPARTAMENTO_SELECTED) {
       return puestosInArea.filter(p => !p.departamentoId);
    }

    return puestosInArea;
  }, [watchedAreaName, watchedDepartamentoName, areas, departamentos, puestos, isLoadingPuestos, isLoadingAreas, isLoadingDepartamentos]);

  
  useEffect(() => {
    if (watchedProcessName && allProcesses.length > 0) {
      const trimmedLowerName = watchedProcessName.trim().toLowerCase();
      if (!trimmedLowerName) {
        setSimilarProcessWarning(null);
        return;
      }
      
      const existingProcess = allProcesses.find(
        p => p.proceso.trim().toLowerCase() === trimmedLowerName && !p.deletedAt
      );
      
      if (existingProcess) {
        setSimilarProcessWarning(`Advertencia: ya existe un proceso con un nombre idéntico: "${existingProcess.proceso}" en el área de "${existingProcess.area}".`);
      } else {
        setSimilarProcessWarning(null);
      }
    } else {
      setSimilarProcessWarning(null);
    }
  }, [watchedProcessName, allProcesses]);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    if (isMounted.current) {
        setValue('departamento', undefined);
        setValue('puesto', undefined);
    }
  }, [watchedAreaName, setValue]);

  useEffect(() => {
    if (isMounted.current) {
        setValue('puesto', undefined);
    }
  }, [watchedDepartamentoName, setValue]);


  async function onSubmit(values: CapturaFormData) {
    try {
      const dataToSave: CapturaFormData = {
        ...values,
        departamento: values.departamento === NO_DEPARTAMENTO_SELECTED ? undefined : values.departamento,
        procesosEntrada: values.procesosEntrada || [],
        procesosSalida: values.procesosSalida || [],
        procedimientoOrder: values.procedimientoOrder || [],
      };
      
      const newProcess = await addProceso(dataToSave);

      if (newProcess) {
        toast({
          title: "Proceso Registrado",
          description: "El proceso ha sido guardado. Defina sus procedimientos a continuación.",
        });
        router.push(`/captura/${newProcess.id}/procedimientos`);
      } else {
        throw new Error("La función addProceso no retornó un proceso nuevo.");
      }

    } catch (error) {
      console.error("Error saving process:", error);
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
    specialOption?: string
  ) => {
    const currentSelectionNames = (field.value || [])
      .map((val: string) => {
        if (specialOption && val === specialOption) return specialOption;
        return options.find(opt => opt.nombre === val)?.nombre || val;
      })
      .filter(Boolean);
    
    let finalOptions = options;
    
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
            {finalOptions.length === 0 && !specialOption ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                No hay elementos configurados.
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
    .filter(p => !p.deletedAt) 
    .map(p => ({ id: p.id, nombre: p.proceso }));

  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center gap-2">
          <ClipboardEdit className="h-6 w-6 text-primary" />
          <CardTitle className="text-2xl font-headline">
            Módulo de Captura de Proceso
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription className="mb-6">
            Este es el punto de entrada principal para registrar de forma detallada todos los procesos operativos. Después de guardar, podrá definir sus procedimientos y actividades.
          </CardDescription>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField
                  control={form.control}
                  name="area"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Área / División</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          form.setValue('departamento', undefined);
                          form.setValue('puesto', undefined);
                        }}
                        value={field.value}
                        disabled={isLoadingAreas}
                      >
                        <FormControl><SelectTrigger><SelectValue placeholder={isLoadingAreas ? "Cargando..." : "Seleccione un área"} /></SelectTrigger></FormControl>
                        <SelectContent>{areas.map((area) => (<SelectItem key={area.id} value={area.nombre}>{area.nombre}</SelectItem>))}</SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="departamento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Departamento (Opcional)</FormLabel>
                       <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          form.setValue('puesto', undefined);
                        }}
                        value={field.value}
                        disabled={!watchedAreaName || isLoadingDepartamentos || filteredDepartamentos.length === 0}
                      >
                        <FormControl><SelectTrigger><SelectValue placeholder={!watchedAreaName ? "Seleccione un área primero" : (filteredDepartamentos.length === 0 ? "Sin deptos. para esta área" : "Seleccione un depto.")} /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value={NO_DEPARTAMENTO_SELECTED}>Sin Departamento</SelectItem>
                          {filteredDepartamentos.map((depto) => (<SelectItem key={depto.id} value={depto.nombre}>{depto.nombre}</SelectItem>))}
                        </SelectContent>
                      </Select>
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
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={!watchedAreaName || isLoadingPuestos || filteredPuestos.length === 0}
                      >
                        <FormControl><SelectTrigger><SelectValue placeholder={!watchedAreaName ? "Seleccione un área primero" : "Seleccione un puesto"} /></SelectTrigger></FormControl>
                        <SelectContent>{filteredPuestos.map((puesto) => (<SelectItem key={puesto.id} value={puesto.nombre}>{puesto.nombre}</SelectItem>))}</SelectContent>
                      </Select>
                      <FormDescription>Puestos disponibles para el área/depto. seleccionado.</FormDescription>
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
                      <Input placeholder="Ej: Gestión de Pedidos de Clientes, Cierre Contable Mensual" {...field} />
                    </FormControl>
                     {similarProcessWarning ? (<FormDescription className="text-amber-600 flex items-center gap-1 pt-1"><AlertTriangle className="h-4 w-4" /> {similarProcessWarning}</FormDescription>) : (<FormDescription>Ingrese el nombre descriptivo del proceso que está capturando.</FormDescription>)}
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
                    <FormControl><Textarea placeholder="Describa el objetivo, alcance, inicio, fin y los pasos principales del proceso." className="min-h-[120px]" {...field} /></FormControl>
                    <FormDescription>Proporcione una explicación clara y concisa del proceso.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="clasificacion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Clasificación de Visibilidad</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Seleccione la clasificación" /></SelectTrigger></FormControl>
                        <SelectContent>{(clasificacionOptions as readonly string[]).map((option) => (<SelectItem key={option} value={option}>{option}</SelectItem>))}</SelectContent>
                      </Select>
                      <FormDescription>Define quién podrá ver la información de este proceso.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="auditFrequencyInDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Frecuencia de Auditoría</FormLabel>
                       <Select onValueChange={field.onChange} value={field.value?.toString()}>
                        <FormControl><SelectTrigger><CalendarCheck2 className="mr-2 h-4 w-4" /><SelectValue placeholder="Seleccione la frecuencia de auditoría" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="none">No requiere auditoría periódica</SelectItem>
                          {auditFrequencyOptions.map((opt) => (<SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>))}
                        </SelectContent>
                      </Select>
                      <FormDescription>Define cada cuánto debe auditarse este proceso.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
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
                      <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione la frecuencia" /></SelectTrigger></FormControl>
                        <SelectContent>{(frecuenciaOptions as readonly string[]).map((option) => (<SelectItem key={option} value={option}>{option}</SelectItem>))}</SelectContent>
                      </Select>
                      <FormDescription>Periodicidad con la que se realiza este proceso.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField control={form.control} name="monedaCosto" render={({ field }) => (<FormItem><FormLabel>Moneda de Costos</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione una moneda" /></SelectTrigger></FormControl><SelectContent>{(monedaOptions as readonly string[]).map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select><FormDescription>Moneda para los costos del proceso.</FormDescription><FormMessage /></FormItem>)} />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 <FormField control={form.control} name="tiempoEstimado" render={({ field }) => (<FormItem><FormLabel>Tiempo Estimado (min)</FormLabel><div className="relative"><Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><FormControl><Input type="number" placeholder="Ej: 60" {...field} value={field.value ?? ''} min="0" className="pl-9" /></FormControl></div><FormMessage /></FormItem>)} />
                 <FormField control={form.control} name="tiempoIdeal" render={({ field }) => (<FormItem><FormLabel>Tiempo Ideal (min)</FormLabel><div className="relative"><Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><FormControl><Input type="number" placeholder="Ej: 45" {...field} value={field.value ?? ''} min="0" className="pl-9" /></FormControl></div><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="costoEstimado" render={({ field }) => (<FormItem><FormLabel>Costo Estimado</FormLabel><div className="relative"><DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><FormControl><Input type="number" placeholder="Ej: 100" {...field} value={field.value ?? ''} min="0" step="any" className="pl-9"/></FormControl></div><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="costoIdeal" render={({ field }) => (<FormItem><FormLabel>Costo Ideal</FormLabel><div className="relative"><DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><FormControl><Input type="number" placeholder="Ej: 80" {...field} value={field.value ?? ''} min="0" step="any" className="pl-9"/></FormControl></div><FormMessage /></FormItem>)} />
              </div>

              <div className="space-y-2">
                 <h3 className="text-lg font-medium">Flujo de Información Asociado</h3>
                 <p className="text-sm text-muted-foreground">Detalle las entradas, salidas y transformaciones clave de información.</p>
              </div>

              <FormField control={form.control} name="informacionRecibe" render={({ field }) => (<FormItem><FormLabel>Información que Recibe (Entradas)</FormLabel><FormControl><Textarea placeholder="Describa la información o documentos que el proceso recibe como entrada..." className="min-h-[80px]" {...field} /></FormControl><FormDescription>Detalle qué información es necesaria para iniciar o ejecutar el proceso.</FormDescription><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="procesosEntrada" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Procesos de Entradas (Opcional)</FormLabel>{renderMultiSelectDropdown(field, "Procesos Disponibles y Opción Especial", "Seleccionar procesos de entrada...", availableProcessesForSelection, isLoadingProcesos, SPECIAL_ENTRADA_OPTION)}<FormDescription>Seleccione procesos capturados que preceden o inician este, o marque como 'Iniciador'.</FormDescription><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="informacionEntrega" render={({ field }) => (<FormItem><FormLabel>Información que Entrega (Salidas)</FormLabel><FormControl><Textarea placeholder="Describa la información o documentos que el proceso genera o entrega como resultado..." className="min-h-[80px]" {...field} /></FormControl><FormDescription>Detalle cuál es el producto o resultado informativo del proceso.</FormDescription><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="procesosSalida" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Procesos de Salida (Opcional)</FormLabel>{renderMultiSelectDropdown(field, "Procesos Disponibles y Opción Especial", "Seleccionar procesos de salida...", availableProcessesForSelection, isLoadingProcesos, SPECIAL_SALIDA_OPTION)}<FormDescription>Seleccione procesos capturados que siguen a este, o marque como 'Finalizador'.</FormDescription><FormMessage /></FormItem>)} />

              <div className="flex justify-end space-x-2">
                <Button type="submit" size="lg"><Save className="mr-2 h-5 w-5" />Guardar Proceso y Definir Procedimientos</Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
