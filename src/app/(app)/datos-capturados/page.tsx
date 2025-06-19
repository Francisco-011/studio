
'use client';

import { useState, useEffect, useMemo } from 'react';
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
  DialogTrigger,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Database, Search, Eye, Trash2, AlertTriangle, FileText, FileX } from "lucide-react";
import type { CapturaFormData } from '../captura/page'; 
import { toast } from '@/hooks/use-toast';

export interface CapturedProcess extends CapturaFormData {
  id: string;
  capturedAt: string;
}

const CAPTURED_DATA_LOCAL_STORAGE_KEY = 'proceza-captured-data';

export default function DatosCapturadosPage() {
  const [allCapturedData, setAllCapturedData] = useState<CapturedProcess[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProcess, setSelectedProcess] = useState<CapturedProcess | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);

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
  
  const handleClearData = () => {
    try {
      localStorage.removeItem(CAPTURED_DATA_LOCAL_STORAGE_KEY);
      setAllCapturedData([]);
      toast({ title: "Datos Eliminados", description: "Todos los datos capturados han sido eliminados." });
    } catch (error) {
      console.error("Error clearing localStorage:", error);
      toast({ title: "Error", description: "No se pudieron eliminar los datos.", variant: "destructive"});
    }
    setIsConfirmClearOpen(false);
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
              <AlertDialog open={isConfirmClearOpen} onOpenChange={setIsConfirmClearOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full sm:w-auto" disabled={allCapturedData.length === 0}>
                    <Trash2 className="mr-2 h-4 w-4" /> Limpiar Datos
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                       <div className="flex items-center">
                         <AlertTriangle className="h-5 w-5 mr-2 text-destructive" />
                         Confirmar Limpieza Total
                       </div>
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      ¿Está seguro de que desea eliminar TODOS los datos capturados? Esta acción es irreversible y borrará toda la información de procesos guardada.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClearData} className={buttonVariants({ variant: "destructive" })}>
                      Sí, Eliminar Todo
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
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
                    <TableHead className="text-right w-[120px]">Acciones</TableHead>
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
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleViewDetails(proc)}>
                          <Eye className="h-4 w-4" />
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
              <div>
                <h4 className="font-semibold text-sm">Área:</h4>
                <p className="text-sm text-muted-foreground">{selectedProcess.area}</p>
              </div>
              <div>
                <h4 className="font-semibold text-sm">Puesto Principal:</h4>
                <p className="text-sm text-muted-foreground">{selectedProcess.puesto}</p>
              </div>
              <div>
                <h4 className="font-semibold text-sm">Descripción Detallada:</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedProcess.descripcion}</p>
              </div>
              <div>
                <h4 className="font-semibold text-sm">Tiempo Estimado:</h4>
                <p className="text-sm text-muted-foreground">
                  {selectedProcess.tiempoEstimado !== undefined ? `${selectedProcess.tiempoEstimado} minutos` : 'No especificado'}
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-sm">Frecuencia:</h4>
                <p className="text-sm text-muted-foreground">{selectedProcess.frecuencia || 'No especificada'}</p>
              </div>
              <div>
                <h4 className="font-semibold text-sm">Sistemas Utilizados:</h4>
                {selectedProcess.sistemas && selectedProcess.sistemas.length > 0 ? (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedProcess.sistemas.map((sys, idx) => (
                      <Badge key={idx} variant="secondary">{sys}</Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Ninguno especificado.</p>
                )}
              </div>
              <div>
                <h4 className="font-semibold text-sm">Actividades Granulares:</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedProcess.actividades}</p>
              </div>
              <div>
                <h4 className="font-semibold text-sm">Flujo de Información:</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedProcess.flujoInformacion}</p>
              </div>
            </div>
          )}
          <DialogClose asChild>
            <Button type="button" variant="outline" className="mt-4 w-full">Cerrar</Button>
          </DialogClose>
        </DialogContent>
      </Dialog>
    </div>
  );
}

