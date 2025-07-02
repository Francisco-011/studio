

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { format, isValid, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

import { useProcedimientos, type Procedimiento, type ProcedimientoCreationData } from '@/contexts/ProcedimientosContext';
import { useProcesos, type CapturedProcess, clasificacionOptions } from '@/contexts/ProcesosContext';
import { useSistemasCostos } from '@/contexts/SistemasCostosContext';

import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { toast } from '@/hooks/use-toast';
import { Workflow, Search, PlusCircle, Edit2, Trash2, AlertTriangle, Loader2, ChevronsUpDown, ArrowUp, ArrowDown, ChevronDown, ListOrdered, History } from "lucide-react";
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';


const procedimientoFormSchema = z.object({
  id: z.string().optional(),
  nombre: z.string().min(3, 'El nombre es requerido (mínimo 3 caracteres).'),
  descripcion: z.string().optional(),
  procesoId: z.string({ required_error: 'Debe seleccionar un proceso padre.' }),
  sistemasUtilizados: z.array(z.string()).optional().default([]),
  clasificacion: z.enum(clasificacionOptions).default('Privado'),
  activityOrder: z.array(z.string()).optional().default([]), 
  informacionRecibe: z.string().optional(),
  procedimientosEntradaIds: z.array(z.string()).optional().default([]),
  informacionEntrega: z.string().optional(),
  procedimientosSalidaIds: z.array(z.string()).optional().default([]),
});

type ProcedimientoFormData = z.infer<typeof procedimientoFormSchema>;

type SortableKeys = 'codigo' | 'nombre' | 'procesoPadre' | 'numActividades' | 'clasificacion' | 'updatedAt' | 'activo';
type SortDirection = 'ascending' | 'descending';

interface SortConfig {
  key: SortableKeys;
  direction: SortDirection;
}

const ITEMS_PER_PAGE = 10;
const PROCEDIMIENTO_INICIADOR = "__INICIADOR__";
const PROCEDIMIENTO_FINALIZADOR = "__FINALIZADOR__";


export default function ProcedimientosPage() {
  const router = useRouter();
  const { procedimientos, addProcedimiento, updateProcedimiento, deleteProcedimiento, toggleProcedimientoStatus, isLoadingProcedimientos } = useProcedimientos();
  const { procesos, updateProceso, isLoadingProcesos } = useProcesos();
  const { sistemas, isLoadingSistemasCostos } = useSistemasCostos();
  const searchParams = useSearchParams();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [procesoFilter, setProcesoFilter] = useState('all');
  const [clasificacionFilter, setClasificacionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProcedimiento, setEditingProcedimiento] = useState<Procedimiento | null>(null);

  const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] = useState(false);
  const [procedimientoToDelete, setProcedimientoToDelete] = useState<Procedimiento | null>(null);
  
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [procedimientoForHistory, setProcedimientoForHistory] = useState<Procedimiento | null>(null);

  const [similarProcedimientoWarning, setSimilarProcedimientoWarning] = useState<string | null>(null);

  const form = useForm<ProcedimientoFormData>({
    resolver: zodResolver(procedimientoFormSchema),
    defaultValues: { nombre: '', descripcion: '', procesoId: undefined, sistemasUtilizados: [], clasificacion: 'Privado' },
  });

  const watchedNombre = form.watch('nombre');

  useEffect(() => {
    if (isDialogOpen && watchedNombre && procedimientos.length > 0) {
        const trimmedLowerName = watchedNombre.trim().toLowerCase();
        if (!trimmedLowerName) {
            setSimilarProcedimientoWarning(null);
            return;
        }

        const existingProcedimiento = procedimientos.find(
            p => p.nombre.trim().toLowerCase() === trimmedLowerName && p.id !== editingProcedimiento?.id
        );

        if (existingProcedimiento) {
            const parentProcess = procesos.find(p => p.id === existingProcedimiento.procesoId);
            setSimilarProcedimientoWarning(`Advertencia: ya existe un procedimiento con este nombre en el proceso "${parentProcess?.proceso || 'otro proceso'}".`);
        } else {
            setSimilarProcedimientoWarning(null);
        }
    } else if (!isDialogOpen) {
        setSimilarProcedimientoWarning(null);
    }
  }, [watchedNombre, procedimientos, editingProcedimiento, isDialogOpen, procesos]);
  
  useEffect(() => {
    const processFromQuery = searchParams.get('proceso');
    if (processFromQuery) {
        setProcesoFilter(processFromQuery);
        form.setValue('procesoId', processFromQuery);
    }
  }, [searchParams, form]);

  useEffect(() => {
    if (isDialogOpen) {
      if (editingProcedimiento) {
        form.reset({
          id: editingProcedimiento.id,
          nombre: editingProcedimiento.nombre,
          descripcion: editingProcedimiento.descripcion,
          procesoId: editingProcedimiento.procesoId,
          sistemasUtilizados: editingProcedimiento.sistemasUtilizados || [],
          clasificacion: editingProcedimiento.clasificacion,
          activityOrder: editingProcedimiento.activityOrder,
          informacionRecibe: editingProcedimiento.informacionRecibe,
          procedimientosEntradaIds: editingProcedimiento.procedimientosEntradaIds || [],
          informacionEntrega: editingProcedimiento.informacionEntrega,
          procedimientosSalidaIds: editingProcedimiento.procedimientosSalidaIds || [],
        });
      } else {
        const processFromQuery = searchParams.get('proceso');
        form.reset({ 
          nombre: '', 
          descripcion: '', 
          procesoId: processFromQuery || undefined, 
          sistemasUtilizados: [], 
          clasificacion: 'Privado',
          informacionRecibe: '',
          procedimientosEntradaIds: [],
          informacionEntrega: '',
          procedimientosSalidaIds: [],
        });
      }
    }
  }, [editingProcedimiento, isDialogOpen, form, searchParams]);

  async function handleSubmit(data: ProcedimientoFormData) {
    const { id, ...formData } = data;
    const dataToSave = { ...formData } as ProcedimientoCreationData;

    if (editingProcedimiento && id) {
      await updateProcedimiento(id, dataToSave);
      toast({ title: 'Procedimiento Actualizado', description: 'El procedimiento ha sido actualizado.' });
      setIsDialogOpen(false);
    } else {
      const newProc = await addProcedimiento(dataToSave);
      if (newProc) {
        const parentProcess = procesos.find(p => p.id === newProc.procesoId);
        if (parentProcess) {
          const updatedOrder = [...(parentProcess.procedimientoOrder || []), newProc.id];
          await updateProceso(parentProcess.id, { procedimientoOrder: updatedOrder });
        }
        
        toast({ title: 'Procedimiento Creado', description: 'Redirigiendo para agregar actividades...' });
        router.push(`/actividades?procedimientoId=${newProc.id}`);
      } else {
        toast({ title: 'Error', description: 'No se pudo crear el procedimiento.', variant: 'destructive'});
        setIsDialogOpen(false);
      }
    }
  }

  function handleEdit(procedimiento: Procedimiento) {
    setEditingProcedimiento(procedimiento);
    setIsDialogOpen(true);
  }
  
  function handleViewHistory(procedimiento: Procedimiento) {
    setProcedimientoForHistory(procedimiento);
    setIsHistoryDialogOpen(true);
  }

  function promptDelete(procedimiento: Procedimiento) {
    setProcedimientoToDelete(procedimiento);
    setIsConfirmDeleteDialogOpen(true);
  }

  async function executeDelete() {
    if (!procedimientoToDelete) return;

    // Remove from parent process's order first
    const parentProcess = procesos.find(p => p.id === procedimientoToDelete.procesoId);
    if (parentProcess) {
        const updatedOrder = (parentProcess.procedimientoOrder || []).filter(id => id !== procedimientoToDelete.id);
        await updateProceso(parentProcess.id, { procedimientoOrder: updatedOrder });
    }

    await deleteProcedimiento(procedimientoToDelete.id);
    setProcedimientoToDelete(null);
    setIsConfirmDeleteDialogOpen(false);
  }

  const sortedAndFilteredData = useMemo(() => {
    setCurrentPage(1);
    const procesosMap = new Map(procesos.map(p => [p.id, p.proceso]));
    
    let filtered = procedimientos
      .map(p => ({ ...p, procesoPadre: procesosMap.get(p.procesoId) || 'N/A' }))
      .filter(p => 
        (p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || (p.codigo || '').toLowerCase().includes(searchTerm.toLowerCase()) || p.procesoPadre.toLowerCase().includes(searchTerm.toLowerCase())) &&
        (procesoFilter === 'all' || p.procesoId === procesoFilter) &&
        (clasificacionFilter === 'all' || p.clasificacion === clasificacionFilter) &&
        (statusFilter === 'all' || (statusFilter === 'active' && p.activo) || (statusFilter === 'inactive' && !p.activo))
      );

    if (sortConfig) {
      filtered.sort((a, b) => {
        let valA: any;
        let valB: any;
        
        if (sortConfig.key === 'numActividades') {
            valA = a.activityOrder?.length || 0;
            valB = b.activityOrder?.length || 0;
        } else if (sortConfig.key === 'activo') {
            valA = a.activo;
            valB = b.activo;
        } else if (sortConfig.key === 'updatedAt') {
            valA = a.updatedAt || 0;
            valB = b.updatedAt || 0;
        } else {
            valA = a[sortConfig.key as keyof Procedimiento];
            valB = b[sortConfig.key as keyof Procedimiento];
        }

        if (typeof valA === 'string' && typeof valB === 'string') {
          valA = valA.toLowerCase();
          valB = valB.toLowerCase();
        }

        if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    } else {
      filtered.sort((a, b) => (a.codigo || '').localeCompare(b.codigo || ''));
    }
    return filtered;
  }, [procedimientos, procesos, searchTerm, procesoFilter, clasificacionFilter, statusFilter, sortConfig]);

  const totalPages = Math.ceil(sortedAndFilteredData.length / ITEMS_PER_PAGE);
  const paginatedData = useMemo(() => sortedAndFilteredData.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE), [sortedAndFilteredData, currentPage]);
  
  const requestSort = (key: SortableKeys) => {
    let direction: SortDirection = 'ascending';
    if (sortConfig?.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  const getSortIcon = (key: SortableKeys) => {
    if (!sortConfig || sortConfig.key !== key) return <ChevronsUpDown className="ml-1 h-3 w-3 opacity-40 group-hover:opacity-100" />;
    return sortConfig.direction === 'ascending' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />;
  };

  const isLoadingAll = isLoadingProcedimientos || isLoadingProcesos || isLoadingSistemasCostos;

  if (isLoadingAll) return <div className="container mx-auto py-8 flex justify-center"><Loader2 className="h-16 w-16 animate-spin" /></div>;

  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-2 mb-1"><Workflow className="h-6 w-6 text-primary" /><CardTitle className="text-2xl font-headline">Gestión de Procedimientos</CardTitle></div>
          <CardDescription>Catálogo centralizado para crear, editar y administrar todos los procedimientos del sistema.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
            <div className="relative w-full sm:max-w-xs"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" /><Input placeholder="Buscar por nombre, código..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10" /></div>
            <div className="flex gap-2 w-full sm:w-auto flex-wrap justify-end">
              <Select value={procesoFilter} onValueChange={setProcesoFilter}><SelectTrigger className="flex-1 min-w-[150px]"><SelectValue placeholder="Filtrar por proceso..."/></SelectTrigger><SelectContent><SelectItem value="all">Todos los Procesos</SelectItem>{procesos.filter(p => !p.deletedAt).map(p => <SelectItem key={p.id} value={p.id}>{p.proceso}</SelectItem>)}</SelectContent></Select>
              <Select value={clasificacionFilter} onValueChange={setClasificacionFilter}><SelectTrigger className="flex-1 min-w-[120px]"><SelectValue placeholder="Clasificación..."/></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem>{clasificacionOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select>
              <Select value={statusFilter} onValueChange={setStatusFilter as any}><SelectTrigger className="flex-1 min-w-[120px]"><SelectValue placeholder="Estado..."/></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="active">Activos</SelectItem><SelectItem value="inactive">Inactivos</SelectItem></SelectContent></Select>
              <Button onClick={() => setIsDialogOpen(true)}><PlusCircle className="mr-2 h-4 w-4" /> Agregar</Button>
            </div>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="w-[120px] cursor-pointer" onClick={() => requestSort('codigo')}>Código {getSortIcon('codigo')}</TableHead>
                <TableHead className="cursor-pointer" onClick={() => requestSort('nombre')}>Nombre Procedimiento {getSortIcon('nombre')}</TableHead>
                <TableHead className="cursor-pointer" onClick={() => requestSort('procesoPadre')}>Proceso Padre {getSortIcon('procesoPadre')}</TableHead>
                <TableHead className="cursor-pointer text-center" onClick={() => requestSort('numActividades')}>Nº Actividades {getSortIcon('numActividades')}</TableHead>
                <TableHead className="cursor-pointer" onClick={() => requestSort('clasificacion')}>Clasificación {getSortIcon('clasificacion')}</TableHead>
                <TableHead className="cursor-pointer" onClick={() => requestSort('activo')}>Estado {getSortIcon('activo')}</TableHead>
                <TableHead className="cursor-pointer" onClick={() => requestSort('updatedAt')}>Últ. Modif. {getSortIcon('updatedAt')}</TableHead>
                <TableHead className="text-right w-[160px]">Acciones</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {paginatedData.map(proc => (
                  <TableRow key={proc.id}>
                    <TableCell className="font-mono text-xs">{proc.codigo}</TableCell>
                    <TableCell className="font-medium">{proc.nombre}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{proc.procesoPadre}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{proc.activityOrder?.length || 0}</Badge>
                    </TableCell>
                    <TableCell><Badge variant="outline">{proc.clasificacion}</Badge></TableCell>
                    <TableCell><Badge variant={proc.activo ? 'default' : 'secondary'}>{proc.activo ? 'Activo' : 'Inactivo'}</Badge></TableCell>
                    <TableCell className="text-xs">{proc.updatedAt && isValid(new Date(proc.updatedAt)) ? format(new Date(proc.updatedAt), 'dd/MM/yy HH:mm') : '-'}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Switch checked={proc.activo} onCheckedChange={() => toggleProcedimientoStatus(proc)} aria-label="Cambiar estado" className="mr-2"/>
                      <Button variant="ghost" size="icon" onClick={() => handleViewHistory(proc)} disabled={!proc.historialDeCambios || proc.historialDeCambios.length === 0} title="Ver historial"><History className="h-4 w-4"/></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(proc)}><Edit2 className="h-4 w-4"/></Button>
                      <Button variant="ghost" size="icon" onClick={() => promptDelete(proc)} className="text-destructive"><Trash2 className="h-4 w-4"/></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between space-x-2 py-4"><span className="text-sm text-muted-foreground">Página {currentPage} de {totalPages} ({sortedAndFilteredData.length} total)</span><div className="space-x-2"><Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Anterior</Button><Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>Siguiente</Button></div></div>
        </CardContent>
      </Card>
      
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>{editingProcedimiento ? 'Editar' : 'Agregar'} Procedimiento</DialogTitle></DialogHeader>
        <Form {...form}><form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-4 max-h-[75vh] overflow-y-auto pr-4">
          <FormField control={form.control} name="procesoId" render={({ field }) => (<FormItem><FormLabel>Proceso Padre</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Seleccione un proceso..."/></SelectTrigger></FormControl><SelectContent>{procesos.filter(p => p.activo !== false && !p.deletedAt).map(p => <SelectItem key={p.id} value={p.id}>{p.proceso}</SelectItem>)}</SelectContent></Select><FormMessage/></FormItem>)}/>
          <FormField
            control={form.control}
            name="nombre"
            render={({ field }) => (
                <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                        <Input {...field} placeholder="Ej: Revisión de Facturas de Proveedores"/>
                    </FormControl>
                    {similarProcedimientoWarning && (
                        <FormDescription className="text-amber-600 flex items-start gap-1.5 pt-1">
                            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                            <span>{similarProcedimientoWarning}</span>
                        </FormDescription>
                    )}
                    <FormMessage />
                </FormItem>
            )}
          />
          <FormField control={form.control} name="descripcion" render={({ field }) => (<FormItem><FormLabel>Descripción</FormLabel><FormControl><Textarea {...field} value={field.value ?? ''}/></FormControl><FormMessage/></FormItem>)}/>
          <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="clasificacion" render={({ field }) => (<FormItem><FormLabel>Clasificación</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent>{clasificacionOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select><FormMessage/></FormItem>)}/>
            <FormField control={form.control} name="sistemasUtilizados" render={({ field }) => (<FormItem><FormLabel>Sistemas</FormLabel><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" className="w-full justify-between font-normal">{field.value?.length || 0} seleccionados <ChevronDown className="ml-2 h-4"/></Button></DropdownMenuTrigger><DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]"><DropdownMenuLabel>Sistemas Disponibles</DropdownMenuLabel><DropdownMenuSeparator/>{sistemas.map(s => <DropdownMenuCheckboxItem key={s.id} checked={field.value?.includes(s.nombre)} onCheckedChange={checked => field.onChange(checked ? [...(field.value || []), s.nombre] : (field.value || []).filter(name => name !== s.nombre))}>{s.nombre}</DropdownMenuCheckboxItem>)}</DropdownMenuContent></DropdownMenu><FormMessage/></FormItem>)}/>
          </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <FormField control={form.control} name="procedimientosEntradaIds" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Procedimientos de Entrada</FormLabel>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="w-full justify-between font-normal">
                                    {
                                        field.value?.includes(PROCEDIMIENTO_INICIADOR) ? 'Procedimiento Iniciador' :
                                        field.value?.length ? `${field.value.length} seleccionado(s)` :
                                        'Seleccione...'
                                    } 
                                    <ChevronDown className="ml-2 h-4"/>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                                <DropdownMenuLabel>Procedimientos de Entrada</DropdownMenuLabel>
                                <DropdownMenuSeparator/>
                                <DropdownMenuCheckboxItem
                                    checked={field.value?.includes(PROCEDIMIENTO_INICIADOR)}
                                    onCheckedChange={(checked) => {
                                        field.onChange(checked ? [PROCEDIMIENTO_INICIADOR] : []);
                                    }}
                                    disabled={field.value?.length > 0 && !field.value.includes(PROCEDIMIENTO_INICIADOR)}
                                >
                                    (Es un procedimiento iniciador)
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuSeparator/>
                                {procedimientos.filter(p => p.id !== editingProcedimiento?.id).map(p => (
                                    <DropdownMenuCheckboxItem 
                                        key={p.id} 
                                        checked={field.value?.includes(p.id)} 
                                        onCheckedChange={checked => {
                                            const currentValues = field.value?.filter(v => v !== PROCEDIMIENTO_INICIADOR) || [];
                                            field.onChange(checked ? [...currentValues, p.id] : currentValues.filter(id => id !== p.id))
                                        }}
                                        disabled={field.value?.includes(PROCEDIMIENTO_INICIADOR)}
                                    >
                                        {p.nombre}
                                    </DropdownMenuCheckboxItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <FormMessage/>
                    </FormItem>
                )}/>
                <FormField control={form.control} name="informacionRecibe" render={({ field }) => (<FormItem><FormLabel>Información que Recibe</FormLabel><FormControl><Textarea placeholder="Ej: Factura del proveedor, Orden de compra aprobada..." {...field} value={field.value ?? ''}/></FormControl><FormMessage/></FormItem>)}/>
                <FormField control={form.control} name="procedimientosSalidaIds" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Procedimientos de Salida</FormLabel>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="w-full justify-between font-normal">
                                    {
                                        field.value?.includes(PROCEDIMIENTO_FINALIZADOR) ? 'Procedimiento Finalizador' :
                                        field.value?.length ? `${field.value.length} seleccionado(s)` :
                                        'Seleccione...'
                                    }
                                    <ChevronDown className="ml-2 h-4"/>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                                <DropdownMenuLabel>Procedimientos de Salida</DropdownMenuLabel>
                                <DropdownMenuSeparator/>
                                <DropdownMenuCheckboxItem
                                    checked={field.value?.includes(PROCEDIMIENTO_FINALIZADOR)}
                                    onCheckedChange={(checked) => {
                                        field.onChange(checked ? [PROCEDIMIENTO_FINALIZADOR] : []);
                                    }}
                                    disabled={field.value?.length > 0 && !field.value.includes(PROCEDIMIENTO_FINALIZADOR)}
                                >
                                    (Es un procedimiento finalizador)
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuSeparator/>
                                {procedimientos.filter(p => p.id !== editingProcedimiento?.id).map(p => (
                                    <DropdownMenuCheckboxItem 
                                        key={p.id} 
                                        checked={field.value?.includes(p.id)} 
                                        onCheckedChange={checked => {
                                            const currentValues = field.value?.filter(v => v !== PROCEDIMIENTO_FINALIZADOR) || [];
                                            field.onChange(checked ? [...currentValues, p.id] : currentValues.filter(id => id !== p.id))
                                        }}
                                        disabled={field.value?.includes(PROCEDIMIENTO_FINALIZADOR)}
                                    >
                                        {p.nombre}
                                    </DropdownMenuCheckboxItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <FormMessage/>
                    </FormItem>
                )}/>
                <FormField control={form.control} name="informacionEntrega" render={({ field }) => (<FormItem><FormLabel>Información que Entrega</FormLabel><FormControl><Textarea placeholder="Ej: Pago programado, Factura registrada en sistema..." {...field} value={field.value ?? ''}/></FormControl><FormMessage/></FormItem>)}/>
            </div>
          <DialogFooter><DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose><Button type="submit">Guardar</Button></DialogFooter>
        </form></Form>
      </DialogContent></Dialog>
      
      <AlertDialog open={isConfirmDeleteDialogOpen} onOpenChange={setIsConfirmDeleteDialogOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle><AlertTriangle className="inline-block mr-2 text-destructive"/>Confirmar Eliminación</AlertDialogTitle><AlertDialogDescription>¿Seguro que desea eliminar el procedimiento "{procedimientoToDelete?.nombre}"? Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel onClick={()=>setProcedimientoToDelete(null)}>Cancelar</AlertDialogCancel><AlertDialogAction onClick={executeDelete} className={buttonVariants({variant: "destructive"})}>Eliminar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    
      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Historial de Cambios para: {procedimientoForHistory?.nombre}</DialogTitle>
          </DialogHeader>
          <div className="py-4 max-h-[60vh] overflow-y-auto">
            {procedimientoForHistory?.historialDeCambios && procedimientoForHistory.historialDeCambios.length > 0 ? (
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
                  {procedimientoForHistory.historialDeCambios
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
