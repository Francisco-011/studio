
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams, usePathname } from 'next/navigation';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useProcedimientos, type Procedimiento, type ProcedimientoCreationData } from '@/contexts/ProcedimientosContext';
import { useProcesos, type CapturedProcess } from '@/contexts/ProcesosContext';

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { PlusCircle, Save, Edit2, Trash2, ArrowUp, ArrowDown, Workflow, Loader2, ListOrdered } from "lucide-react";

const procedimientoCaptureFormSchema = z.object({
  nombre: z.string().min(3, 'El nombre del procedimiento es requerido (mínimo 3 caracteres).'),
  descripcion: z.string().optional(),
});
type ProcedimientoCaptureFormData = z.infer<typeof procedimientoCaptureFormSchema>;

type LocalProcedimientoDefinition = ProcedimientoCaptureFormData & {
  tempId: string;
};

export default function DefinirProcedimientosPage() {
  const router = useRouter();
  const params = useParams();
  const processId = params.processId as string;

  const { procedimientos: globalProcedimientos, addProcedimiento, updateProcedimiento: updateGlobalProcedimiento, isLoadingProcedimientos } = useProcedimientos();
  const { procesos, updateProceso, isLoadingProcesos } = useProcesos();

  const [parentProcess, setParentProcess] = useState<CapturedProcess | null>(null);
  const [definedProcedimientos, setDefinedProcedimientos] = useState<LocalProcedimientoDefinition[]>([]);
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProcedimiento, setEditingProcedimiento] = useState<(LocalProcedimientoDefinition & { index: number }) | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<ProcedimientoCaptureFormData>({
    resolver: zodResolver(procedimientoCaptureFormSchema),
    defaultValues: { nombre: '', descripcion: '' },
  });

  useEffect(() => {
    if (processId && !isLoadingProcesos) {
      const currentProcess = procesos.find(p => p.id === processId);
      if (currentProcess) {
        setParentProcess(currentProcess);
        if (currentProcess.procedimientoOrder && currentProcess.procedimientoOrder.length > 0 && !isLoadingProcedimientos) {
            const preloadedData: LocalProcedimientoDefinition[] = currentProcess.procedimientoOrder
                .map(procId => {
                    const globalProc = globalProcedimientos.find(gp => gp.id === procId);
                    if (globalProc) {
                        return { tempId: globalProc.id, nombre: globalProc.nombre, descripcion: globalProc.descripcion };
                    }
                    return null;
                })
                .filter((p): p is LocalProcedimientoDefinition => p !== null);
            setDefinedProcedimientos(preloadedData);
        }
      } else {
        toast({ title: "Error", description: "Proceso padre no encontrado.", variant: "destructive" });
        router.push('/procesos-y-flujos-registrados');
      }
      setIsLoading(false);
    }
  }, [processId, router, procesos, globalProcedimientos, isLoadingProcedimientos, isLoadingProcesos]);

  const openAddDialog = () => {
    form.reset({ nombre: '', descripcion: '' });
    setEditingProcedimiento(null);
    setIsFormOpen(true);
  };

  const openEditDialog = (procedimiento: LocalProcedimientoDefinition, index: number) => {
    form.reset(procedimiento);
    setEditingProcedimiento({ ...procedimiento, index });
    setIsFormOpen(true);
  };

  const handleFormSubmit = (data: ProcedimientoCaptureFormData) => {
    if (editingProcedimiento) {
      setDefinedProcedimientos(prev => prev.map((item, idx) => 
        idx === editingProcedimiento.index ? { ...item, ...data } : item
      ));
    } else {
      setDefinedProcedimientos(prev => [...prev, { ...data, tempId: `${Date.now()}` }]);
    }
    setIsFormOpen(false);
  };

  const handleDeleteFromList = (tempId: string) => {
    setDefinedProcedimientos(prev => prev.filter(item => item.tempId !== tempId));
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const newItems = [...definedProcedimientos];
    const item = newItems[index];
    newItems.splice(index, 1);
    newItems.splice(direction === 'up' ? index - 1 : index + 1, 0, item);
    setDefinedProcedimientos(newItems);
  };

  const handleSaveAllAndFinish = async () => {
    if (!parentProcess) return;
    setIsSaving(true);
    const finalProcedimientoIds: string[] = [];

    try {
      for (const localProc of definedProcedimientos) {
        let idToLink: string;
        const existingGlobal = globalProcedimientos.find(gp => gp.id === localProc.tempId);
        const payload: ProcedimientoCreationData = {
          nombre: localProc.nombre,
          descripcion: localProc.descripcion,
          procesoId: parentProcess.id,
          activityOrder: existingGlobal?.activityOrder || [],
        };

        if (existingGlobal) {
          idToLink = existingGlobal.id;
          await updateGlobalProcedimiento(idToLink, payload);
        } else {
          const newProc = await addProcedimiento(payload);
          if (!newProc) throw new Error("Failed to create new procedimiento.");
          idToLink = newProc.id;
        }
        finalProcedimientoIds.push(idToLink);
      }

      await updateProceso(parentProcess.id, { procedimientoOrder: finalProcedimientoIds, updatedAt: Date.now() });
      toast({ title: "Éxito", description: `Procedimientos guardados para '${parentProcess.proceso}'.` });
      router.push('/procesos-y-flujos-registrados');
    } catch (e) {
      console.error("Error saving:", e);
      toast({ title: "Error al Guardar", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !parentProcess) {
    return <div className="container mx-auto py-8 flex justify-center"><Loader2 className="h-16 w-16 animate-spin" /></div>;
  }

  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-2 mb-1"><ListOrdered className="h-6 w-6 text-primary" /><CardTitle className="text-2xl font-headline">Definir Procedimientos para: {parentProcess.proceso}</CardTitle></div>
          <CardDescription>Agregue, ordene y detalle los procedimientos que componen este proceso.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 flex justify-end"><Button onClick={openAddDialog}><PlusCircle className="mr-2 h-4 w-4" /> Agregar Procedimiento</Button></div>
          {definedProcedimientos.length > 0 ? (
            <div className="rounded-md border mb-6">
              <Table>
                <TableHeader><TableRow><TableHead className="w-[50px]">Orden</TableHead><TableHead>Nombre Procedimiento</TableHead><TableHead>Actividades</TableHead><TableHead className="text-right w-[200px]">Acciones</TableHead></TableRow></TableHeader>
                <TableBody>
                  {definedProcedimientos.map((proc, index) => (
                    <TableRow key={proc.tempId}>
                      <TableCell className="text-center font-medium">{index + 1}</TableCell>
                      <TableCell>{proc.nombre}</TableCell>
                      <TableCell><Button variant="link" size="sm" onClick={() => router.push(`/captura/procedimiento/${proc.tempId}/actividades`)}>Definir Actividades</Button></TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="icon" onClick={() => handleMove(index, 'up')} disabled={index === 0}><ArrowUp className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleMove(index, 'down')} disabled={index === definedProcedimientos.length - 1}><ArrowDown className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(proc, index)}><Edit2 className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteFromList(proc.tempId)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="mb-6 p-8 border border-dashed rounded-lg text-center bg-muted/20"><Workflow className="h-12 w-12 mx-auto text-muted-foreground mb-3" /><p className="font-semibold">Sin procedimientos definidos.</p></div>
          )}
          <div className="flex justify-end mt-8"><Button onClick={handleSaveAllAndFinish} size="lg" disabled={isSaving || definedProcedimientos.length === 0}>{isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}{isSaving ? "Guardando..." : "Finalizar y Guardar"}</Button></div>
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editingProcedimiento ? 'Editar Procedimiento' : 'Agregar Procedimiento'}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 py-4">
              <FormField control={form.control} name="nombre" render={({ field }) => (<FormItem><FormLabel>Nombre</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="descripcion" render={({ field }) => (<FormItem><FormLabel>Descripción (Opcional)</FormLabel><FormControl><Textarea {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
              <DialogFooter><DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose><Button type="submit">{editingProcedimiento ? 'Actualizar' : 'Agregar'}</Button></DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
