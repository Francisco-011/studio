'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray, type Control } from "react-hook-form";
import { z } from 'zod';
import { db } from '@/lib/firebase';
import { collection, writeBatch, doc, serverTimestamp } from 'firebase/firestore';

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ClipboardEdit, Save, PlusCircle, Trash2, Workflow, ListOrdered, ListChecks, GripVertical, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAreas } from "@/contexts/AreasContext";
import { useDepartamentos } from "@/contexts/DepartamentosContext";
import { usePuestos } from "@/contexts/PuestosContext";
import { useProcesos, capturaFormSchema, clasificacionOptions } from '@/contexts/ProcesosContext';
import { useSistemasCostos } from '@/contexts/SistemasCostosContext';

const NO_DEPARTAMENTO_SELECTED = "__NO_DEPARTAMENTO__";

// Schemas for the new unified form
const activitySchema = z.object({
    nombre: z.string().min(1, "El nombre es requerido."),
    descripcionBreve: z.string().optional(),
    tiempoEstimado: z.preprocess(val => val ? parseInt(String(val), 10) : undefined, z.number().int().nonnegative().optional()),
});

const procedureSchema = z.object({
    nombre: z.string().min(1, "El nombre es requerido."),
    descripcion: z.string().optional(),
    clasificacion: z.enum(clasificacionOptions).default('Privado'),
    sistemasUtilizados: z.array(z.string()).optional().default([]),
    activities: z.array(activitySchema).optional().default([]),
});

const unifiedCaptureSchema = capturaFormSchema.extend({
  procedures: z.array(procedureSchema).optional().default([]),
});

type UnifiedCaptureFormData = z.infer<typeof unifiedCaptureSchema>;


