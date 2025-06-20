
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

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
import { ClipboardEdit, Save, ChevronDown } from "lucide-react";
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
import { useSistemasCostos } from '@/contexts/SistemasCostosContext'; // Import context
import type { CapturedProcess } from '../procesos-y-flujos-registrados/page';

// Removed: export const availableSystems

export const frecuenciaOptions = ["Diario", "Semanal", "Quincenal", "Mensual", "Bimestral", "Trimestral", "Semestral", "Anual", "A demanda", "Otro"] as const; // Export

const capturaFormSchema = z.object({
  area: z.string().min(1, "El área es requerida."),
  puesto: z.string().min(1, "El puesto es requerido."),
  proceso: z.string().min(3, "El nombre del proceso es requerido y debe tener al menos 3 caracteres."),
  descripcion: z.string().min(1, "La descripción del proceso es requerida."),
  tiempoEstimado: z.preprocess(
    (val) => (String(val).trim() === '' ? undefined : parseInt(String(val), 10)),
    z.number().int("El tiempo debe ser un número entero.").nonnegative("El tiempo estimado debe ser un número positivo o cero.").optional()
  ),
  frecuencia: z.enum(frecuenciaOptions, { errorMap: () => ({ message: "Seleccione una frecuencia válida."}) }),
  sistemas: z.array(z.string()).optional().default([]),
  informacionRecibe: z.string().min(1, "La descripción de la información que recibe es requerida."),
  procesosEntrada: z.array(z.string()).optional().default([]),
  informacionEntrega: z.string().min(1, "La descripción de la información que entrega es requerida."),
  procesosSalida: z.array(z.string()).optional().default([]),
  activityOrder: z.array(z.string()).optional().default([]),
});

export type CapturaFormData = z.infer<typeof capturaFormSchema>;

const CAPTURED_DATA_LOCAL_STORAGE_KEY = 'proceza-captured-data';
const SPECIAL_ENTRADA_OPTION = "Iniciador";
const SPECIAL_SALIDA_OPTION = "Finalizador";

export default function CapturaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { areas, isLoading: isLoadingAreas } = useAreas();
  const { puestos, isLoadingPuestos } = usePuestos();
  const { sistemas, isLoadingSistemasCostos } = useSistemasCostos(); // Use context for sistemas

  const [editingId, setEditingId] = useState<string | null>(null);
  const [allProcesses, setAllProcesses] = useState<CapturedProcess[]>([]);

  const form = useForm<CapturaFormData>({
    resolver: zodResolver(capturaFormSchema),
    defaultValues: {
      area: "",
      puesto: "",
      proceso: "",
      descripcion: "",
      tiempoEstimado: undefined,
      frecuencia: undefined,
      sistemas: [],
      informacionRecibe: "",
      procesosEntrada: [],
      informacionEntrega: "",
      procesosSalida: [],
      activityOrder: [],
    },
  });

  useEffect(() => {
    try {
      const storedData = localStorage.getItem(CAPTURED_DATA_LOCAL_STORAGE_KEY);
      if (storedData) {
        setAllProcesses(JSON.parse(storedData));
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
        try {
          const existingDataString = localStorage.getItem(CAPTURED_DATA_LOCAL_STORAGE_KEY);
          const existingData: CapturedProcess[] = existingDataString ? JSON.parse(existingDataString) : [];
          const processToEdit = existingData.find(p => p.id === editIdFromQuery);
          
          if (processToEdit) {
            // Explicitly type processToEdit as 'any' for migration purposes
            const processToEditAny: any = processToEdit;
            const formDataToReset: Partial<CapturaFormData> & { id?: string, capturedAt?: string, activo?: boolean } = { 
              ...processToEditAny 
            };
            
            if (processToEditAny.procesosEntrada) {
              formDataToReset.procesosEntrada = processToEditAny.procesosEntrada;
            } else if (typeof processToEditAny.formatosRecibe === 'string') {
              formDataToReset.procesosEntrada = [processToEditAny.formatosRecibe];
            } else if (Array.isArray(processToEditAny.formatosRecibe)) {
               formDataToReset.procesosEntrada = processToEditAny.formatosRecibe;
            } else {
              formDataToReset.procesosEntrada = [];
            }

            if (processToEditAny.procesosSalida) {
              formDataToReset.procesosSalida = processToEditAny.procesosSalida;
            } else if (typeof processToEditAny.formatosEntrega === 'string') {
              formDataToReset.procesosSalida = [processToEditAny.formatosEntrega];
            } else if (Array.isArray(processToEditAny.formatosEntrega)) {
              formDataToReset.procesosSalida = processToEditAny.formatosEntrega;
            } else {
              formDataToReset.procesosSalida = [];
            }
            
            const finalFormDataToReset = { ...formDataToReset };
            delete (finalFormDataToReset as any).formatosRecibe;
            delete (finalFormDataToReset as any).formatosEntrega;
            
            form.reset(finalFormDataToReset as CapturaFormData);

          } else {
            toast({ title: "Error", description: "No se encontró el proceso para editar.", variant: "destructive" });
            if (editingId !== null) setEditingId(null); 
            router.push('/procesos-y-flujos-registrados');
          }
        } catch (error) {
          console.error("Error loading process for editing:", error);
          toast({ title: "Error al Cargar", description: "No se pudo cargar el proceso para editar.", variant: "destructive" });
          if (editingId !== null) setEditingId(null); 
          router.push('/procesos-y-flujos-registrados');
        }
      }
    } else {
      if (editingId !== null) { 
          setEditingId(null);
      }
      form.reset({ 
        area: "",
        puesto: "",
        proceso: "",
        descripcion: "",
        tiempoEstimado: undefined,
        frecuencia: undefined,
        sistemas: [],
        informacionRecibe: "",
        procesosEntrada: [],
        informacionEntrega: "",
        procesosSalida: [],
        activityOrder: [],
      }); 
    }
  }, [searchParams, form, router, isLoadingAreas, isLoadingPuestos, editingId, allProcesses]);


  function onSubmit(values: CapturaFormData) {
    try {
      const existingDataString = localStorage.getItem(CAPTURED_DATA_LOCAL_STORAGE_KEY);
      let existingData: CapturedProcess[] = existingDataString ? JSON.parse(existingDataString) : [];

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
          activo: true, 
        };
        existingData.push(newProcess);
        localStorage.setItem(CAPTURED_DATA_LOCAL_STORAGE_KEY, JSON.stringify(existingData));
        toast({
          title: "Proceso Registrado",
          description: "El proceso ha sido guardado. Defina sus actividades a continuación.",
        });
        // Instead of form.reset(), navigate to activity definition page
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
    field: any, // eslint-disable-line @typescript-eslint/no-explicit-any
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
            {options.length === 0 && !specialOption ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                No hay elementos configurados.
              </div>
            ) : (
              options.map((option) => (
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
                        onValueChange={field.onChange}
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
                        onValueChange={field.onChange}
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
                    <FormDescription>
                      Ingrese el nombre descriptivo del proceso que está capturando.
                    </FormDescription>
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
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="tiempoEstimado"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tiempo Estimado (minutos)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="Ej: 60" {...field} value={field.value ?? ''} min="0" />
                      </FormControl>
                      <FormDescription>
                        Tiempo aproximado en minutos para completar el proceso.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                        Con qué periodicidad se realiza este proceso.
                      </FormDescription>
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
                     {renderMultiSelectDropdown(field, "Sistemas Disponibles", "Seleccionar sistemas...", sistemas, isLoadingSistemasCostos)}
                    <FormDescription>
                      Seleccione los sistemas o software involucrados en la ejecución del proceso.
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
    
