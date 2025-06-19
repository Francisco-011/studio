
'use client';

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { format } from 'date-fns';

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
import { ClipboardEdit, Save } from "lucide-react";
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
import { useFuentesDestinos } from "@/contexts/FuentesDestinosContext";

// Mocked data for available systems - in a real app, this would come from a service or context
const availableSystems = [
  { id: "1", nombre: "SAP S/4HANA" },
  { id: "2", nombre: "Salesforce CRM" },
  { id: "3", nombre: "ERP Interno 'Phoenix'" },
  { id: "4", nombre: "Sistema de Tickets Jira" },
  { id: "5", nombre: "Microsoft Excel" },
  { id: "6", nombre: "Google Workspace" },
];

const frecuenciaOptions = ["Diario", "Semanal", "Quincenal", "Mensual", "Bimestral", "Trimestral", "Semestral", "Anual", "A demanda", "Otro"] as const;


const capturaFormSchema = z.object({
  area: z.string().min(1, "El área es requerida."),
  puesto: z.string().min(1, "El puesto es requerido."),
  proceso: z.string().min(1, "El nombre del proceso es requerido."),
  descripcion: z.string().min(1, "La descripción del proceso es requerida."),
  tiempoEstimado: z.preprocess(
    (val) => (String(val).trim() === '' ? undefined : parseInt(String(val), 10)),
    z.number().int("El tiempo debe ser un número entero.").nonnegative("El tiempo estimado debe ser un número positivo o cero.").optional()
  ),
  frecuencia: z.enum(frecuenciaOptions, { errorMap: () => ({ message: "Seleccione una frecuencia válida."}) }),
  sistemas: z.array(z.string()).optional().default([]),
  actividades: z.string().min(1, "Las actividades son requeridas."),
  informacionRecibe: z.string().min(1, "La descripción de la información que recibe es requerida."),
  formatosRecibe: z.array(z.string()).optional().default([]),
  informacionEntrega: z.string().min(1, "La descripción de la información que entrega es requerida."),
  formatosEntrega: z.array(z.string()).optional().default([]),
});

export type CapturaFormData = z.infer<typeof capturaFormSchema>;

export interface CapturedProcess extends CapturaFormData {
  id: string;
  capturedAt: string;
}

const CAPTURED_DATA_LOCAL_STORAGE_KEY = 'proceza-captured-data';

export default function CapturaPage() {
  const { areas, isLoading: isLoadingAreas } = useAreas();
  const { puestos, isLoadingPuestos } = usePuestos();
  const { fuentesDestinos, isLoadingFuentesDestinos } = useFuentesDestinos();

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
      actividades: "",
      informacionRecibe: "",
      formatosRecibe: [],
      informacionEntrega: "",
      formatosEntrega: [],
    },
  });

  function onSubmit(values: CapturaFormData) {
    const newProcess: CapturedProcess = {
      ...values,
      id: Date.now().toString(),
      capturedAt: new Date().toISOString(),
    };

    try {
      const existingDataString = localStorage.getItem(CAPTURED_DATA_LOCAL_STORAGE_KEY);
      const existingData: CapturedProcess[] = existingDataString ? JSON.parse(existingDataString) : [];
      existingData.push(newProcess);
      localStorage.setItem(CAPTURED_DATA_LOCAL_STORAGE_KEY, JSON.stringify(existingData));
      
      toast({
        title: "Proceso Registrado",
        description: "La información del proceso ha sido guardada exitosamente en almacenamiento local.",
      });
      form.reset(); 
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
    isLoading: boolean
  ) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <FormControl>
          <Button variant="outline" className="w-full justify-start text-left font-normal h-auto min-h-10">
            {field.value && field.value.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {field.value.map((itemName: string) => (
                  <Badge key={itemName} variant="secondary" className="font-normal">
                    {itemName}
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </Button>
        </FormControl>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]" align="start">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isLoading ? (
           <div className="px-2 py-1.5 text-sm text-muted-foreground">Cargando...</div>
        ) : options.length === 0 ? (
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
      </DropdownMenuContent>
    </DropdownMenu>
  );


  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center gap-2">
          <ClipboardEdit className="h-6 w-6 text-primary" />
          <CardTitle className="text-2xl font-headline">Módulo de Captura</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-6">
            Este es el punto de entrada principal para registrar de forma detallada todos los procesos operativos y sus flujos de información asociados.
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
                      <Input placeholder="Ej: Elaboración de Nómina, Recepción de Mercancía" {...field} />
                    </FormControl>
                    <FormDescription>
                      Identificador o nombre claro del proceso.
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
                      <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
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
                     {renderMultiSelectDropdown(field, "Sistemas Disponibles", "Seleccionar sistemas...", availableSystems, false)}
                    <FormDescription>
                      Seleccione los sistemas o software involucrados en la ejecución del proceso.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="actividades"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Actividades Granulares</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Liste las tareas o actividades específicas que componen el proceso. Puede usar una línea por actividad."
                        className="min-h-[120px]"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Desglose el proceso en sus actividades componentes principales.
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
                name="formatosRecibe"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Formatos de Información Utilizados (Entradas)</FormLabel>
                    {renderMultiSelectDropdown(field, "Formatos de Información", "Seleccionar formatos de entrada...", fuentesDestinos, isLoadingFuentesDestinos)}
                    <FormDescription>
                      Seleccione los formatos en los que se recibe la información (Ej: PDF, Email, Sistema X).
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
                name="formatosEntrega"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Formatos de Información Utilizados (Salidas)</FormLabel>
                    {renderMultiSelectDropdown(field, "Formatos de Información", "Seleccionar formatos de salida...", fuentesDestinos, isLoadingFuentesDestinos)}
                    <FormDescription>
                      Seleccione los formatos en los que se entrega la información (Ej: Documento Word, Correo electrónico, Actualización en CRM).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />


              <div className="flex justify-end">
                <Button type="submit" size="lg">
                  <Save className="mr-2 h-5 w-5" />
                  Guardar Proceso
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
