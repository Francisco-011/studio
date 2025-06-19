
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
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
import { Database, Search, Eye, Trash2, AlertTriangle, FileText, FileX, Edit2 } from "lucide-react";
import type { CapturaFormData } from '../captura/page'; 
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export interface CapturedProcess extends CapturaFormData {
  id: string;
  capturedAt: string;
}

const CAPTURED_DATA_LOCAL_STORAGE_KEY = 'proceza-captured-data';

const DetailSection = ({ title, value, isList = false, isTextarea = false }: { title: string, value?: string | string[] | number, isList?: boolean, isTextarea?: boolean }) => {
  if (value === undefined || (isList && Array.isArray(value) && value.length === 0) || (typeof value === 'string' && value.trim() === '' && !isList && !isTextarea) || (isTextarea && typeof value === 'string' && value.trim() === '')) {
    return (
      <div>
        <h4 className="font-semibold text-sm">{title}:</h4>
        <p className="text-sm text-muted-foreground">No especificado.</p>
      </div>
    );
  }

  if (isList && Array.isArray(value)) {
    return (
      <div>
        <h4 className="font-semibold text-sm">{title}:</h4>
        <div className="flex flex-wrap gap-1 mt-1">
          {value.map((item, idx) => (
            <Badge key={idx} variant="secondary">{item}</Badge>
          ))}
        </div>
      </div>
    );
  }
  
  return (
    <div>
      <h4 className="font-semibold text-sm">{title}:</h4>
      <p className={cn("text-sm text-muted-foreground", isTextarea && "whitespace-pre-wrap")}>{typeof value === 'number' ? value.toString() : value}</p>
    </div>
  );
};


