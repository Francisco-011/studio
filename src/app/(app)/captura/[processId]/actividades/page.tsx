
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useActividades, type Actividad } from '@/contexts/ActividadesContext';
import { useProcesos, type CapturedProcess } from '@/contexts/ProcesosContext';
import { useSistemasCostos } from '@/contexts/SistemasCostosContext'; 
import { useAreas } from '@/contexts/AreasContext';
import { usePuestos } from '@/contexts/PuestosContext';
import { useDepartamentos } from '@/contexts/DepartamentosContext';
import { usePoliticas } from '@/contexts/PoliticasContext';

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
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { PlusCircle, Save, Edit2, Trash2, ArrowUp, ArrowDown, Workflow, AlertTriangle, Loader2, ChevronDown } from "lucide-react";

const NO_SYSTEM_SELECTED_VALUE = "__NO_SYSTEM_SELECTED__";

const activityCaptureFormSchema = z.object({
  nombre: z.string().min(3, 'El nombre de la actividad es requerido (mínimo 3 caracteres).'),
  descripcionBreve: z.string().optional(),
  sistemaUtilizado: z.string().optional(), 
  politicasAsociadasIds: z.array(z.string()).optional().default([]),
});
type ActivityCaptureFormData = z.infer<typeof activityCaptureFormSchema>;

type LocalActivityDefinition = ActivityCaptureFormData & {
  tempId: string;
};

