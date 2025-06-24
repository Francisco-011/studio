
'use client';

import * as React from 'react'; 
import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useAreas, type Area } from '@/contexts/AreasContext';

import { Button, buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { Settings, PlusCircle, Edit2, Trash2, Building, Users, Laptop, Loader2, Search, AlertTriangle, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePuestos } from '@/contexts/PuestosContext';
import { useDepartamentos } from '@/contexts/DepartamentosContext';


const areaFormSchema = z.object({
  id: z.string().optional(),
  nombre: z.string().min(1, 'El nombre del área es requerido.'),
});
type AreaFormData = z.infer<typeof areaFormSchema>;

const PlaceholderContent = ({ title, description, icon }: { title: string, description: string, icon: React.ReactNode }) => (
  <div className="mt-6 p-8 border border-dashed border-border rounded-lg flex flex-col items-center justify-center min-h-[200px] bg-muted/20">
    {icon}
    <p className="text-lg font-semibold text-foreground mt-4">{title}</p>
    <p className="text-sm text-muted-foreground text-center">{description}</p>
  </div>
);


export default function ConfiguracionPage() {
  const { areas, addArea, updateArea, deleteArea, isLoading: isLoadingAreas } = useAreas();
  const { puestos } = usePuestos();
  const { departamentos } = useDepartamentos();

  const [isAreaDialogOpen, setIsAreaDialogOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; name: string; type: 'area' } | null>(null);
  const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] = useState(false);
  const [areaSearchTerm, setAreaSearchTerm] = useState('');

  const areaForm = useForm<AreaFormData>({ 
    resolver: zodResolver(areaFormSchema), 
    defaultValues: { nombre: '' } 
  });

  React.useEffect(() => { 
    if (editingArea) {
      areaForm.reset({ id: editingArea.id, nombre: editingArea.nombre }); 
    } else {
      areaForm.reset({ nombre: '' });
    }
  }, [editingArea, areaForm]);

  function handleAreaSubmit(data: AreaFormData) {
    if (editingArea && data.id) {
        updateArea(data.id, data.nombre);
        toast({ title: 'Área Actualizada' });
    } else {
        addArea(data.nombre);
        toast({ title: 'Área Agregada' });
    }
    setEditingArea(null);
    setIsAreaDialogOpen(false);
  }

  function handleEditArea(area: Area) { 
    setEditingArea(area); 
    setIsAreaDialogOpen(true); 
  }
  
  function promptDelete(id: string, name: string) { 
    setItemToDelete({ id, name, type: 'area' }); 
    setIsConfirmDeleteDialogOpen(true); 
  }
  
  function executeDelete() {
    if (!itemToDelete) return;

    // Simplified dependency check for areas
    const isUsedInPuestos = puestos.some(p => p.areaId === itemToDelete.id);
    const isUsedInDepartamentos = departamentos.some(d => d.areaId === itemToDelete.id);

    if (isUsedInPuestos || isUsedInDepartamentos) {
        toast({
            title: "Eliminación Bloqueada",
            description: `"${itemToDelete.name}" está en uso por Puestos o Departamentos y no puede ser eliminada.`,
            variant: "destructive",
            duration: 7000,
        });
    } else {
      deleteArea(itemToDelete.id);
      toast({ title: 'Área Eliminada', variant: "destructive" });
    }

    setItemToDelete(null);
    setIsConfirmDeleteDialogOpen(false);
  }

  const filteredAreas = React.useMemo(() => {
    return areas.filter(a => a.nombre.toLowerCase().includes(areaSearchTerm.toLowerCase()));
  }, [areas, areaSearchTerm]);
  
  const configSections = [
    { value: 'areas', label: 'Áreas', icon: <Building className="h-5 w-5 mr-2" /> },
    { value: 'departamentos', label: 'Departamentos', icon: <Building2 className="h-5 w-5 mr-2" /> },
    { value: 'puestos', label: 'Puestos', icon: <Users className="h-5 w-5 mr-2" /> },
    { value: 'sistemas', label: 'Sistemas y Costos', icon: <Laptop className="h-5 w-5 mr-2" /> },
  ];

  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center gap-2">
          <Settings className="h-6 w-6 text-primary" />
          <CardTitle className="text-2xl font-headline">Módulo de Configuración</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-6">
            Centraliza la gestión de las listas maestras y parámetros fundamentales que el sistema utiliza en toda su operativa.
          </p>
          <Tabs defaultValue="areas" className="w-full">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 mb-4">
              {configSections.map(section => (
                <TabsTrigger key={section.value} value={section.value} className="flex items-center justify-center text-xs sm:text-sm">
                  {section.icon}
                  {section.label}
                </TabsTrigger>
              ))}
            </TabsList>
            
            <TabsContent value="areas">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center"><Building className="h-5 w-5 mr-2" /> Áreas</CardTitle>
                    <p className="text-sm text-muted-foreground">Administrar las áreas o divisiones principales de la empresa.</p>
                  </CardHeader>
                  <CardContent>
                      <div className="flex justify-between items-center mb-4">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                          <Input placeholder="Buscar área..." value={areaSearchTerm} onChange={(e) => setAreaSearchTerm(e.target.value)} className="w-full pl-10" />
                        </div>
                        <Dialog open={isAreaDialogOpen} onOpenChange={(isOpen) => { setIsAreaDialogOpen(isOpen); if (!isOpen) setEditingArea(null); }}>
                          <DialogTrigger asChild>
                            <Button onClick={() => { setEditingArea(null); areaForm.reset(); }}>
                              <PlusCircle className="mr-2 h-4 w-4" /> Agregar Área
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader><DialogTitle>{editingArea ? 'Editar Área' : 'Agregar Nueva Área'}</DialogTitle></DialogHeader>
                            <Form {...areaForm}>
                              <form onSubmit={areaForm.handleSubmit(handleAreaSubmit)} className="space-y-4 py-4">
                                <FormField control={areaForm.control} name="nombre" render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Nombre del Área</FormLabel>
                                    <FormControl><Input placeholder="Ej: Finanzas, Operaciones" {...field} /></FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )} />
                                <DialogFooter>
                                  <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
                                  <Button type="submit">{editingArea ? 'Guardar Cambios' : 'Agregar Área'}</Button>
                                </DialogFooter>
                              </form>
                            </Form>
                          </DialogContent>
                        </Dialog>
                      </div>
                      {isLoadingAreas ? (
                        <PlaceholderContent title="Cargando áreas..." description="Por favor espere." icon={<Loader2 className="h-12 w-12 text-muted-foreground animate-spin" />} />
                      ) : filteredAreas.length === 0 ? (
                        <PlaceholderContent title="No hay áreas registradas" description="Comienza agregando áreas para organizar tu empresa." icon={<Building className="h-12 w-12 text-muted-foreground" />} />
                      ) : (
                        <Card>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Nombre del Área</TableHead>
                                <TableHead className="text-right w-[120px]">Acciones</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredAreas.map((area) => (
                                <TableRow key={area.id}>
                                  <TableCell>{area.nombre}</TableCell>
                                  <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => handleEditArea(area)} className="mr-2"><Edit2 className="h-4 w-4" /></Button>
                                    <Button variant="ghost" size="icon" onClick={() => promptDelete(area.id, area.nombre)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </Card>
                      )}
                  </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="departamentos">
              <PlaceholderContent title="En Construcción" description="La gestión de Departamentos estará disponible aquí." icon={<Building2 className="h-12 w-12 text-muted-foreground" />} />
            </TabsContent>

            <TabsContent value="puestos">
              <PlaceholderContent title="En Construcción" description="La gestión de Puestos estará disponible aquí." icon={<Users className="h-12 w-12 text-muted-foreground" />} />
            </TabsContent>

            <TabsContent value="sistemas">
               <PlaceholderContent title="En Construcción" description="La gestión de Sistemas y Costos estará disponible aquí." icon={<Laptop className="h-12 w-12 text-muted-foreground" />} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      
      <AlertDialog open={isConfirmDeleteDialogOpen} onOpenChange={setIsConfirmDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <div className="flex items-center">
                <AlertTriangle className="h-5 w-5 mr-2 text-destructive" />
                Confirmar Eliminación
              </div>
            </AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro de que desea eliminar "{itemToDelete?.name}"? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setItemToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={executeDelete} className={cn(buttonVariants({ variant: "destructive" }))}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
