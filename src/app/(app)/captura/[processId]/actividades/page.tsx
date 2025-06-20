
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useActividades, type Actividad } from '@/contexts/ActividadesContext';
import type { CapturedProcess } from '@/app/(app)/procesos-y-flujos-registrados/page';
import { availableSystems, frecuenciaOptions } from '@/app/(app)/captura/page'; // Import shared consts

import { Button } from "@/components/ui/button";
import {
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { PlusCircle, Save, Edit2, Trash2, ArrowUp, ArrowDown, Workflow, AlertTriangle, Loader2 } from "lucide-react";
import { cn } from '@/lib/utils';

const CAPTURED_DATA_LOCAL_STORAGE_KEY = 'proceza-captured-data';

// Schema for the individual activity form within this page
const activityCaptureFormSchema = z.object({
  nombre: z.string().min(3, 'El nombre de la actividad es requerido (mínimo 3 caracteres).'),
  descripcionBreve: z.string().optional(),
  sistemaUtilizado: z.string().optional(),
  tiempoEstimadoActividad: z.preprocess(
    (val) => (String(val).trim() === '' ? undefined : parseInt(String(val), 10)),
    z.number().int("El tiempo debe ser un número entero.").nonnegative("El tiempo debe ser positivo o cero.").optional()
  ),
  frecuenciaActividad: z.enum(frecuenciaOptions).optional(),
});
type ActivityCaptureFormData = z.infer<typeof activityCaptureFormSchema>;

// Type for activities managed locally on this page before saving globally
type LocalActivityDefinition = ActivityCaptureFormData & { tempId: string };

export default function DefinirActividadesProcesoPage() {
  const router = useRouter();
  const params = useParams();
  const processId = params.processId as string;

  const { actividades: globalActivities, addActividad: addGlobalActivity, updateActividad: updateGlobalActivity } = useActividades();

  const [parentProcess, setParentProcess] = useState<CapturedProcess | null>(null);
  const [definedActivities, setDefinedActivities] = useState<LocalActivityDefinition[]>([]);
  
  const [isActivityFormOpen, setIsActivityFormOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<(LocalActivityDefinition & { index: number }) | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const activityForm = useForm<ActivityCaptureFormData>({
    resolver: zodResolver(activityCaptureFormSchema),
    defaultValues: {
      nombre: '',
      descripcionBreve: '',
      sistemaUtilizado: undefined,
      tiempoEstimadoActividad: undefined,
      frecuenciaActividad: undefined,
    },
  });

  useEffect(() => {
    if (processId) {
      try {
        const storedData = localStorage.getItem(CAPTURED_DATA_LOCAL_STORAGE_KEY);
        if (storedData) {
          const allProcesses: CapturedProcess[] = JSON.parse(storedData);
          const currentProcess = allProcesses.find(p => p.id === processId);
          if (currentProcess) {
            setParentProcess(currentProcess);
            // If process already has activities (e.g., editing flow later), load them.
            // For now, this page is for NEW process activity definition, so start fresh.
          } else {
            toast({ title: "Error", description: "Proceso padre no encontrado.", variant: "destructive" });
            router.push('/captura');
          }
        }
      } catch (error) {
        console.error("Error loading parent process:", error);
        toast({ title: "Error al Cargar Proceso", variant: "destructive" });
        router.push('/captura');
      } finally {
        setIsLoading(false);
      }
    }
  }, [processId, router]);

  const openAddActivityDialog = () => {
    activityForm.reset();
    setEditingActivity(null);
    setIsActivityFormOpen(true);
  };

  const openEditActivityDialog = (activity: LocalActivityDefinition, index: number) => {
    activityForm.reset(activity);
    setEditingActivity({ ...activity, index });
    setIsActivityFormOpen(true);
  };

  const handleActivityFormSubmit = (data: ActivityCaptureFormData) => {
    if (editingActivity) {
      setDefinedActivities(prev => prev.map((act, idx) => 
        idx === editingActivity.index ? { ...act, ...data } : act
      ));
      toast({ title: "Actividad Actualizada en Lista" });
    } else {
      setDefinedActivities(prev => [...prev, { ...data, tempId: Date.now().toString() }]);
      toast({ title: "Actividad Agregada a la Lista" });
    }
    setIsActivityFormOpen(false);
  };

  const handleDeleteActivityFromList = (tempId: string) => {
    setDefinedActivities(prev => prev.filter(act => act.tempId !== tempId));
    toast({ title: "Actividad Eliminada de la Lista", variant: "destructive" });
  };

  const handleMoveActivity = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === definedActivities.length - 1) return;

    const newActivities = [...definedActivities];
    const activityToMove = newActivities[index];
    newActivities.splice(index, 1); // Remove item
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    newActivities.splice(newIndex, 0, activityToMove); // Insert item
    setDefinedActivities(newActivities);
  };

  const handleSaveAllAndFinish = async () => {
    if (!parentProcess || !parentProcess.id) {
      toast({ title: "Error", description: "No se puede encontrar el proceso padre para asociar actividades.", variant: "destructive" });
      return;
    }
    if (definedActivities.length === 0) {
      toast({ title: "Sin Actividades", description: "Agregue al menos una actividad antes de guardar.", variant: "default" });
      return;
    }

    setIsSaving(true);
    const finalActivityIdsForProcessOrder: string[] = [];

    try {
      // Make a mutable copy of global activities for processing within this function
      let currentGlobalActivities = [...globalActivities]; 

      for (const localAct of definedActivities) {
        let activityIdToLink: string;
        const existingGlobalActivity = currentGlobalActivities.find(ga => ga.nombre === localAct.nombre);

        const activityDataPayload = {
          nombre: localAct.nombre,
          descripcionBreve: localAct.descripcionBreve,
          sistemaUtilizado: localAct.sistemaUtilizado,
          tiempoEstimadoActividad: localAct.tiempoEstimadoActividad,
          frecuenciaActividad: localAct.frecuenciaActividad,
        };

        if (existingGlobalActivity) {
          activityIdToLink = existingGlobalActivity.id;
          const updatedAssociatedIds = Array.from(new Set([...(existingGlobalActivity.procesosAsociadosIds || []), parentProcess.id]));
          
          updateGlobalActivity(existingGlobalActivity.id, {
            ...activityDataPayload,
            procesosAsociadosIds: updatedAssociatedIds,
            activa: existingGlobalActivity.activa, // Preserve existing active status
          });
        } else {
          const newGlobalActData = {
            ...activityDataPayload,
            activa: true, // New activities default to active
            procesosAsociadosIds: [parentProcess.id],
          };
          const addedActivity = addGlobalActivity(newGlobalActData); // Assumes this now returns the Activity
          activityIdToLink = addedActivity.id;
          currentGlobalActivities.push(addedActivity); // Add to our local copy for subsequent checks
        }
        finalActivityIdsForProcessOrder.push(activityIdToLink);
      }

      // Update the parent process in localStorage
      const storedProcessesString = localStorage.getItem(CAPTURED_DATA_LOCAL_STORAGE_KEY);
      let allProcesses: CapturedProcess[] = storedProcessesString ? JSON.parse(storedProcessesString) : [];
      const processIndex = allProcesses.findIndex(p => p.id === parentProcess.id);

      if (processIndex !== -1) {
        allProcesses[processIndex] = {
          ...allProcesses[processIndex],
          activityOrder: finalActivityIdsForProcessOrder,
        };
        localStorage.setItem(CAPTURED_DATA_LOCAL_STORAGE_KEY, JSON.stringify(allProcesses));
        toast({ title: "Éxito", description: `Actividades guardadas y vinculadas al proceso '${parentProcess.proceso}'.` });
        router.push('/procesos-y-flujos-registrados');
      } else {
        throw new Error("Proceso padre no encontrado en localStorage al momento de guardar orden de actividades.");
      }

    } catch (e) {
      console.error("Error saving process activities:", e);
      toast({ title: "Error al Guardar", description: "No se pudieron guardar las actividades del proceso. Revise la consola.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };


  if (isLoading || !parentProcess) {
    return (
      <div className="container mx-auto py-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-16 w-16 text-primary animate-spin" />
        <p className="ml-4 text-lg text-muted-foreground">Cargando detalles del proceso...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-2 mb-1">
            <Workflow className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl font-headline">
              Definir Actividades para: {parentProcess.proceso}
            </CardTitle>
          </div>
          <CardDescription>
            Agregue, ordene y detalle las actividades que componen este proceso. Se guardarán en orden cronológico de adición, pero puede ajustar el orden.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 flex justify-end">
            <Button onClick={openAddActivityDialog}>
              <PlusCircle className="mr-2 h-4 w-4" /> Agregar Actividad a la Lista
            </Button>
          </div>

          {definedActivities.length > 0 ? (
            <div className="rounded-md border mb-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Orden</TableHead>
                    <TableHead>Nombre Actividad</TableHead>
                    <TableHead>Descripción Breve</TableHead>
                    <TableHead>Sistema</TableHead>
                    <TableHead className="text-center">Tiempo (min)</TableHead>
                    <TableHead>Frecuencia</TableHead>
                    <TableHead className="text-right w-[200px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {definedActivities.map((act, index) => (
                    <TableRow key={act.tempId}>
                      <TableCell className="text-center font-medium">{index + 1}</TableCell>
                      <TableCell>{act.nombre}</TableCell>
                      <TableCell className="truncate max-w-xs">{act.descripcionBreve || '-'}</TableCell>
                      <TableCell>{act.sistemaUtilizado || '-'}</TableCell>
                      <TableCell className="text-center">{act.tiempoEstimadoActividad ?? '-'}</TableCell>
                      <TableCell>{act.frecuenciaActividad || '-'}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="icon" onClick={() => handleMoveActivity(index, 'up')} disabled={index === 0} title="Mover Arriba">
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleMoveActivity(index, 'down')} disabled={index === definedActivities.length - 1} title="Mover Abajo">
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEditActivityDialog(act, index)} title="Editar Actividad">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteActivityFromList(act.tempId)} className="text-destructive hover:text-destructive" title="Eliminar Actividad de Lista">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="mb-6 p-8 border border-dashed border-border rounded-lg flex flex-col items-center justify-center min-h-[150px] bg-muted/20">
              <Workflow className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-md font-semibold text-foreground">No hay actividades definidas para este proceso aún.</p>
              <p className="text-sm text-muted-foreground">Comience haciendo clic en "Agregar Actividad a la Lista".</p>
            </div>
          )}

          <div className="flex justify-between items-center mt-8">
             <Button variant="outline" onClick={() => router.push('/captura')} disabled={isSaving}>
              Cancelar y Volver a Captura
            </Button>
            <Button onClick={handleSaveAllAndFinish} size="lg" disabled={isSaving || definedActivities.length === 0}>
              {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
              {isSaving ? "Guardando..." : "Finalizar y Guardar Actividades del Proceso"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Dialog for Adding/Editing Activity in this page's list */}
      <Dialog open={isActivityFormOpen} onOpenChange={(isOpen) => {
          if (isSaving && isOpen) return; // Prevent closing if saving
          setIsActivityFormOpen(isOpen);
          if (!isOpen) activityForm.reset();
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingActivity ? 'Editar Actividad de la Lista' : 'Agregar Nueva Actividad a la Lista'}</DialogTitle>
            <DialogDescription>
              Complete los detalles de la actividad para este proceso. Estos cambios son locales hasta que guarde todas las actividades del proceso.
            </DialogDescription>
          </DialogHeader>
          <Form {...activityForm}>
            <form onSubmit={activityForm.handleSubmit(handleActivityFormSubmit)} className="space-y-4 py-4">
              <FormField
                control={activityForm.control}
                name="nombre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre de la Actividad</FormLabel>
                    <FormControl><Input placeholder="Ej: Recibir Documentación, Validar Información" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={activityForm.control}
                name="descripcionBreve"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción Breve (Opcional)</FormLabel>
                    <FormControl><Textarea placeholder="Un resumen conciso de la actividad." {...field} value={field.value ?? ''} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={activityForm.control}
                name="sistemaUtilizado"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sistema Utilizado (Opcional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Seleccione un sistema" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="">Ninguno / Manual</SelectItem>
                        {availableSystems.map((sys) => (
                          <SelectItem key={sys.id} value={sys.nombre}>{sys.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={activityForm.control}
                  name="tiempoEstimadoActividad"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tiempo Estimado (min)</FormLabel>
                      <FormControl><Input type="number" placeholder="Ej: 15" {...field} value={field.value ?? ''} min="0" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={activityForm.control}
                  name="frecuenciaActividad"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Frecuencia de la Actividad</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Seleccione frecuencia" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">No aplica / Por instancia</SelectItem>
                          {frecuenciaOptions.map((opt) => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">Cancelar</Button>
                </DialogClose>
                <Button type="submit">{editingActivity ? 'Actualizar Actividad en Lista' : 'Agregar Actividad a Lista'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