export default function DatosCapturadosPage() {
  const router = useRouter();
  const [allCapturedData, setAllCapturedData] = useState<CapturedProcess[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProcess, setSelectedProcess] = useState<CapturedProcess | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [processToDelete, setProcessToDelete] = useState<CapturedProcess | null>(null);
  const [isConfirmDeleteProcessOpen, setIsConfirmDeleteProcessOpen] = useState(false);


  useEffect(() => {
    setIsLoading(true);
    try {
      const storedData = localStorage.getItem(CAPTURED_DATA_LOCAL_STORAGE_KEY);
      if (storedData) {
        setAllCapturedData(JSON.parse(storedData));
      } else {
        setAllCapturedData([]);
      }
    } catch (error) {
      console.error("Error loading data from localStorage:", error);
      toast({ title: "Error al cargar datos", description: "No se pudieron cargar los datos de localStorage.", variant: "destructive" });
      setAllCapturedData([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const filteredData = useMemo(() => {
    if (!searchTerm) return allCapturedData;
    const lowerSearchTerm = searchTerm.toLowerCase();
    return allCapturedData.filter(
      (proc) =>
        proc.proceso.toLowerCase().includes(lowerSearchTerm) ||
        proc.area.toLowerCase().includes(lowerSearchTerm) ||
        proc.puesto.toLowerCase().includes(lowerSearchTerm) ||
        proc.descripcion.toLowerCase().includes(lowerSearchTerm)
    );
  }, [allCapturedData, searchTerm]);

  const handleViewDetails = (proc: CapturedProcess) => {
    setSelectedProcess(proc);
    setIsDetailDialogOpen(true);
  };
  
  const promptDeleteProcess = (proc: CapturedProcess) => {
    setProcessToDelete(proc);
    setIsConfirmDeleteProcessOpen(true);
  };

  const executeDeleteProcess = () => {
    if (!processToDelete) return;
    try {
      const updatedData = allCapturedData.filter(p => p.id !== processToDelete.id);
      setAllCapturedData(updatedData);
      localStorage.setItem(CAPTURED_DATA_LOCAL_STORAGE_KEY, JSON.stringify(updatedData));
      toast({ title: "Proceso Eliminado", description: `El proceso "${processToDelete.proceso}" ha sido eliminado.` });
    } catch (error) {
      console.error("Error deleting process from localStorage:", error);
      toast({ title: "Error", description: "No se pudo eliminar el proceso.", variant: "destructive"});
    }
    setProcessToDelete(null);
    setIsConfirmDeleteProcessOpen(false);
  };

  const handleEditProcess = (proc: CapturedProcess) => {
    router.push(`/captura?editId=${proc.id}`);
  };


  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Database className="h-16 w-16 text-muted-foreground animate-pulse" />
          <p className="ml-4 text-lg text-muted-foreground">Cargando datos capturados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-2 mb-1">
            <Database className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl font-headline">Datos Capturados</CardTitle>
          </div>
          <CardDescription>
            Visualiza, busca y gestiona todos los procesos y flujos de información registrados en el sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative w-full sm:flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar por proceso, área, puesto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10"
              />
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outline" className="w-full sm:w-auto" disabled>
                <FileText className="mr-2 h-4 w-4" /> Exportar (Próx.)
              </Button>
            </div>
          </div>

          {filteredData.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre del Proceso</TableHead>
                    <TableHead>Área</TableHead>
                    <TableHead>Puesto</TableHead>
                    <TableHead>Sistemas</TableHead>
                    <TableHead>Fecha de Captura</TableHead>
                    <TableHead className="text-right w-[160px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((proc) => (
                    <TableRow key={proc.id}>
                      <TableCell className="font-medium">{proc.proceso}</TableCell>
                      <TableCell>{proc.area}</TableCell>
                      <TableCell>{proc.puesto}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {proc.sistemas && proc.sistemas.length > 0 ? (
                            proc.sistemas.map((sys, idx) => (
                              <Badge key={idx} variant="secondary">{sys}</Badge>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground">N/A</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(new Date(proc.capturedAt), 'dd/MM/yyyy HH:mm', { locale: es })}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="icon" onClick={() => handleViewDetails(proc)} title="Ver detalles">
                          <Eye className="h-4 w-4" />
                        </Button>
                         <Button variant="ghost" size="icon" onClick={() => handleEditProcess(proc)} title="Editar proceso">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => promptDeleteProcess(proc)} className="text-destructive hover:text-destructive" title="Eliminar proceso">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="mt-6 p-8 border border-dashed border-border rounded-lg flex flex-col items-center justify-center min-h-[300px] bg-muted/20">
              <FileX className="h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-lg font-semibold text-foreground">
                {allCapturedData.length === 0 ? "No hay datos capturados" : "No se encontraron resultados"}
              </p>
              <p className="text-sm text-muted-foreground text-center">
                {allCapturedData.length === 0 
                  ? 'Comience registrando procesos en el módulo de "Captura".'
                  : 'Intente ajustar su término de búsqueda o revise los datos capturados.'
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalles del Proceso: {selectedProcess?.proceso}</DialogTitle>
            <DialogDescription>
              Información completa del proceso capturado el {selectedProcess && format(new Date(selectedProcess.capturedAt), 'dd MMMM yyyy, HH:mm', { locale: es })}.
            </DialogDescription>
          </DialogHeader>
          {selectedProcess && (
            <div className="py-4 space-y-3 max-h-[70vh] overflow-y-auto pr-2">
              <DetailSection title="Área" value={selectedProcess.area} />
              <DetailSection title="Puesto Principal" value={selectedProcess.puesto} />
              <DetailSection title="Descripción Detallada" value={selectedProcess.descripcion} isTextarea />
              <DetailSection title="Tiempo Estimado" value={selectedProcess.tiempoEstimado !== undefined ? `${selectedProcess.tiempoEstimado} minutos` : undefined} />
              <DetailSection title="Frecuencia" value={selectedProcess.frecuencia} />
              <DetailSection title="Sistemas Utilizados" value={selectedProcess.sistemas} isList />
              <DetailSection title="Actividades Granulares" value={selectedProcess.actividades} isTextarea />
              <DetailSection title="Información que Recibe (Entradas)" value={selectedProcess.informacionRecibe} isTextarea />
              <DetailSection title="Formatos de Información Utilizados (Entradas)" value={selectedProcess.formatosRecibe} isList />
              <DetailSection title="Información que Entrega (Salidas)" value={selectedProcess.informacionEntrega} isTextarea />
              <DetailSection title="Formatos de Información Utilizados (Salidas)" value={selectedProcess.formatosEntrega} isList />
            </div>
          )}
          <DialogClose asChild>
            <Button type="button" variant="outline" className="mt-4 w-full">Cerrar</Button>
          </DialogClose>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isConfirmDeleteProcessOpen} onOpenChange={setIsConfirmDeleteProcessOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <div className="flex items-center">
                <AlertTriangle className="h-5 w-5 mr-2 text-destructive" />
                Confirmar Eliminación de Proceso
              </div>
            </AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro de que desea eliminar el proceso "{processToDelete?.proceso}"? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setProcessToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={executeDeleteProcess} className={buttonVariants({variant: "destructive"})}>Eliminar Proceso</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
