
'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from '@/hooks/use-toast';
import { Settings, PlusCircle, Edit2, Trash2, Building, Users, Laptop, ListChecks, DollarSign, Share2 } from 'lucide-react';

// Special values for "no selection" in Select components
const NO_AREA_VALUE = "__NO_AREA__";
const NO_JEFE_VALUE = "__NO_JEFE__";


// Type definitions
interface Area {
  id: string;
  nombre: string;
}

const nivelesOrganizacionales = ["Directivo", "Gerencial", "Supervisión", "Operativo", "Apoyo"] as const;
type NivelOrganizacional = typeof nivelesOrganizacionales[number];

interface Puesto {
  id: string;
  nombre: string;
  areaId?: string;
  jefeInmediato?: string; // Stores the ID of another Puesto
  nivelOrganizacional: NivelOrganizacional;
}

// Zod schemas
const areaFormSchema = z.object({
  id: z.string().optional(),
  nombre: z.string().min(1, 'El nombre del área es requerido.'),
});
type AreaFormData = z.infer<typeof areaFormSchema>;

const puestoFormSchema = z.object({
  id: z.string().optional(),
  nombre: z.string().min(1, 'El nombre del puesto es requerido.'),
  areaId: z.string().optional(),
  jefeInmediato: z.string().optional(), 
  nivelOrganizacional: z.enum(nivelesOrganizacionales, {
    errorMap: () => ({ message: "Debe seleccionar un nivel organizacional válido." }),
  }),
});
type PuestoFormData = z.infer<typeof puestoFormSchema>;


interface ConfigSectionProps {
  title: string;
  icon: ReactNode;
  description: string;
  content?: ReactNode;
}

const PlaceholderContent = ({ title, description, icon }: { title: string, description: string, icon: ReactNode }) => (
  <div className="mt-6 p-8 border border-dashed border-border rounded-lg flex flex-col items-center justify-center min-h-[200px] bg-muted/20">
    {icon}
    <p className="text-lg font-semibold text-foreground mt-4">{title}</p>
    <p className="text-sm text-muted-foreground text-center">{description}</p>
  </div>
);


