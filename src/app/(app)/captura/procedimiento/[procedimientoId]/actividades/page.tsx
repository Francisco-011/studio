
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useActividades, type Actividad } from '@/contexts/ActividadesContext';
import { useProcedimientos, type Procedimiento } from '@/contexts/ProcedimientosContext';
import { usePoliticas, politicaLinkTypes, type PoliticaVinculo } from '@/contexts/PoliticasContext';

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { PlusCircle, Save, Edit2, Trash2, ArrowUp, ArrowDown, Workflow, AlertTriangle, Loader2, ChevronDown } from "lucide-react";

const activityCaptureFormSchema = z.object({
  nombre: z.string().min(3, 'El nombre de la actividad es requerido (mínimo 3 caracteres).'),
  descripcionBreve: z.string().optional(),
  politicasAsociadas: z.array(z.object({
    policyId: z.string(),
    linkType: z.string(),
  })).optional().default([]),
});
type ActivityCaptureFormData = z.infer<typeof activityCaptureFormSchema>;

type LocalActivityDefinition = ActivityCaptureFormData & {
  tempId: string;
};

export default function DefinirActividadesProcedimientoPage() {
  const router = useRouter();
  const params = useParams();
  const procedimientoId = params.procedimientoId as string;

  const { actividades: globalActivities, addActividad, updateActividad: updateGlobalActivity, isLoadingActividades } = useActividades();
  const { procedimientos, updateProcedimiento, isLoadingProcedimientos } = useProcedimientos();
  const { politicas, isLoadingPoliticas } = usePoliticas();

  const [parentProcedimiento, setParentProcedimiento] = useState<Procedimiento | null>(null);
  const [definedActivities, setDefinedActivities] = useState<LocalActivityDefinition[]>([]);
  
  const [isActivityFormOpen, setIsActivityFormOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<(LocalActivityDefinition & { index: number }) | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [similarActivityWarning, setSimilarActivityWarning] = useState<string | null>(null);

  const activityForm = useForm<ActivityCaptureFormData>({
    resolver: zodResolver(activityCaptureFormSchema),
    defaultValues: { nombre: '', descripcionBreve: '', politicasAsociadas: [] },
  });

  const watchedActivityName = activityForm.watch('nombre');

  useEffect(() => {
    if (procedimientoId && !isLoadingProcedimientos) {
      const currentProcedimiento = procedimientos.find(p => p.id === procedimientoId);
      if (currentProcedimiento) {
        setParentProcedimiento(currentProcedimiento);
        if (currentProcedimiento.activityOrder && currentProcedimiento.activityOrder.length > 0 && !isLoadingActividades) {
            const preloadedActivities: LocalActivityDefinition[] = currentProcedimiento.activityOrder
                .map(actId => {
                    const globalAct = globalActivities.find(ga => ga.id === actId);
                    if (globalAct) {
                        return {
                            tempId: globalAct.id,
                            nombre: globalAct.nombre,
                            descripcionBreve: globalAct.descripcionBreve,
                            politicasAsociadas: globalAct.politicasAsociadas || [],
                        };
                    }
                    return null;
                })
                .filter((act): act is LocalActivityDefinition => act !== null);
            setDefinedActivities(preloadedActivities);
        }
      } else {
        toast({ title: "Error", description: "Procedimiento padre no encontrado.", variant: "destructive" });
        router.push('/procesos-y-flujos-registrados');
      }
      setIsLoading(false);
    }
  }, [procedimientoId, router, procedimientos, globalActivities, isLoadingActividades, isLoadingProcedimientos]);

  const openAddActivityDialog = () => {
    activityForm.reset({ nombre: '', descripcionBreve: '', politicasAsociadas: [] });
    setEditingActivity(null);
    setIsActivityFormOpen(true);
  };

  const openEditActivityDialog = (activity: LocalActivityDefinition, index: number) => {
    activityForm.reset(activity);
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
            if (editingActivity && act.id === editingActivity.tempId) return false;
            return act.nombre.trim().toLowerCase() === trimmedLowerName;
        });

        if (existingActivity) {
            setSimilarActivityWarning(`Advertencia: ya existe una actividad con un nombre idéntico.`);
        } else {
            setSimilarActivityWarning(null);
        }
    } else {
        setSimilarActivityWarning(null);
    }
  }, [watchedActivityName, globalActivities, editingActivity]);

  const handleActivityFormSubmit = (data: ActivityCaptureFormData) => {
    if (editingActivity) {
      setDefinedActivities(prev => prev.map((act, idx) => 
        idx === editingActivity.index ? { ...act, ...data } : act
      ));
      toast({ title: "Actividad Actualizada en Lista" });
    } else {
      setDefinedActivities(prev => [...prev, { ...data, tempId: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}` }]);
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
    if (!parentProcedimiento) return;
    setIsSaving(true);
    const finalActivityIds: string[] = [];

    try {
      for (const localAct of definedActivities) {
        let activityIdToLink: string;
        const existingGlobalActivity = globalActivities.find(ga => ga.id === localAct.tempId);
        const activityDataPayload = {
          nombre: localAct.nombre,
          descripcionBreve: localAct.descripcionBreve,
          politicasAsociadas: localAct.politicasAsociadas,
          procedimientoId: parentProcedimiento.id,
        };

        if (existingGlobalActivity) {
          activityIdToLink = existingGlobalActivity.id;
          await updateGlobalActivity(existingGlobalActivity.id, activityDataPayload);
        } else {
          const newGlobalActData = { ...activityDataPayload, activa: true };
          const addedActivity = await addActividad(newGlobalActData); 
          activityIdToLink = addedActivity.id;
        }
        finalActivityIds.push(activityIdToLink);
      }

      await updateProcedimiento(parentProcedimiento.id, { activityOrder: finalActivityIds });

      toast({ title: "Éxito", description: `Actividades guardadas para el procedimiento '${parentProcedimiento.nombre}'.` });
      router.push(`/procesos-y-flujos-registrados`);
    } catch (e) {
      console.error("Error saving activities:", e);
      toast({ title: "Error al Guardar", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };


  if (isLoading || !parentProcedimiento || isLoadingActividades || isLoadingProcedimientos) {
    return <div className="container mx-auto py-8 flex items-center justify-center min-h-[400px]"><Loader2 className="h-16 w-16 text-primary animate-spin" /><p className="ml-4 text-lg">Cargando detalles...</p></div>;
  }

  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-2 mb-1">
            <Workflow className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl font-headline">Definir Actividades para: {parentProcedimiento.nombre}</CardTitle>
          </div>
          <CardDescription>Agregue, ordene y detalle las actividades de este procedimiento.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 flex justify-end">
            <Button onClick={openAddActivityDialog}>
              <PlusCircle className="mr-2 h-4 w-4" /> Agregar Actividad
            </Button>
          </div>

          {definedActivities.length > 0 ? (
            <div className="rounded-md border mb-6">
              <Table>
                <TableHeader><TableRow><TableHead className="w-[50px]">Orden</TableHead><TableHead>Nombre Actividad</TableHead><TableHead className="text-right w-[200px]">Acciones</TableHead></TableRow></TableHeader>
                <TableBody>
                  {definedActivities.map((act, index) => (
                    <TableRow key={`${act.tempId}-${index}`}>
                      <TableCell className="text-center font-medium">{index + 1}</TableCell>
                      <TableCell>{act.nombre}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="icon" onClick={() => handleMoveActivity(index, 'up')} disabled={index === 0}><ArrowUp className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleMoveActivity(index, 'down')} disabled={index === definedActivities.length - 1}><ArrowDown className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => openEditActivityDialog(act, index)}><Edit2 className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteActivityFromList(act.tempId)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="mb-6 p-8 border border-dashed rounded-lg text-center bg-muted/20"><Workflow className="h-12 w-12 mx-auto text-muted-foreground mb-3" /><p className="font-semibold">Sin actividades definidas.</p><p className="text-sm text-muted-foreground">Comience agregando una actividad.</p></div>
          )}

          <div className="flex justify-between items-center mt-8">
             <Button variant="outline" onClick={() => router.push(`/captura/${parentProcedimiento.procesoId}/procedimientos`)} disabled={isSaving}>Volver a Procedimientos</Button>
            <Button onClick={handleSaveAllAndFinish} size="lg" disabled={isSaving || definedActivities.length === 0}>
              {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
              {isSaving ? "Guardando..." : "Finalizar y Guardar Actividades"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isActivityFormOpen} onOpenChange={(isOpen) => { if (!isSaving) setIsActivityFormOpen(isOpen); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editingActivity ? 'Editar Actividad' : 'Agregar Actividad'}</DialogTitle></DialogHeader>
          <Form {...activityForm}>
            <form onSubmit={activityForm.handleSubmit(handleActivityFormSubmit)} className="space-y-4 py-4">
              <FormField control={activityForm.control} name="nombre" render={({ field }) => (<FormItem><FormLabel>Nombre Actividad</FormLabel><FormControl><Input {...field} /></FormControl>{similarActivityWarning && (<FormDescription className="text-amber-600"><AlertTriangle className="h-4 w-4 inline-block mr-1" />{similarActivityWarning}</FormDescription>)}<FormMessage /></FormItem>)} />
              <FormField control={activityForm.control} name="descripcionBreve" render={({ field }) => (<FormItem><FormLabel>Descripción Breve (Opcional)</FormLabel><FormControl><Textarea {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={activityForm.control} name="politicasAsociadas" render={({ field }) => (<FormItem><FormLabel>Políticas Asociadas (Opcional)</FormLabel><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" className="w-full justify-between">{field.value?.length || 0} seleccionadas <ChevronDown className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]"><DropdownMenuLabel>Políticas</DropdownMenuLabel><DropdownMenuSeparator />{politicas.map(p => (<DropdownMenuCheckboxItem key={p.id} checked={field.value?.some(v => v.policyId === p.id)} onCheckedChange={checked => field.onChange(checked ? [...(field.value || []), { policyId: p.id, linkType: 'Aplica a' }] : field.value?.filter(v => v.policyId !== p.id))}>{p.codigo} - {p.titulo}</DropdownMenuCheckboxItem>))}</DropdownMenuContent></DropdownMenu><FormMessage /></FormItem>)} />
              <DialogFooter><DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose><Button type="submit">{editingActivity ? 'Actualizar' : 'Agregar'}</Button></DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
