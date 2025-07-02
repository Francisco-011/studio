
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
import { ClipboardEdit, Save, AlertTriangle, CalendarCheck2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAreas } from "@/contexts/AreasContext";
import { useDepartamentos } from "@/contexts/DepartamentosContext";
import { usePuestos } from "@/contexts/PuestosContext";
import { useProcesos, capturaFormSchema, type CapturaFormData, clasificacionOptions, auditFrequencyOptions } from '@/contexts/ProcesosContext';


const NO_DEPARTAMENTO_SELECTED = "__NO_DEPARTAMENTO__";


const defaultFormValues: Partial<CapturaFormData> = {
  area: undefined,
  departamento: undefined,
  puesto: undefined,
  proceso: "",
  descripcion: "",
  clasificacion: "Privado",
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
            Este es el punto de entrada principal para registrar de forma detallada todos los procesos operativos. Los tiempos y costos se calculan automáticamente a partir de las actividades que defina más adelante.
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
                    <FormLabel>Objetivo</FormLabel>
                    <FormControl><Textarea placeholder="Describa el propósito principal y el resultado esperado de este proceso." className="min-h-[120px]" {...field} /></FormControl>
                    <FormDescription>Proporcione una explicación clara y concisa del objetivo del proceso.</FormDescription>
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