function ActivitiesSection({ control, procIndex }: { control: Control<UnifiedCaptureFormData>, procIndex: number }) {
    const { fields, append, remove, move } = useFieldArray({
        control,
        name: `procedures.${procIndex}.activities`,
    });

    const dragItem = useRef<number | null>(null);
    const dragOverItem = useRef<number | null>(null);

    const handleDragStart = (index: number) => {
        dragItem.current = index;
    };
    const handleDragEnter = (index: number) => {
        dragOverItem.current = index;
    };
    const handleDrop = () => {
        if (dragItem.current !== null && dragOverItem.current !== null) {
            move(dragItem.current, dragOverItem.current);
            dragItem.current = null;
            dragOverItem.current = null;
        }
    };
    
    return (
        <div className="pl-4 mt-4 space-y-3">
            <h4 className="font-semibold text-md flex items-center gap-2"><ListChecks className="h-5 w-5 text-amber-600"/> Actividades del Procedimiento</h4>
            <div className="space-y-2">
                {fields.map((field, index) => (
                    <div 
                        key={field.id}
                        className="flex items-center gap-2 p-2 border rounded-md bg-background"
                        draggable
                        onDragStart={() => handleDragStart(index)}
                        onDragEnter={() => handleDragEnter(index)}
                        onDragEnd={handleDrop}
                        onDragOver={(e) => e.preventDefault()}
                    >
                         <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
                         <FormField
                            control={control}
                            name={`procedures.${procIndex}.activities.${index}.nombre`}
                            render={({ field }) => (
                                <FormItem className="flex-grow">
                                    <FormControl><Input placeholder={`Nombre de la actividad ${index + 1}`} {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                    </div>
                ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => append({ nombre: '', descripcionBreve: '', tiempoEstimado: 0 })}>
                <PlusCircle className="mr-2 h-4 w-4" /> Agregar Actividad
            </Button>
        </div>
    );
}


export default function CapturaPage() {
  const router = useRouter();
  const { areas } = useAreas();
  const { departamentos } = useDepartamentos();
  const { puestos } = usePuestos();
  const { sistemas } = useSistemasCostos();
  const { procesos: allProcesses } = useProcesos();
  
  const [isDefiningFlow, setIsDefiningFlow] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [similarProcessWarning, setSimilarProcessWarning] = useState<string | null>(null);
  
  const dragProcedureItem = useRef<number | null>(null);
  const dragOverProcedureItem = useRef<number | null>(null);

  const form = useForm<UnifiedCaptureFormData>({
    resolver: zodResolver(unifiedCaptureSchema),
    defaultValues: {
        proceso: "",
        procedures: [],
    },
  });

  const { fields: procedureFields, append: appendProcedure, remove: removeProcedure, move: moveProcedure } = useFieldArray({
      control: form.control,
      name: "procedures",
  });
  
  const { watch, setValue } = form;
  const watchedAreaName = watch('area');
  const watchedDepartamentoName = watch('departamento');
  const watchedProcessName = watch('proceso');
  
  const filteredDepartamentos = useMemo(() => {
    if (!watchedAreaName) return [];
    const areaId = areas.find(a => a.nombre === watchedAreaName)?.id;
    return areaId ? departamentos.filter(d => d.areaId === areaId) : [];
  }, [watchedAreaName, areas, departamentos]);

  const filteredPuestos = useMemo(() => {
    if (!watchedAreaName) return [];
    const areaId = areas.find(a => a.nombre === watchedAreaName)?.id;
    if (!areaId) return [];
    
    const puestosInArea = puestos.filter(p => p.areaId === areaId);

    if (watchedDepartamentoName && watchedDepartamentoName !== NO_DEPARTAMENTO_SELECTED) {
      const deptoId = departamentos.find(d => d.nombre === watchedDepartamentoName && d.areaId === areaId)?.id;
      if (deptoId) return puestosInArea.filter(p => p.departamentoId === deptoId);
    }
    if (watchedDepartamentoName === NO_DEPARTAMENTO_SELECTED) return puestosInArea.filter(p => !p.departamentoId);
    return puestosInArea;
  }, [watchedAreaName, watchedDepartamentoName, areas, departamentos, puestos]);

  useEffect(() => {
    if (watchedProcessName) {
      const existingProcess = allProcesses.find(p => p.proceso.trim().toLowerCase() === watchedProcessName.trim().toLowerCase());
      if (existingProcess) {
        setSimilarProcessWarning(`Advertencia: ya existe un proceso con un nombre idéntico: "${existingProcess.proceso}" en el área de "${existingProcess.area}".`);
      } else {
        setSimilarProcessWarning(null);
      }
    } else {
      setSimilarProcessWarning(null);
    }
  }, [watchedProcessName, allProcesses]);
  
  const handleDragProcedureStart = (index: number) => { dragProcedureItem.current = index; };
  const handleDragProcedureEnter = (index: number) => { dragOverProcedureItem.current = index; };
  const handleDropProcedure = () => {
    if (dragProcedureItem.current !== null && dragOverProcedureItem.current !== null) {
      moveProcedure(dragProcedureItem.current, dragOverProcedureItem.current);
      dragProcedureItem.current = null;
      dragOverProcedureItem.current = null;
    }
  };

  const handleContinue = () => {
      form.trigger(['proceso', 'area', 'puesto', 'descripcion']).then(isValid => {
          if(isValid) {
              setIsDefiningFlow(true);
          } else {
              toast({
                  title: "Campos Incompletos",
                  description: "Por favor, complete los datos principales del proceso antes de continuar.",
                  variant: "destructive"
              });
          }
      });
  }

  async function onSubmit(data: UnifiedCaptureFormData) {
    setIsSaving(true);
    try {
        const batch = writeBatch(db);

        // 1. Create Process reference and get its ID
        const processRef = doc(collection(db, PROCESOS_COLLECTION));
        const newProcessId = processRef.id;

        // 2. Prepare procedure and activity data with references
        const procedureRefsAndData: { ref: any, data: any }[] = [];
        
        for (const procData of data.procedures || []) {
            const procedureRef = doc(collection(db, 'procedimientos'));
            const newProcedureId = procedureRef.id;
            
            const activityRefsAndData: { ref: any, data: any }[] = [];
            if (procData.activities) {
                for (const actData of procData.activities) {
                    const activityRef = doc(collection(db, 'actividades'));
                    activityRefsAndData.push({
                        ref: activityRef,
                        data: {
                            ...actData,
                            codigo: `AC-${Date.now().toString().slice(-5)}-${Math.random().toString(16).slice(2, 5)}`,
                            procedimientoId: newProcedureId,
                            activa: true,
                            createdAt: serverTimestamp(),
                            updatedAt: serverTimestamp(),
                            historialDeCambios: []
                        }
                    });
                }
            }
            
            procedureRefsAndData.push({
                ref: procedureRef,
                data: {
                    ...procData,
                    codigo: `PC-${Date.now().toString().slice(-5)}-${Math.random().toString(16).slice(2, 5)}`,
                    procesoId: newProcessId,
                    activityOrder: activityRefsAndData.map(a => a.ref.id),
                    activo: true,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    historialDeCambios: []
                }
            });
            
            activityRefsAndData.forEach(a => batch.set(a.ref, a.data));
        }

        procedureRefsAndData.forEach(p => batch.set(p.ref, p.data));
        
        // 3. Prepare Process payload
        const processPayload = {
            proceso: data.proceso,
            descripcion: data.descripcion,
            area: data.area,
            departamento: data.departamento === NO_DEPARTAMENTO_SELECTED ? undefined : data.departamento,
            puesto: data.puesto,
            codigo: `PR-${Date.now().toString().slice(-6)}`,
            capturedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            activo: true,
            historialDeCambios: [],
            procedimientoOrder: procedureRefsAndData.map(p => p.ref.id),
        };
        batch.set(processRef, processPayload);

        // 4. Commit batch
        await batch.commit();

        toast({ title: "Captura Completa", description: "El proceso, sus procedimientos y actividades han sido guardados exitosamente." });
        router.push(`/procesos-y-flujos-registrados?search=${encodeURIComponent(data.proceso)}`);

    } catch (error) {
        console.error("Error en guardado masivo:", error);
        toast({ title: "Error Crítico", description: "No se pudo guardar el proceso completo. Revise la consola.", variant: "destructive" });
    } finally {
        setIsSaving(false);
    }
  }

  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-2 mb-1">
            <ClipboardEdit className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl font-headline">Módulo de Captura Integral</CardTitle>
          </div>
          <CardDescription>
            Defina un proceso completo, incluyendo sus procedimientos y actividades, desde una única pantalla.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              {/* Process Details Section */}
              <div className="p-4 border rounded-lg">
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-4"><Workflow className="h-5 w-5 text-blue-600"/>1. Datos del Proceso Principal</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <FormField control={form.control} name="area" render={({ field }) => (<FormItem><FormLabel>Área</FormLabel><Select onValueChange={v => { field.onChange(v); setValue('departamento', undefined); setValue('puesto', undefined); }} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione un área" /></SelectTrigger></FormControl><SelectContent>{areas.map(a => (<SelectItem key={a.id} value={a.nombre}>{a.nombre}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="departamento" render={({ field }) => (<FormItem><FormLabel>Departamento</FormLabel><Select onValueChange={v => { field.onChange(v); setValue('puesto', undefined); }} value={field.value} disabled={!watchedAreaName}><FormControl><SelectTrigger><SelectValue placeholder={!watchedAreaName ? "Seleccione área" : "Opcional"} /></SelectTrigger></FormControl><SelectContent><SelectItem value={NO_DEPARTAMENTO_SELECTED}>Sin Departamento</SelectItem>{filteredDepartamentos.map(d => (<SelectItem key={d.id} value={d.nombre}>{d.nombre}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="puesto" render={({ field }) => (<FormItem><FormLabel>Puesto Principal</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={!watchedAreaName}><FormControl><SelectTrigger><SelectValue placeholder={!watchedAreaName ? "Seleccione área" : "Seleccione un puesto"} /></SelectTrigger></FormControl><SelectContent>{filteredPuestos.map(p => (<SelectItem key={p.id} value={p.nombre}>{p.nombre}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
                </div>
                <FormField control={form.control} name="proceso" render={({ field }) => (<FormItem className="mt-6"><FormLabel>Nombre del Proceso</FormLabel><FormControl><Input placeholder="Ej: Gestión de Pedidos de Clientes" {...field} /></FormControl>{similarProcessWarning && (<FormDescription className="text-amber-600 flex items-center gap-1 pt-1"><AlertTriangle className="h-4 w-4" />{similarProcessWarning}</FormDescription>)}<FormMessage /></FormItem>)} />
                <FormField control={form.control} name="descripcion" render={({ field }) => (<FormItem className="mt-6"><FormLabel>Objetivo del Proceso</FormLabel><FormControl><Textarea placeholder="Describa el propósito principal y el resultado esperado." {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>

              {!isDefiningFlow && (
                  <div className="text-center">
                      <Button type="button" size="lg" onClick={handleContinue}>
                          Definir Procedimientos y Flujo
                      </Button>
                  </div>
              )}
              
              {isDefiningFlow && (
                <>
                <div className="p-4 border rounded-lg space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold flex items-center gap-2"><ListOrdered className="h-5 w-5 text-green-600"/>2. Procedimientos</h3>
                    <Button type="button" variant="outline" onClick={() => appendProcedure({ nombre: '', activities: [] })}><PlusCircle className="mr-2 h-4 w-4"/>Agregar Procedimiento</Button>
                  </div>
                  
                  <div className="space-y-3">
                    {procedureFields.map((field, index) => (
                      <div 
                        key={field.id}
                        draggable
                        onDragStart={() => handleDragProcedureStart(index)}
                        onDragEnter={() => handleDragProcedureEnter(index)}
                        onDragEnd={handleDropProcedure}
                        onDragOver={e => e.preventDefault()}
                      >
                        <Accordion type="single" collapsible defaultValue="item-1">
                          <AccordionItem value="item-1" className="bg-muted/50 rounded-lg border">
                            <AccordionTrigger className="px-4 hover:no-underline">
                              <div className="flex items-center gap-2 flex-grow">
                                <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab"/>
                                <span className="font-bold text-primary">{index + 1}.</span>
                                <FormField
                                    control={form.control}
                                    name={`procedures.${index}.nombre`}
                                    render={({ field }) => (
                                        <FormItem className="flex-grow">
                                            <FormControl><Input placeholder={`Nombre del procedimiento ${index + 1}`} {...field} onClick={e => e.stopPropagation()} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <Button type="button" variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); removeProcedure(index); }}>
                                    <Trash2 className="h-4 w-4 text-destructive"/>
                                </Button>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="p-4 border-t">
                              <ActivitiesSection control={form.control} procIndex={index} />
                            </AccordionContent>
                          </AccordionItem>
                        </Accordion>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end">
                    <Button type="submit" size="lg" disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
                        Guardar Proceso Completo
                    </Button>
                </div>
                </>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