export default function ConfiguracionPage() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [isAreaDialogOpen, setIsAreaDialogOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<Area | null>(null);

  const [puestos, setPuestos] = useState<Puesto[]>([]);
  const [isPuestoDialogOpen, setIsPuestoDialogOpen] = useState(false);
  const [editingPuesto, setEditingPuesto] = useState<Puesto | null>(null);

  const areaForm = useForm<AreaFormData>({
    resolver: zodResolver(areaFormSchema),
    defaultValues: {
      nombre: '',
    },
  });

  const puestoForm = useForm<PuestoFormData>({
    resolver: zodResolver(puestoFormSchema),
    defaultValues: {
      nombre: '',
      areaId: undefined,
      jefeInmediato: undefined,
      nivelOrganizacional: undefined,
    },
  });

  useEffect(() => {
    if (editingArea) {
      areaForm.reset({ id: editingArea.id, nombre: editingArea.nombre });
    } else {
      areaForm.reset({ nombre: '' });
    }
  }, [editingArea, areaForm]);

  useEffect(() => {
    if (editingPuesto) {
      puestoForm.reset({
        id: editingPuesto.id,
        nombre: editingPuesto.nombre,
        areaId: editingPuesto.areaId || undefined,
        jefeInmediato: editingPuesto.jefeInmediato || undefined,
        nivelOrganizacional: editingPuesto.nivelOrganizacional,
      });
    } else {
      puestoForm.reset({
        nombre: '',
        areaId: undefined,
        jefeInmediato: undefined,
        nivelOrganizacional: undefined,
      });
    }
  }, [editingPuesto, puestoForm]);

  function handleAreaSubmit(data: AreaFormData) {
    if (editingArea) {
      setAreas(areas.map((area) => (area.id === editingArea.id ? { ...area, nombre: data.nombre } : area)));
      toast({ title: 'Área Actualizada', description: 'El área ha sido actualizada exitosamente.' });
    } else {
      setAreas([...areas, { id: Date.now().toString(), nombre: data.nombre }]);
      toast({ title: 'Área Agregada', description: 'El área ha sido agregada exitosamente.' });
    }
    setEditingArea(null);
    setIsAreaDialogOpen(false);
    areaForm.reset();
  }

  function handleEditArea(area: Area) {
    setEditingArea(area);
    setIsAreaDialogOpen(true);
  }

  function handleDeleteArea(areaId: string) {
    const isAreaInUse = puestos.some(puesto => puesto.areaId === areaId);
    if (isAreaInUse) {
      toast({
        title: 'Error al eliminar',
        description: 'El área no puede ser eliminada porque está asignada a uno o más puestos.',
        variant: 'destructive',
      });
      return;
    }
    setAreas(areas.filter((area) => area.id !== areaId));
    toast({ title: 'Área Eliminada', description: 'El área ha sido eliminada exitosamente.', variant: 'destructive' });
  }

  function handlePuestoSubmit(data: PuestoFormData) {
    const puestoData: Puesto = {
      id: editingPuesto ? editingPuesto.id : Date.now().toString(),
      nombre: data.nombre,
      areaId: data.areaId === NO_AREA_VALUE ? undefined : data.areaId,
      jefeInmediato: data.jefeInmediato === NO_JEFE_VALUE ? undefined : data.jefeInmediato,
      nivelOrganizacional: data.nivelOrganizacional,
    };
    

    if (editingPuesto) {
      setPuestos(puestos.map((p) => (p.id === editingPuesto.id ? puestoData : p)));
      toast({ title: 'Puesto Actualizado', description: 'El puesto ha sido actualizado exitosamente.' });
    } else {
      setPuestos([...puestos, puestoData]);
      toast({ title: 'Puesto Agregado', description: 'El puesto ha sido agregado exitosamente.' });
    }
    setEditingPuesto(null);
    setIsPuestoDialogOpen(false);
    puestoForm.reset();
  }

  function handleEditPuesto(puesto: Puesto) {
    setEditingPuesto(puesto);
    setIsPuestoDialogOpen(true);
  }

  function handleDeletePuesto(puestoId: string) {
    const isJefeInmediato = puestos.some(p => p.jefeInmediato === puestoId);
    if (isJefeInmediato) {
      toast({
        title: 'Error al eliminar',
        description: 'El puesto no puede ser eliminado porque es Jefe Inmediato de otro puesto.',
        variant: 'destructive',
      });
      return;
    }
    setPuestos(puestos.filter((puesto) => puesto.id !== puestoId));
    toast({ title: 'Puesto Eliminado', description: 'El puesto ha sido eliminado exitosamente.', variant: 'destructive' });
  }
  
  const configSections: Array<{
    value: string;
    label: string;
    icon: ReactNode;
    content: ReactNode;
    fullDescription: string;
  }> = [
    {
      value: 'areas',
      label: 'Áreas',
      icon: <Building className="h-5 w-5 mr-2" />,
      fullDescription: 'Administrar las áreas organizacionales de la empresa. Al agregar una nueva área, la matriz en el módulo de Análisis se actualiza automáticamente con la nueva columna.',
      content: (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold">Gestión de Áreas</h3>
            <Dialog open={isAreaDialogOpen} onOpenChange={(isOpen) => {
              setIsAreaDialogOpen(isOpen);
              if (!isOpen) {
                setEditingArea(null);
                areaForm.reset({nombre: ''});
              }
            }}>
              <DialogTrigger asChild>
                <Button onClick={() => { setEditingArea(null); areaForm.reset({nombre: ''}); setIsAreaDialogOpen(true); }}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Agregar Área
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>{editingArea ? 'Editar Área' : 'Agregar Nueva Área'}</DialogTitle>
                  <DialogDescription>
                    {editingArea ? 'Modifica los detalles del área.' : 'Completa la información para agregar una nueva área.'}
                  </DialogDescription>
                </DialogHeader>
                <Form {...areaForm}>
                  <form onSubmit={areaForm.handleSubmit(handleAreaSubmit)} className="space-y-4 py-4">
                    <FormField
                      control={areaForm.control}
                      name="nombre"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nombre del Área</FormLabel>
                          <FormControl>
                            <Input placeholder="Ej: Finanzas, Operaciones" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter>
                      <DialogClose asChild>
                         <Button type="button" variant="outline" onClick={() => {setIsAreaDialogOpen(false); setEditingArea(null);}}>Cancelar</Button>
                      </DialogClose>
                      <Button type="submit">{editingArea ? 'Guardar Cambios' : 'Agregar Área'}</Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
          {areas.length === 0 ? (
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
                  {areas.map((area) => (
                    <TableRow key={area.id}>
                      <TableCell>{area.nombre}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleEditArea(area)} className="mr-2">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteArea(area.id)} className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      ),
    },
    {
      value: 'puestos',
      label: 'Puestos',
      icon: <Users className="h-5 w-5 mr-2" />,
      fullDescription: 'Administrar los diferentes roles o puestos de trabajo dentro de la organización. Campos: Nombre del puesto, Área, Jefe Inmediato, Nivel Organizacional.',
      content: (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold">Gestión de Puestos</h3>
            <Dialog open={isPuestoDialogOpen} onOpenChange={(isOpen) => {
              setIsPuestoDialogOpen(isOpen);
              if (!isOpen) {
                setEditingPuesto(null);
                puestoForm.reset({nombre: '', areaId: undefined, jefeInmediato: undefined, nivelOrganizacional: undefined});
              }
            }}>
              <DialogTrigger asChild>
                <Button onClick={() => { setEditingPuesto(null); puestoForm.reset({nombre: '', areaId: undefined, jefeInmediato: undefined, nivelOrganizacional: undefined}); setIsPuestoDialogOpen(true); }}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Agregar Puesto
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[525px]">
                <DialogHeader>
                  <DialogTitle>{editingPuesto ? 'Editar Puesto' : 'Agregar Nuevo Puesto'}</DialogTitle>
                  <DialogDescription>
                    {editingPuesto ? 'Modifica los detalles del puesto.' : 'Completa la información para agregar un nuevo puesto.'}
                  </DialogDescription>
                </DialogHeader>
                <Form {...puestoForm}>
                  <form onSubmit={puestoForm.handleSubmit(handlePuestoSubmit)} className="space-y-4 py-4">
                    <FormField
                      control={puestoForm.control}
                      name="nombre"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nombre del Puesto</FormLabel>
                          <FormControl>
                            <Input placeholder="Ej: Analista Financiero, Gerente de Logística" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                     <FormField
                      control={puestoForm.control}
                      name="areaId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Área a la que pertenece (Opcional)</FormLabel>
                          <Select
                            onValueChange={(value) => field.onChange(value === NO_AREA_VALUE ? undefined : value)}
                            value={field.value || NO_AREA_VALUE}
                            defaultValue={field.value || NO_AREA_VALUE}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccione un área" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                               <SelectItem value={NO_AREA_VALUE}>Sin Área Asignada</SelectItem>
                              {areas.length === 0 ? (
                                <SelectItem value="no-areas-disabled" disabled>No hay áreas disponibles</SelectItem>
                              ) : (
                                areas.map((area) => (
                                  <SelectItem key={area.id} value={area.id}>
                                    {area.nombre}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={puestoForm.control}
                      name="jefeInmediato"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Jefe Inmediato (Opcional)</FormLabel>
                          <Select
                            onValueChange={(value) => field.onChange(value === NO_JEFE_VALUE ? undefined : value)}
                            value={field.value || NO_JEFE_VALUE}
                            defaultValue={field.value || NO_JEFE_VALUE}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccione un jefe inmediato" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value={NO_JEFE_VALUE}>Sin Jefe Inmediato</SelectItem>
                              {puestos
                                .filter(p => !editingPuesto || p.id !== editingPuesto.id) 
                                .map((puesto) => (
                                  <SelectItem key={puesto.id} value={puesto.id}>
                                    {puesto.nombre}
                                  </SelectItem>
                                ))}
                                {puestos.filter(p => !editingPuesto || p.id !== editingPuesto.id).length === 0 && (
                                     <SelectItem value="no-puestos-disabled" disabled>No hay otros puestos disponibles</SelectItem>
                                )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={puestoForm.control}
                      name="nivelOrganizacional"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nivel Organizacional</FormLabel>
                           <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccione un nivel" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {nivelesOrganizacionales.map((nivel) => (
                                <SelectItem key={nivel} value={nivel}>
                                  {nivel}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter>
                       <DialogClose asChild>
                        <Button type="button" variant="outline" onClick={() => { setIsPuestoDialogOpen(false); setEditingPuesto(null); }}>Cancelar</Button>
                       </DialogClose>
                      <Button type="submit">{editingPuesto ? 'Guardar Cambios' : 'Agregar Puesto'}</Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
          {puestos.length === 0 ? (
             <PlaceholderContent title="No hay puestos registrados" description="Comienza agregando puestos para definir la estructura de roles." icon={<Users className="h-12 w-12 text-muted-foreground" />} />
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre del Puesto</TableHead>
                    <TableHead>Área</TableHead>
                    <TableHead>Nivel Organizacional</TableHead>
                    <TableHead>Jefe Inmediato</TableHead>
                    <TableHead className="text-right w-[120px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {puestos.map((puesto) => {
                    const areaPuesto = puesto.areaId ? areas.find(a => a.id === puesto.areaId) : null;
                    const jefeInmediato = puesto.jefeInmediato ? puestos.find(p => p.id === puesto.jefeInmediato) : null;
                    return (
                      <TableRow key={puesto.id}>
                        <TableCell>{puesto.nombre}</TableCell>
                        <TableCell>{areaPuesto ? areaPuesto.nombre : 'Sin Área'}</TableCell>
                        <TableCell>{puesto.nivelOrganizacional}</TableCell>
                        <TableCell>{jefeInmediato ? jefeInmediato.nombre : '-'}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => handleEditPuesto(puesto)} className="mr-2">
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeletePuesto(puesto.id)} className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      ),
    },
    {
      value: 'sistemas',
      label: 'Sistemas',
      icon: <Laptop className="h-5 w-5 mr-2" />,
      fullDescription: 'Mantener el inventario de los sistemas y herramientas tecnológicas utilizadas en la empresa. Campos: Nombre del sistema.',
      content: <PlaceholderContent title="Gestión de Sistemas" description="Próximamente: registro y administración de sistemas." icon={<Laptop className="h-12 w-12 text-muted-foreground" />} />,
    },
    {
      value: 'actividades',
      label: 'Actividades',
      icon: <ListChecks className="h-5 w-5 mr-2" />,
      fullDescription: 'Administrar la lista maestra de actividades granulares. Campos: Nombre de la actividad. Acciones: Agregar, Editar, Activar/Inactivar, Eliminar.',
      content: <PlaceholderContent title="Gestión de Actividades" description="Próximamente: administración de actividades maestras." icon={<ListChecks className="h-12 w-12 text-muted-foreground" />} />,
    },
    {
      value: 'costos',
      label: 'Costos Sistemas',
      icon: <DollarSign className="h-5 w-5 mr-2" />,
      fullDescription: 'Detallar los costos asociados a cada sistema. Campos: Sistema, Tipo de Costo, Forma de Pago, Frecuencia, Moneda, Descripción.',
      content: <PlaceholderContent title="Registro de Costos de Sistemas" description="Próximamente: gestión de costos por sistema." icon={<DollarSign className="h-12 w-12 text-muted-foreground" />} />,
    },
    {
      value: 'fuentesDestinos',
      label: 'Fuentes/Destinos',
      icon: <Share2 className="h-5 w-5 mr-2" />,
      fullDescription: 'Administrar listas para "Información que Recibe" y "Entrega" en Captura. Campos: Nombre de la fuente/destino/formato.',
      content: <PlaceholderContent title="Gestión de Fuentes y Destinos" description="Próximamente: administración de fuentes, destinos y formatos de información." icon={<Share2 className="h-12 w-12 text-muted-foreground" />} />,
    },
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
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 mb-4">
              {configSections.map(section => (
                <TabsTrigger key={section.value} value={section.value} className="flex items-center justify-center">
                  {section.icon}
                  {section.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {configSections.map(section => (
              <TabsContent key={section.value} value={section.value}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                       {section.icon}
                       <span className="ml-2">{section.label}</span>
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">{section.fullDescription}</p>
                  </CardHeader>
                  <CardContent>
                    {section.content}
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

