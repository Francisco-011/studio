
'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray, type Control } from "react-hook-form";
import { z } from 'zod';
import { db } from '@/lib/firebase';
import { collection, writeBatch, doc, serverTimestamp } from 'firebase/firestore';

import { Button, buttonVariants } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ClipboardEdit, Save, PlusCircle, Trash2, Workflow, ListOrdered, ListChecks, GripVertical, AlertTriangle, Loader2, CalendarCheck2, ChevronDown } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAreas } from "@/contexts/AreasContext";
import { useDepartamentos } from "@/contexts/DepartamentosContext";
import { usePuestos, type Puesto } from "@/contexts/PuestosContext";
import { useProcesos, capturaFormSchema, clasificacionOptions, frecuenciaOptions, auditFrequencyOptions } from '@/contexts/ProcesosContext';
import { useSistemasCostos } from '@/contexts/SistemasCostosContext';
import { useProcedimientos } from '@/contexts/ProcedimientosContext';
import { useActividades, type Actividad } from '@/contexts/ActividadesContext';
import { usePoliticas } from '@/contexts/PoliticasContext';
import { cn } from '@/lib/utils';
import { MultiSelect } from '@/components/ui/multi-select';
import { Checkbox } from '@/components/ui/checkbox';


const NO_DEPARTAMENTO_SELECTED = "__NO_DEPARTAMENTO__";
const PROCESOS_COLLECTION = 'procesos';
const PROCEDIMIENTO_INICIADOR = "__INICIADOR__";
const PROCEDIMIENTO_FINALIZADOR = "__FINALIZADOR__";

// Schemas for the new unified form
const activitySchema = z.object({
    nombre: z.string().min(1, "El nombre es requerido."),
    descripcionBreve: z.string().optional(),
    tiempoEstimado: z.preprocess(val => (String(val).trim() === '' ? undefined : parseInt(String(val), 10)), z.number().int().nonnegative().optional()),
    tiempoIdeal: z.preprocess(val => (String(val).trim() === '' ? undefined : parseInt(String(val), 10)), z.number().int().nonnegative().optional()),
    puestoId: z.string().optional(),
    frecuencia: z.enum(frecuenciaOptions).optional(),
    ejecucionesPorPeriodo: z.preprocess(val => (String(val).trim() === '' ? undefined : parseInt(String(val), 10)), z.number().int().positive('Debe ser un número positivo.').optional()),
});

const procedureSchema = z.object({
    nombre: z.string().min(1, "El nombre es requerido."),
    descripcion: z.string().optional(),
    clasificacion: z.enum(clasificacionOptions).default('Privado'),
    sistemasUtilizados: z.array(z.string()).optional().default([]),
    activities: z.array(activitySchema).optional().default([]),
    informacionRecibe: z.string().optional(),
    procedimientosEntradaIds: z.array(z.string()).optional().default([]),
    informacionEntrega: z.string().optional(),
    procedimientosSalidaIds: z.array(z.string()).optional().default([]),
    auditFrequencyInDays: z.preprocess(
      (val) => (String(val).trim() === '' || val === 'none' ? undefined : parseInt(String(val), 10)),
      z.number().int().optional()
    ),
    politicasAsociadasIds: z.array(z.string()).optional().default([]),
});

const unifiedCaptureSchema = capturaFormSchema.extend({
  procedures: z.array(procedureSchema).optional().default([]),
});

type UnifiedCaptureFormData = z.infer<typeof unifiedCaptureSchema>;