export default function DefinirActividadesProcesoPage() {
  const router = useRouter();
  const params = useParams();
  const processId = params.processId as string;

  const { actividades: globalActivities, addActividad, updateActividad: updateGlobalActivity, isLoadingActividades: isLoadingGlobalActividades } = useActividades();
  const { procesos, updateProceso, isLoadingProcesos } = useProcesos();
  const { sistemas: allConfiguredSistemas, isLoadingSistemasCostos } = useSistemasCostos(); 
  const { areas, isLoading: isLoadingAreas } = useAreas();
  const { puestos, isLoadingPuestos } = usePuestos();
  const { departamentos, isLoading: isLoadingDepartamentos } = useDepartamentos();
  const { politicas, isLoadingPoliticas } = usePoliticas();


  const [parentProcess, setParentProcess] = useState<CapturedProcess | null>(null);
  const [definedActivities, setDefinedActivities] = useState<LocalActivityDefinition[]>([]);
  
  const [isActivityFormOpen, setIsActivityFormOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<(LocalActivityDefinition & { index: number }) | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [similarActivityWarning, setSimilarActivityWarning] = useState<string | null>(null);


  const activityForm = useForm<ActivityCaptureFormData>({
    resolver: zodResolver(activityCaptureFormSchema),
    defaultValues: {
      nombre: '',
      descripcionBreve: '',
      sistemaUtilizado: undefined, 
      politicasAsociadasIds: [],
    },
  });

  const watchedActivityName = activityForm.watch('nombre');

  useEffect(() => {
    if (processId && !isLoadingProcesos) {
      const currentProcess = procesos.find(p => p.id === processId);
      if (currentProcess) {
        setParentProcess(currentProcess);
        if (currentProcess.activityOrder && currentProcess.activityOrder.length > 0 && !isLoadingGlobalActividades) {
            const preloadedActivities: LocalActivityDefinition[] = currentProcess.activityOrder
                .map(actId => {
                    const globalAct = globalActivities.find(ga => ga.id === actId);
                    if (globalAct) {
                        return {
                            tempId: globalAct.id,
                            nombre: globalAct.nombre,
                            descripcionBreve: globalAct.descripcionBreve,
                            sistemaUtilizado: globalAct.sistemaUtilizado,
                            politicasAsociadasIds: globalAct.politicasAsociadasIds || [],
                        };
                    }
                    return null;
                })
                .filter((act): act is LocalActivityDefinition => act !== null);
            setDefinedActivities(preloadedActivities);
        }
      } else {
        toast({ title: "Error", description: "Proceso padre no encontrado.", variant: "destructive" });
        router.push('/procesos-y-flujos-registrados');
      }
      setIsLoading(false);
    }
  }, [processId, router, procesos, globalActivities, isLoadingGlobalActividades, isLoadingProcesos]);

  const availableSistemasForActivityForm = useMemo(() => {
    if (isLoadingSistemasCostos || isLoadingAreas || isLoadingDepartamentos || isLoadingPuestos || !parentProcess) return [];

    const parentAreaObj = areas.find(a => a.nombre === parentProcess.area);
    const parentDeptoObj = parentAreaObj ? departamentos.find(d => d.nombre === parentProcess.departamento && d.areaId === parentAreaObj.id) : undefined;
    const parentPuestoObj = parentAreaObj ? puestos.find(p => {
        if (p.nombre !== parentProcess.puesto || p.areaId !== parentAreaObj.id) return false;
        return p.departamentoId === (parentDeptoObj ? parentDeptoObj.id : undefined);
    }) : undefined;

    return allConfiguredSistemas.filter(sistema => {
      if (sistema.scope === "Empresa") return true;
      if (sistema.scope === "Área" && parentAreaObj && sistema.scopeId === parentAreaObj.id) return true;
      if (sistema.scope === "Departamento" && parentDeptoObj && sistema.scopeId === parentDeptoObj.id) return true;
      if (sistema.scope === "Puesto" && parentPuestoObj && sistema.scopeId === parentPuestoObj.id) return true;
      return false;
    }).sort((a,b) => a.nombre.localeCompare(b.nombre));
  }, [allConfiguredSistemas, parentProcess, areas, departamentos, puestos, isLoadingSistemasCostos, isLoadingAreas, isLoadingDepartamentos, isLoadingPuestos]);

  const openAddActivityDialog = () => {
    activityForm.reset({ 
        nombre: '',
        descripcionBreve: '',
        sistemaUtilizado: undefined,
        politicasAsociadasIds: [],
    });
    setEditingActivity(null);
    setIsActivityFormOpen(true);
  };

  const openEditActivityDialog = (activity: LocalActivityDefinition, index: number) => {
    activityForm.reset({
        nombre: activity.nombre,
        descripcionBreve: activity.descripcionBreve,
        sistemaUtilizado: activity.sistemaUtilizado || NO_SYSTEM_SELECTED_VALUE,
        politicasAsociadasIds: activity.politicasAsociadasIds,
    });
    setEditingActivity({ ...activity, index });
    setIsActivityFormOpen(true);
  };

   useEffect(() => {
    if (watchedActivityName && globalActivities.length > 0) {
        const trimmedLowerName = watchedActivityName.trim().toLowerCase();
        if (!trimmedLowerName) {
          setSimilarActivityWarning(null);
          return;
        }

        const existingActivity = globalActivities.find(act => {
            if (editingActivity && act.id === editingActivity.tempId) {
                return false;
            }
            return act.nombre.trim().toLowerCase() === trimmedLowerName;
        });

        if (existingActivity) {
            const associatedProcess = procesos.find(p => existingActivity.procesosAsociadosIds?.includes(p.id));
            
            let contextMessage = "en otro proceso.";
            if (associatedProcess) {
                contextMessage = `en el proceso "${associatedProcess.proceso}".`;
            }

            setSimilarActivityWarning(`Advertencia: ya existe una actividad con un nombre idéntico ${contextMessage}`);
        } else {
            setSimilarActivityWarning(null);
        }
    } else {
        setSimilarActivityWarning(null);
    }
  }, [watchedActivityName, globalActivities, editingActivity, procesos]);

  const handleActivityFormSubmit = (data: ActivityCaptureFormData) => {
    const activityDataForStorage: Omit<LocalActivityDefinition, 'tempId'> = {
      ...data,
      sistemaUtilizado: data.sistemaUtilizado === NO_SYSTEM_SELECTED_VALUE ? undefined : data.sistemaUtilizado,
    };

    if (editingActivity) {
      setDefinedActivities(prev => prev.map((act, idx) => 
        idx === editingActivity.index ? { ...act, ...activityDataForStorage } : act
      ));
      toast({ title: "Actividad Actualizada en Lista" });
    } else {
      setDefinedActivities(prev => [...prev, { ...activityDataForStorage, tempId: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}` }]);
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
    newActivities.splice(index, 1); 
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    newActivities.splice(newIndex, 0, activityToMove); 
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
      for (const localAct of definedActivities) {
        let activityIdToLink: string;
        
        const existingGlobalActivity = globalActivities.find(ga => ga.id === localAct.tempId);

        const activityDataPayload = {
          nombre: localAct.nombre,
          descripcionBreve: localAct.descripcionBreve,
          sistemaUtilizado: localAct.sistemaUtilizado,
          politicasAsociadasIds: localAct.politicasAsociadasIds,
        };

        if (existingGlobalActivity) {
          activityIdToLink = existingGlobalActivity.id;
          const updatedAssociatedIds = Array.from(new Set([...(existingGlobalActivity.procesosAsociadosIds || []), parentProcess.id]));
          
          await updateGlobalActivity(existingGlobalActivity.id, {
            ...activityDataPayload,
            procesosAsociadosIds: updatedAssociatedIds,
          }, procesos);
        } else {
          const newGlobalActData = {
            ...activityDataPayload,
            activa: true,
            procesosAsociadosIds: [parentProcess.id],
          };
          const addedActivity = await addActividad(newGlobalActData); 
          activityIdToLink = addedActivity.id;
        }
        finalActivityIdsForProcessOrder.push(activityIdToLink);
      }

      await updateProceso(parentProcess.id, {
        activityOrder: finalActivityIdsForProcessOrder,
        updatedAt: Date.now(),
      });

      toast({ title: "Éxito", description: `Actividades guardadas y vinculadas al proceso '${parentProcess.proceso}'.` });
      router.push('/procesos-y-flujos-registrados');
    } catch (e) {
      console.error("Error saving process activities:", e);
      toast({ title: "Error al Guardar", description: "No se pudieron guardar las actividades del proceso. Revise la consola.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };


  if (isLoading || !parentProcess || isLoadingGlobalActividades || isLoadingProcesos) {
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
            Agregue, ordene y detalle las actividades que componen este proceso. Las actividades se guardarán en el orden definido en la tabla.
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
                    <TableHead>Sistema</TableHead>
                    <TableHead className="text-right w-[200px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {definedActivities.map((act, index) => (
                    <TableRow key={`${act.tempId}-${index}`}>
                      <TableCell className="text-center font-medium">{index + 1}</TableCell>
                      <TableCell>{act.nombre}</TableCell>
                      <TableCell>{act.sistemaUtilizado || '-'}</TableCell>
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
             <Button variant="outline" onClick={() => router.push('/procesos-y-flujos-registrados')} disabled={isSaving}>
              Volver a Procesos Registrados
            </Button>
            <Button onClick={handleSaveAllAndFinish} size="lg" disabled={isSaving || definedActivities.length === 0}>
              {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
              {isSaving ? "Guardando..." : "Finalizar y Guardar Actividades del Proceso"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isActivityFormOpen} onOpenChange={(isOpen) => {
          if (isSaving && isOpen) return; 
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
            <form onSubmit={activityForm.handleSubmit(handleActivityFormSubmit)} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
              <FormField
                control={activityForm.control}
                name="nombre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre de la Actividad</FormLabel>
                    <FormControl><Input placeholder="Ej: Recibir Documentación, Validar Información" {...field} /></FormControl>
                    {similarActivityWarning && (
                      <FormDescription className="text-amber-600 flex items-center gap-1 pt-1">
                          <AlertTriangle className="h-4 w-4" /> {similarActivityWarning}
                      </FormDescription>
                    )}
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
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value || NO_SYSTEM_SELECTED_VALUE} 
                      disabled={isLoadingSistemasCostos || isLoadingAreas || isLoadingDepartamentos || isLoadingPuestos}
                    >
                      <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder={
                                (isLoadingSistemasCostos || isLoadingAreas || isLoadingPuestos || isLoadingDepartamentos) ? "Cargando..." : 
                                (availableSistemasForActivityForm.length === 0 ? "No hay sistemas aplicables" : "Seleccione un sistema")
                            } />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NO_SYSTEM_SELECTED_VALUE}>Ninguno / Manual</SelectItem>
                        {(isLoadingSistemasCostos || isLoadingAreas || isLoadingPuestos || isLoadingDepartamentos) ? (
                            <SelectItem value="loading-sistemas" disabled>Cargando...</SelectItem>
                        ) : availableSistemasForActivityForm.length === 0 ? (
                            <SelectItem value="no-sistemas-available" disabled>No hay sistemas para el contexto del proceso</SelectItem>
                        ) : (
                            availableSistemasForActivityForm.map((sys) => (
                            <SelectItem key={sys.id} value={sys.nombre}>{sys.nombre}</SelectItem>
                            ))
                        )}
                      </SelectContent>
                    </Select>
                     <FormDescription>Sistemas filtrados por el ámbito del proceso padre.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={activityForm.control}
                name="politicasAsociadasIds"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Políticas Asociadas (Opcional)</FormLabel>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full justify-between font-normal">
                          <span className="truncate">
                            {field.value && field.value.length > 0
                              ? `${field.value.length} política(s) seleccionada(s)`
                              : "Seleccionar políticas..."}
                          </span>
                          <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]" align="start">
                        <DropdownMenuLabel>Políticas Disponibles</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {isLoadingPoliticas ? (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">Cargando...</div>
                        ) : politicas.length === 0 ? (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">No hay políticas creadas.</div>
                        ) : (
                          politicas.map((politica) => (
                            <DropdownMenuCheckboxItem
                              key={politica.id}
                              checked={field.value?.includes(politica.id)}
                              onCheckedChange={(checked) => {
                                const currentSelected = field.value || [];
                                if (checked) {
                                  field.onChange([...currentSelected, politica.id]);
                                } else {
                                  field.onChange(currentSelected.filter((id) => id !== politica.id));
                                }
                              }}
                            >
                              {politica.codigo} - {politica.titulo}
                            </DropdownMenuCheckboxItem>
                          ))
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <FormDescription>Vincule esta actividad a una o más políticas.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
