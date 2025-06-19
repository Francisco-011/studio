
'use client';

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

// Mocked data for available systems - in a real app, this would come from a service or context
const availableSystems = [
  { id: "1", nombre: "SAP S/4HANA" },
  { id: "2", nombre: "Salesforce CRM" },
  { id: "3", nombre: "ERP Interno 'Phoenix'" },
  { id: "4", nombre: "Sistema de Tickets Jira" },
  { id: "5", nombre: "Microsoft Excel" },
  { id: "6", nombre: "Google Workspace" },
];

const capturaFormSchema = z.object({
  area: z.string().min(1, "El área es requerida."),
  puesto: z.string().min(1, "El puesto es requerido."),
  proceso: z.string().min(1, "El nombre del proceso es requerido."),
  descripcion: z.string().min(1, "La descripción del proceso es requerida."),
  sistemas: z.array(z.string()).optional().default([]),
  actividades: z.string().min(1, "Las actividades son requeridas."),
  flujoInformacion: z.string().min(1, "El flujo de información es requerido."),
});

type CapturaFormData = z.infer<typeof capturaFormSchema>;

export default function CapturaPage() {
  const form = useForm<CapturaFormData>({
    resolver: zodResolver(capturaFormSchema),
    defaultValues: {
      area: "",
      puesto: "",
      proceso: "",
      descripcion: "",
      sistemas: [],
      actividades: "",
      flujoInformacion: "",
    },
  });

  function onSubmit(values: CapturaFormData) {
    // In a real application, you would send this data to a server/database
    console.log("Form data submitted:", values);
    toast({
      title: "Proceso Registrado",
      description: "La información del proceso ha sido guardada exitosamente.",
    });
    form.reset(); // Reset form fields after successful submission
  }

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
                      <FormControl>
                        <Input placeholder="Ej: Finanzas, Operaciones" {...field} />
                      </FormControl>
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
                      <FormControl>
                        <Input placeholder="Ej: Analista Contable, Jefe de Almacén" {...field} />
                      </FormControl>
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

              <FormField
                control={form.control}
                name="sistemas"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Sistemas / Aplicaciones Utilizadas (Opcional)</FormLabel>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <FormControl>
                          <Button variant="outline" className="w-full justify-start text-left font-normal h-auto min-h-10">
                            {field.value && field.value.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {field.value.map((systemName) => (
                                  <Badge key={systemName} variant="secondary" className="font-normal">
                                    {systemName}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Seleccionar sistemas...</span>
                            )}
                          </Button>
                        </FormControl>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]" align="start">
                        <DropdownMenuLabel>Sistemas Disponibles</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {availableSystems.map((system) => (
                          <DropdownMenuCheckboxItem
                            key={system.id}
                            checked={field.value?.includes(system.nombre)}
                            onCheckedChange={(checked) => {
                              const currentSelected = field.value || [];
                              if (checked) {
                                field.onChange([...currentSelected, system.nombre]);
                              } else {
                                field.onChange(currentSelected.filter((s) => s !== system.nombre));
                              }
                            }}
                          >
                            {system.nombre}
                          </DropdownMenuCheckboxItem>
                        ))}
                        {availableSystems.length === 0 && (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            No hay sistemas configurados.
                          </div>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
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

              <FormField
                control={form.control}
                name="flujoInformacion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Flujo de Información Asociado</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describa qué información se maneja (entradas/salidas), de dónde proviene y hacia dónde va. Incluya formatos si es relevante."
                        className="min-h-[120px]"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Detalle las entradas, salidas y transformaciones clave de información.
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