function ActivitiesSection({ control, procIndex, allActivities, allPuestos, defaultPuestoId }: { control: Control<UnifiedCaptureFormData>, procIndex: number, allActivities: Actividad[], allPuestos: Puesto[], defaultPuestoId?: string }) {
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
                        className="flex flex-col gap-2 p-3 border rounded-md bg-background"
                    >
                        <div className="flex items-start gap-2">
                             <div 
                                draggable
                                onDragStart={() => handleDragStart(index)}
                                onDragEnter={() => handleDragEnter(index)}
                                onDragEnd={handleDrop}
                                onDragOver={(e) => e.preventDefault()}
                                className="cursor-grab pt-2"
                             >
                                <GripVertical className="h-5 w-5 text-muted-foreground" />
                            </div>
                             <FormField
                                control={control}
                                name={`procedures.${procIndex}.activities.${index}.nombre`}
                                render={({ field }) => (
                                    <FormItem className="flex-grow">
                                        <FormLabel className="text-xs">Nombre Actividad {index + 1}</FormLabel>
                                        <FormControl><Input placeholder={`Nombre de la actividad`} {...field} /></FormControl>
                                        {(() => {
                                            const actName = field.value;
                                            if (!actName) return null;
                                            const existingAct = allActivities.find(a => a.nombre.trim().toLowerCase() === actName.trim().toLowerCase());
                                            if (existingAct) {
                                                return <FormDescription className="text-amber-600 flex items-center gap-1 pt-1 text-xs"><AlertTriangle className="h-3 w-3" />{`Advertencia: ya existe una actividad con este nombre.`}</FormDescription>;
                                            }
                                            return null;
                                        })()}
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <div 
                                role="button"
                                tabIndex={0}
                                aria-label="Eliminar actividad"
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); remove(index); }}}
                                className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "mt-6")}
                                onClick={(e) => { e.stopPropagation(); remove(index); }}
                            >
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </div>
                        </div>
                        <div className="pl-8 space-y-4">
                           <FormField control={control} name={`procedures.${procIndex}.activities.${index}.descripcionBreve`} render={({ field }) => (<FormItem><FormLabel className="text-xs">Descripción</FormLabel><FormControl><Textarea placeholder="Un resumen conciso..." {...field} value={field.value ?? ''} rows={2} /></FormControl><FormMessage /></FormItem>)} />
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <FormField control={control} name={`procedures.${procIndex}.activities.${index}.puestoId`} render={({ field }) => (<FormItem><FormLabel className="text-xs">Puesto que Ejecuta</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Opcional..." /></SelectTrigger></FormControl><SelectContent><SelectItem value="none">Sin Puesto Específico</SelectItem>{allPuestos.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                             <div className="grid grid-cols-2 gap-2">
                                <FormField control={control} name={`procedures.${procIndex}.activities.${index}.frecuencia`} render={({ field }) => (<FormItem><FormLabel className="text-xs">Frecuencia</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Opcional..."/></SelectTrigger></FormControl><SelectContent>{frecuenciaOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                                <FormField control={control} name={`procedures.${procIndex}.activities.${index}.ejecucionesPorPeriodo`} render={({ field }) => (<FormItem><FormLabel className="text-xs">Veces</FormLabel><FormControl><Input type="number" placeholder="1" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                             </div>
                           </div>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <FormField control={control} name={`procedures.${procIndex}.activities.${index}.tiempoEstimado`} render={({ field }) => (<FormItem><FormLabel className="text-xs">Tiempo Estimado (min)</FormLabel><FormControl><Input type="number" placeholder="Ej: 30" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                             <FormField control={control} name={`procedures.${procIndex}.activities.${index}.tiempoIdeal`} render={({ field }) => (<FormItem><FormLabel className="text-xs">Tiempo Ideal (min)</FormLabel><FormControl><Input type="number" placeholder="Ej: 20" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                           </div>
                        </div>
                    </div>
                ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => append({ nombre: '', descripcionBreve: '', tiempoEstimado: undefined, tiempoIdeal: undefined, puestoId: defaultPuestoId, frecuencia: undefined, ejecucionesPorPeriodo: undefined })}>
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
  const { procedimientos: allProcedimientos } = useProcedimientos();
  const { actividades: allActivities } = useActividades();
  const { politicas } = usePoliticas();
  
  const [isDefiningFlow, setIsDefiningFlow] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [similarProcessWarning, setSimilarProcessWarning] = useState<string | null>(null);
  
  const dragProcedureItem = useRef<number | null>(null);
  const dragOverProcedureItem = useRef<number | null>(null);

  const form = useForm<UnifiedCaptureFormData>({
    resolver: zodResolver(unifiedCaptureSchema),
    defaultValues: {
      proceso: "",
      descripcion: "",
      area: undefined,
      puesto: undefined,
      departamento: undefined,
      procedures: [],
      politicasAsociadas: [],
    },
  });

  const { watch, setValue } = form;
  const watchedAreaName = watch('area');
  const watchedDepartamentoName = watch('departamento');
  const watchedProcessName = watch('proceso');
  const watchedPuestoName = watch('puesto');
  
  const selectedPuestoForActivities = useMemo(() => {
    if (!watchedPuestoName) return null;
    return puestos.find(p => p.nombre === watchedPuestoName) || null;
  }, [watchedPuestoName, puestos]);
  
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
  
  const { fields: procedureFields, append: appendProcedure, remove: removeProcedure, move: moveProcedure } = useFieldArray({
      control: form.control,
      name: "procedures",
  });

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
                    const { puestoId, ...restOfActData } = actData;
                    activityRefsAndData.push({
                        ref: activityRef,
                        data: {
                            ...restOfActData,
                            puestoId: puestoId === 'none' ? undefined : puestoId,
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
            
            const { activities, ...restOfProcData } = procData;

            procedureRefsAndData.push({
                ref: procedureRef,
                data: {
                    ...restOfProcData,
                    codigo: `PC-${Date.now().toString().slice(-5)}-${Math.random().toString(16).slice(2, 5)}`,
                    procesoId: newProcessId,
                    activityOrder: activityRefsAndData.map(a => a.ref.id),
                    activo: true,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    historialDeCambios: []
                }
            });

            if (procData.politicasAsociadasIds && procData.politicasAsociadasIds.length > 0) {
              for (const policyId of procData.politicasAsociadasIds) {
                  const policy = politicas.find(p => p.id === policyId);
                  if (policy) {
                      const policyRef = doc(db, 'politicas', policyId);
                      const updatedProcIds = [...(policy.procedimientosAsociadosIds || []), newProcedureId];
                      batch.update(policyRef, { procedimientosAsociadosIds: updatedProcIds });
                  }
              }
            }
            
            activityRefsAndData.forEach(a => batch.set(a.ref, a.data));
        }

        procedureRefsAndData.forEach(p => batch.set(p.ref, p.data));
        
        // 3. Prepare Process payload
        const { politicasAsociadas, ...processDataWithoutPolicies } = data;
        const processPayload = {
            ...processDataWithoutPolicies,
            codigo: `PR-${Date.now().toString().slice(-6)}`,
            capturedAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            activo: true,
            historialDeCambios: [],
            procedimientoOrder: procedureRefsAndData.map(p => p.ref.id),
            politicasAsociadas: data.politicasAsociadas || [],
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
                    <Button type="button" variant="outline" onClick={() => appendProcedure({ nombre: '', activities: [] } as any)}><PlusCircle className="mr-2 h-4 w-4"/>Agregar Procedimiento</Button>
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
                                            {(() => {
                                                const procName = field.value;
                                                if (!procName) return null;
                                                const existingProc = allProcedimientos.find(p => p.nombre.trim().toLowerCase() === procName.trim().toLowerCase());
                                                if (existingProc) {
                                                const parentProcess = allProcesses.find(p => p.id === existingProc.procesoId);
                                                return <FormDescription className="text-amber-600 flex items-center gap-1 pt-1 text-xs"><AlertTriangle className="h-3 w-3" />{`Advertencia: ya existe un procedimiento con este nombre en "${parentProcess?.proceso || 'otro proceso'}".`}</FormDescription>;
                                                }
                                                return null;
                                            })()}
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <div 
                                  role="button" 
                                  tabIndex={0} 
                                  aria-label="Eliminar procedimiento" 
                                  onKeyDown={(e) => { if(e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); removeProcedure(index); }}} 
                                  className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "mt-0")} 
                                  onClick={(e) => { e.stopPropagation(); removeProcedure(index); }}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive"/>
                                </div>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="p-4 border-t space-y-4">
                               <FormField control={form.control} name={`procedures.${index}.descripcion`} render={({ field }) => (<FormItem><FormLabel>Descripción</FormLabel><FormControl><Textarea {...field} value={field.value ?? ''}/></FormControl><FormMessage/></FormItem>)}/>
                               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <FormField control={form.control} name={`procedures.${index}.clasificacion`} render={({ field }) => (<FormItem><FormLabel>Clasificación</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{clasificacionOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select><FormMessage/></FormItem>)}/>
                                  <FormField control={form.control} name={`procedures.${index}.sistemasUtilizados`} render={({ field }) => (<FormItem><FormLabel>Sistemas Utilizados</FormLabel><MultiSelect value={field.value} onChange={(newSelected) => field.onChange(newSelected)} options={sistemas.map(s => ({value: s.nombre, label: s.nombre}))} placeholder="Seleccione sistemas..."/><FormMessage/></FormItem>)}/>
                               </div>
                                <FormField control={form.control} name={`procedures.${index}.auditFrequencyInDays`} render={({ field }) => (<FormItem><FormLabel>Frecuencia de Auditoría</FormLabel><Select onValueChange={(value) => field.onChange(value === 'none' ? undefined : Number(value))} value={field.value?.toString() || 'none'}><FormControl><SelectTrigger><CalendarCheck2 className="mr-2 h-4 w-4" /><SelectValue placeholder="Seleccione..." /></SelectTrigger></FormControl><SelectContent><SelectItem value="none">No requiere</SelectItem>{auditFrequencyOptions.map((opt) => (<SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
                               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name={`procedures.${index}.procedimientosEntradaIds`}
                                        render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Procedimientos de Entrada</FormLabel>
                                            <div className="flex items-center gap-2">
                                                <div className="flex-grow">
                                                <MultiSelect
                                                    value={field.value?.filter((v) => v !== PROCEDIMIENTO_INICIADOR)}
                                                    onChange={(newSelected) => {
                                                        const currentIsInitiator = field.value?.includes(PROCEDIMIENTO_INICIADOR);
                                                        field.onChange(
                                                            currentIsInitiator
                                                                ? [PROCEDIMIENTO_INICIADOR, ...newSelected]
                                                                : newSelected
                                                        );
                                                    }}
                                                    options={allProcedimientos.map((p) => ({ value: p.id, label: p.nombre }))}
                                                    placeholder="Seleccione..."
                                                    />
                                                </div>
                                                <div className="flex items-center space-x-2 pt-6">
                                                    <Checkbox
                                                    id={`iniciador-${index}`}
                                                    checked={field.value?.includes(PROCEDIMIENTO_INICIADOR)}
                                                    onCheckedChange={checked => {
                                                        field.onChange(checked ? [PROCEDIMIENTO_INICIADOR] : []);
                                                    }}
                                                    disabled={field.value?.length > 0 && !field.value.includes(PROCEDIMIENTO_INICIADOR)}
                                                    />
                                                    <label htmlFor={`iniciador-${index}`} className="text-sm font-medium leading-none">Iniciador</label>
                                                </div>
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                    />
                                  <FormField control={form.control} name={`procedures.${index}.informacionRecibe`} render={({ field }) => (<FormItem><FormLabel>Información que Recibe</FormLabel><FormControl><Textarea placeholder="Ej: Factura del proveedor..." {...field} value={field.value ?? ''}/></FormControl><FormMessage/></FormItem>)}/>
                                  
                                    <FormField
                                        control={form.control}
                                        name={`procedures.${index}.procedimientosSalidaIds`}
                                        render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Procedimientos de Salida</FormLabel>
                                             <div className="flex items-center gap-2">
                                                <div className="flex-grow">
                                                <MultiSelect
                                                    value={field.value?.filter((v) => v !== PROCEDIMIENTO_FINALIZADOR)}
                                                    onChange={(newSelected) => {
                                                        const currentIsFinalizer = field.value?.includes(PROCEDIMIENTO_FINALIZADOR);
                                                        field.onChange(
                                                            currentIsFinalizer
                                                                ? [PROCEDIMIENTO_FINALIZADOR, ...newSelected]
                                                                : newSelected
                                                        );
                                                    }}
                                                    options={allProcedimientos.map((p) => ({ value: p.id, label: p.nombre }))}
                                                    placeholder="Seleccione..."
                                                    />
                                                </div>
                                                <div className="flex items-center space-x-2 pt-6">
                                                    <Checkbox
                                                    id={`finalizador-${index}`}
                                                    checked={field.value?.includes(PROCEDIMIENTO_FINALIZADOR)}
                                                    onCheckedChange={checked => {
                                                        field.onChange(checked ? [PROCEDIMIENTO_FINALIZADOR] : []);
                                                    }}
                                                    disabled={field.value?.length > 0 && !field.value.includes(PROCEDIMIENTO_FINALIZADOR)}
                                                    />
                                                    <label htmlFor={`finalizador-${index}`} className="text-sm font-medium leading-none">Finalizador</label>
                                                </div>
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                    />
                                  <FormField control={form.control} name={`procedures.${index}.informacionEntrega`} render={({ field }) => (<FormItem><FormLabel>Información que Entrega</FormLabel><FormControl><Textarea placeholder="Ej: Pago programado, Factura registrada en sistema..." {...field} value={field.value ?? ''}/></FormControl><FormMessage/></FormItem>)}/>
                               </div>
                               <FormField control={form.control} name={`procedures.${index}.politicasAsociadasIds`} render={({ field }) => (<FormItem><FormLabel>Políticas Vinculadas</FormLabel><MultiSelect value={field.value} onChange={(newValue) => field.onChange(newValue)} options={politicas.filter(p => p.estado === 'Aprobada').map(p => ({value: p.id, label: `${p.codigo} - ${p.titulo}`}))} placeholder="Vincular políticas..."/><FormMessage /></FormItem>)}/>
                              <ActivitiesSection 
                                control={form.control} 
                                procIndex={index} 
                                allActivities={allActivities} 
                                allPuestos={puestos}
                                defaultPuestoId={selectedPuestoForActivities?.id}
                              />
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

