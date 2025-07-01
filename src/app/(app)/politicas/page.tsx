
'use client';

import { useState, useEffect, useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';

import { usePoliticas, type Politica, type NivelCompliance, nivelesCompliance, type PoliticaCreationData, politicaEstados, type PoliticaEstado } from '@/contexts/PoliticasContext';
import { useProcesos } from '@/contexts/ProcesosContext';
import { useProcedimientos } from '@/contexts/ProcedimientosContext';
import { useActividades, type CambioHistorial } from '@/contexts/ActividadesContext';
import { useAreas } from '@/contexts/AreasContext';
import { useDepartamentos } from '@/contexts/DepartamentosContext';
import { clasificacionOptions } from '@/contexts/ProcesosContext';
import { usePermissions } from '@/contexts/PermissionsContext';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { toast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, PlusCircle, Edit2, Trash2, Loader2, Search, AlertTriangle, CalendarIcon, ChevronDown, History, MoreVertical, Send, CheckCheck, Archive, ShieldQuestion } from "lucide-react";
import { cn } from '@/lib/utils';


const NO_AREA_SELECTED = "__NO_AREA_SELECTED__";
const NO_DEPARTAMENTO_SELECTED = "__NO_DEPARTAMENTO__";

const politicaFormSchema = z.object({
  id: z.string().optional(),
  titulo: z.string().min(3, 'El título es requerido (mínimo 3 caracteres).'),
  descripcion: z.string().min(10, 'La descripción es requerida (mínimo 10 caracteres).'),
  areaResponsable: z.string({ required_error: 'El área responsable es requerida.'}),
  departamentoResponsable: z.string().optional(),
  clasificacion: z.enum(clasificacionOptions),
  nivelCompliance: z.enum(nivelesCompliance),
  fechaVigencia: z.date({ required_error: 'La fecha de vigencia es requerida.' }),
  fechaRevision: z.date({ required_error: 'La fecha de revisión es requerida.' }),
  procesosAsociadosIds: z.array(z.string()).optional().default([]),
  procedimientosAsociadosIds: z.array(z.string()).optional().default([]),
  actividadesAsociadasIds: z.array(z.string()).optional().default([]),
  consecuenciasIncumplimiento: z.string().optional(),
  referenciasLegales: z.string().optional(),
}).refine(data => data.fechaRevision > data.fechaVigencia, {
  message: "La fecha de revisión debe ser posterior a la fecha de vigencia.",
  path: ["fechaRevision"],
});

type PoliticaFormData = z.infer<typeof politicaFormSchema>;

export default function PoliticasPage() {
  const { politicas, addPolitica, updatePolitica, deletePolitica, updatePoliticaStatus, isLoadingPoliticas } = usePoliticas();
  const { procesos, isLoadingProcesos } = useProcesos();
  const { procedimientos, isLoadingProcedimientos } = useProcedimientos();
  const { actividades, isLoadingActividades } = useActividades();
  const { areas, isLoading: isLoadingAreas } = useAreas();
  const { departamentos, isLoading: isLoadingDepartamentos } = useDepartamentos();
  const { hasPermission } = usePermissions();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPolitica, setEditingPolitica] = useState<Politica | null>(null);
  const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] = useState(false);
  const [politicaToDelete, setPoliticaToDelete] = useState<Politica | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [politicaForHistory, setPoliticaForHistory] = useState<Politica | null>(null);


  const form = useForm<PoliticaFormData>({
    resolver: zodResolver(politicaFormSchema),
  });

  const watchedArea = form.watch('areaResponsable');
  const availableDepartamentos = useMemo(() => {
    if (!watchedArea || isLoadingDepartamentos) return [];
    const areaId = areas.find(a => a.nombre === watchedArea)?.id;
    return areaId ? departamentos.filter(d => d.areaId === areaId) : [];
  }, [watchedArea, departamentos, areas, isLoadingDepartamentos]);

  useEffect(() => {
    if (isDialogOpen) {
      if (editingPolitica) {
        form.reset({
          ...editingPolitica,
          departamentoResponsable: editingPolitica.departamentoResponsable || NO_DEPARTAMENTO_SELECTED,
          fechaVigencia: parseISO(editingPolitica.fechaVigencia),
          fechaRevision: parseISO(editingPolitica.fechaRevision),
        });
      } else {
        form.reset({
          titulo: '',
          descripcion: '',
          areaResponsable: undefined,
          departamentoResponsable: undefined,
          clasificacion: 'Privado',
          nivelCompliance: 'Recomendado',
          procesosAsociadosIds: [],
          procedimientosAsociadosIds: [],
          actividadesAsociadasIds: [],
          consecuenciasIncumplimiento: '',
          referenciasLegales: '',
        });
      }
    }
  }, [editingPolitica, isDialogOpen, form]);

  async function handleSubmit(data: PoliticaFormData) {
    const dataToSave: Omit<PoliticaCreationData, 'estado'> = {
      ...data,
      departamentoResponsable: data.departamentoResponsable === NO_DEPARTAMENTO_SELECTED ? undefined : data.departamentoResponsable,
      fechaVigencia: data.fechaVigencia.toISOString(),
      fechaRevision: data.fechaRevision.toISOString(),
    };
    if (editingPolitica) {
      await updatePolitica(editingPolitica.id, dataToSave);
    } else {
      await addPolitica(dataToSave);
    }
    setIsDialogOpen(false);
    setEditingPolitica(null);
  }

  function handleEdit(politica: Politica) {
    if (politica.estado === 'Aprobada' || politica.estado === 'Archivada') {
      toast({ title: 'Acción no permitida', description: 'Para editar, primero regrese la política al estado de "Borrador".', variant: 'default'});
      return;
    }
    setEditingPolitica(politica);
    setIsDialogOpen(true);
  }
  
  function handleViewHistory(politica: Politica) {
    setPoliticaForHistory(politica);
    setIsHistoryDialogOpen(true);
  }

  function promptDelete(politica: Politica) {
    setPoliticaToDelete(politica);
    setIsConfirmDeleteDialogOpen(true);
  }

  async function executeDelete() {
    if (!politicaToDelete) return;
    await deletePolitica(politicaToDelete.id);
    setIsConfirmDeleteDialogOpen(false);
    setPoliticaToDelete(null);
  }

  const filteredPoliticas = useMemo(() => 
    politicas.filter(p => p.titulo.toLowerCase().includes(searchTerm.toLowerCase()) || p.codigo.toLowerCase().includes(searchTerm.toLowerCase()))
  , [politicas, searchTerm]);

  const isLoadingAll = isLoadingPoliticas || isLoadingProcesos || isLoadingProcedimientos || isLoadingActividades || isLoadingAreas || isLoadingDepartamentos;

  if (isLoadingAll) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-16 w-16 text-primary animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl font-headline">Gestión de Políticas</CardTitle>
          </div>
          <CardDescription>Cree, edite y gestione el ciclo de vida de las políticas que rigen la organización.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 flex justify-between items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input placeholder="Buscar por título o código..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => { setEditingPolitica(null); setIsDialogOpen(true); }}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Agregar Política
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-3xl">
                <DialogHeader>
                  <DialogTitle>{editingPolitica ? 'Editar Política' : 'Crear Nueva Política'}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-4 max-h-[75vh] overflow-y-auto pr-4">
                    <FormField control={form.control} name="titulo" render={({ field }) => (<FormItem><FormLabel>Título</FormLabel><FormControl><Input placeholder="Ej: Política de Seguridad de la Información" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="descripcion" render={({ field }) => (<FormItem><FormLabel>Descripción</FormLabel><FormControl><Textarea placeholder="Describa el objetivo y alcance de la política." {...field} rows={5} /></FormControl><FormMessage /></FormItem>)} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={form.control} name="areaResponsable" render={({ field }) => (<FormItem><FormLabel>Área Responsable</FormLabel><Select onValueChange={(v) => { field.onChange(v); form.setValue('departamentoResponsable', undefined);}} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione un área" /></SelectTrigger></FormControl><SelectContent>{areas.map(a => <SelectItem key={a.id} value={a.nombre}>{a.nombre}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="departamentoResponsable" render={({ field }) => (<FormItem><FormLabel>Departamento Responsable (Opcional)</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={!watchedArea}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione un departamento" /></SelectTrigger></FormControl><SelectContent><SelectItem value={NO_DEPARTAMENTO_SELECTED}>N/A</SelectItem>{availableDepartamentos.map(d => <SelectItem key={d.id} value={d.nombre}>{d.nombre}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={form.control} name="clasificacion" render={({ field }) => (<FormItem><FormLabel>Clasificación</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{clasificacionOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="nivelCompliance" render={({ field }) => (<FormItem><FormLabel>Nivel de Cumplimiento</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{nivelesCompliance.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={form.control} name="fechaVigencia" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Fecha de Vigencia</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className="w-full pl-3 text-left font-normal">{field.value ? format(field.value, "PPP", { locale: es }) : <span>Seleccione una fecha</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="fechaRevision" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Próxima Revisión</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className="w-full pl-3 text-left font-normal">{field.value ? format(field.value, "PPP", { locale: es }) : <span>Seleccione una fecha</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>)} />
                    </div>
                    
                     <FormField control={form.control} name="consecuenciasIncumplimiento" render={({ field }) => (<FormItem><FormLabel>Consecuencias por Incumplimiento</FormLabel><FormControl><Textarea placeholder="Describa las consecuencias..." {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />
                     <FormField control={form.control} name="referenciasLegales" render={({ field }) => (<FormItem><FormLabel>Referencias Legales/Regulatorias</FormLabel><FormControl><Textarea placeholder="Ej: Ley Federal de Protección de Datos, ISO 27001..." {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>)} />

                    <div className="space-y-2">
                        <Label>Vincular a Elementos</Label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <FormField control={form.control} name="procesosAsociadosIds" render={({ field }) => (<FormItem><FormLabel className="text-xs text-muted-foreground">Procesos</FormLabel><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" className="w-full justify-between font-normal">{field.value?.length || 0} seleccionados <ChevronDown className="ml-2 h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]"><DropdownMenuLabel>Procesos</DropdownMenuLabel><DropdownMenuSeparator /><ScrollArea className="h-48">{procesos.map(p => (<DropdownMenuCheckboxItem key={p.id} checked={field.value?.includes(p.id)} onCheckedChange={checked => field.onChange(checked ? [...field.value || [], p.id] : field.value?.filter(id => id !== p.id))}>{p.codigo} - {p.proceso}</DropdownMenuCheckboxItem>))}</ScrollArea></DropdownMenuContent></DropdownMenu><FormMessage /></FormItem>)} />
                          <FormField control={form.control} name="procedimientosAsociadosIds" render={({ field }) => (<FormItem><FormLabel className="text-xs text-muted-foreground">Procedimientos</FormLabel><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" className="w-full justify-between font-normal">{field.value?.length || 0} seleccionados <ChevronDown className="ml-2 h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]"><DropdownMenuLabel>Procedimientos</DropdownMenuLabel><DropdownMenuSeparator /><ScrollArea className="h-48">{procedimientos.map(p => (<DropdownMenuCheckboxItem key={p.id} checked={field.value?.includes(p.id)} onCheckedChange={checked => field.onChange(checked ? [...field.value || [], p.id] : field.value?.filter(id => id !== p.id))}>{p.codigo} - {p.nombre}</DropdownMenuCheckboxItem>))}</ScrollArea></DropdownMenuContent></DropdownMenu><FormMessage /></FormItem>)} />
                          <FormField control={form.control} name="actividadesAsociadasIds" render={({ field }) => (<FormItem><FormLabel className="text-xs text-muted-foreground">Actividades</FormLabel><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" className="w-full justify-between font-normal">{field.value?.length || 0} seleccionadas <ChevronDown className="ml-2 h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]"><DropdownMenuLabel>Actividades</DropdownMenuLabel><DropdownMenuSeparator /><ScrollArea className="h-48">{actividades.map(a => (<DropdownMenuCheckboxItem key={a.id} checked={field.value?.includes(a.id)} onCheckedChange={checked => field.onChange(checked ? [...field.value || [], a.id] : field.value?.filter(id => id !== a.id))}>{a.codigo} - {a.nombre}</DropdownMenuCheckboxItem>))}</ScrollArea></DropdownMenuContent></DropdownMenu><FormMessage /></FormItem>)} />
                        </div>
                    </div>
                    <DialogFooter><DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose><Button type="submit">Guardar</Button></DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
          {filteredPoliticas.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Nivel Cumplimiento</TableHead>
                    <TableHead>Próx. Revisión</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPoliticas.map(politica => (
                    <TableRow key={politica.id}>
                      <TableCell className="font-mono text-xs">{politica.codigo}</TableCell>
                      <TableCell className="font-medium">{politica.titulo}</TableCell>
                       <TableCell>
                        <Badge variant={
                           politica.estado === 'Aprobada' ? 'default' :
                           politica.estado === 'En Revisión' ? 'secondary' :
                           politica.estado === 'Archivada' ? 'destructive' : 'outline'
                        }>{politica.estado}</Badge>
                      </TableCell>
                      <TableCell><Badge variant="outline" className={politica.nivelCompliance === 'Obligatorio' ? 'border-amber-500 text-amber-600' : ''}>{politica.nivelCompliance}</Badge></TableCell>
                      <TableCell>{politica.fechaRevision ? format(parseISO(politica.fechaRevision), 'dd MMM, yyyy', { locale: es }) : 'N/A'}</TableCell>
                      <TableCell className="text-right">
                         <DropdownMenu>
                           <DropdownMenuTrigger asChild>
                             <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                           </DropdownMenuTrigger>
                           <DropdownMenuContent align="end">
                             <DropdownMenuItem onClick={() => handleEdit(politica)} disabled={politica.estado === 'Aprobada' || politica.estado === 'Archivada'}><Edit2 className="mr-2 h-4 w-4" /> Editar</DropdownMenuItem>
                             <DropdownMenuItem onClick={() => promptDelete(politica)} disabled={politica.estado === 'Aprobada' || politica.estado === 'Archivada'} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Eliminar</DropdownMenuItem>
                             <DropdownMenuSeparator />
                              {politica.estado === 'Borrador' && <DropdownMenuItem onClick={() => updatePoliticaStatus(politica.id, 'En Revisión')}><Send className="mr-2 h-4 w-4" /> Enviar a Revisión</DropdownMenuItem>}
                              {politica.estado === 'En Revisión' && hasPermission('politicas:manage_status') && <DropdownMenuItem onClick={() => updatePoliticaStatus(politica.id, 'Aprobada')}><CheckCheck className="mr-2 h-4 w-4" /> Aprobar</DropdownMenuItem>}
                              {politica.estado === 'En Revisión' && <DropdownMenuItem onClick={() => updatePoliticaStatus(politica.id, 'Borrador')}><ShieldQuestion className="mr-2 h-4 w-4" /> Regresar a Borrador</DropdownMenuItem>}
                              {politica.estado === 'Aprobada' && hasPermission('politicas:manage_status') && <DropdownMenuItem onClick={() => updatePoliticaStatus(politica.id, 'Archivada')}><Archive className="mr-2 h-4 w-4" /> Archivar</DropdownMenuItem>}
                              {(politica.estado === 'Aprobada' || politica.estado === 'Archivada') && hasPermission('politicas:manage_status') && <DropdownMenuItem onClick={() => updatePoliticaStatus(politica.id, 'Borrador')}><ShieldQuestion className="mr-2 h-4 w-4" /> Crear Nueva Versión</DropdownMenuItem>}
                              <DropdownMenuSeparator />
                             <DropdownMenuItem onClick={() => handleViewHistory(politica)} disabled={!politica.historialDeCambios || politica.historialDeCambios.length === 0}><History className="mr-2 h-4 w-4" /> Ver Historial</DropdownMenuItem>
                           </DropdownMenuContent>
                         </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="mt-6 p-8 border border-dashed rounded-lg flex flex-col items-center justify-center min-h-[200px] bg-muted/20">
              <FileText className="h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-lg font-semibold">No se encontraron políticas</p>
              <p className="text-sm text-muted-foreground">{searchTerm ? "Intente con otro término de búsqueda." : "Comience agregando una nueva política."}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={isConfirmDeleteDialogOpen} onOpenChange={setIsConfirmDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle><div className="flex items-center gap-2"><AlertTriangle className="text-destructive"/>Confirmar Eliminación</div></AlertDialogTitle>
            <AlertDialogDescription>¿Está seguro de que desea eliminar la política "{politicaToDelete?.titulo}"? Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPoliticaToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={executeDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Historial de Cambios para: {politicaForHistory?.titulo}</DialogTitle>
          </DialogHeader>
          <div className="py-4 max-h-[60vh] overflow-y-auto">
            {politicaForHistory?.historialDeCambios && politicaForHistory.historialDeCambios.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Campo Modificado</TableHead>
                    <TableHead>Valor Anterior</TableHead>
                    <TableHead>Valor Nuevo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {politicaForHistory.historialDeCambios
                    .sort((a,b) => parseISO(b.timestamp).getTime() - parseISO(a.timestamp).getTime())
                    .map((cambio, index) => (
                    <TableRow key={index}>
                      <TableCell className="text-xs">{format(parseISO(cambio.timestamp), 'dd/MM/yy HH:mm', { locale: es })}</TableCell>
                      <TableCell className="text-sm capitalize">{cambio.field.replace(/([A-Z])/g, ' $1').trim()}</TableCell>
                      <TableCell className="text-xs">{String(cambio.before)}</TableCell>
                      <TableCell className="text-xs font-semibold">{String(cambio.after)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-center">No hay historial de cambios registrado.</p>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">Cerrar</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
