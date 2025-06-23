
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { ActivitySquare, BookOpen, Download, Filter, Search, Loader2 } from "lucide-react";
import { useAreas } from '@/contexts/AreasContext';
import { usePuestos } from '@/contexts/PuestosContext';
import { useActividades, type Actividad } from '@/contexts/ActividadesContext';
import type { CapturedProcess } from '../procesos-y-flujos-registrados/page';
import { cn } from '@/lib/utils';


const CAPTURED_DATA_LOCAL_STORAGE_KEY = 'proceza-captured-data';

const DetailDisplay = ({ title, value, isList = false, isTextarea = false }: { title: string, value?: string | string[] | number | null, isList?: boolean, isTextarea?: boolean }) => {
  if (value === undefined || value === null || (isList && Array.isArray(value) && value.length === 0) || (typeof value === 'string' && value.trim() === '' && !isTextarea && !isList)) {
    return null;
  }
  return (
    <div className="text-sm">
      <strong className="font-semibold text-foreground/90">{title}:</strong>
      {isList && Array.isArray(value) ? (
        <div className="flex flex-wrap gap-1 mt-1">
          {value.map((item, idx) => (
            <Badge key={idx} variant="secondary">{item}</Badge>
          ))}
        </div>
      ) : (
        <p className={cn("text-muted-foreground", isTextarea && "whitespace-pre-wrap mt-1")}>{typeof value === 'number' ? value.toString() : value}</p>
      )}
    </div>
  );
};

const escapeCsvCell = (cellData: string | number | undefined | null | string[]): string => {
  if (cellData === undefined || cellData === null) {
    return '';
  }
  if (Array.isArray(cellData)) {
    const joinedString = cellData.join('; ');
    if (joinedString.includes(',') || joinedString.includes('"') || joinedString.includes('\n')) {
      return `"${joinedString.replace(/"/g, '""')}"`;
    }
    return joinedString;
  }
  const stringValue = String(cellData);
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};


export default function MatrizManualesPage() {
  const [processes, setProcesses] = useState<CapturedProcess[]>([]);
  const { actividades, isLoadingActividades } = useActividades();
  const { areas, isLoading: isLoadingAreas } = useAreas();
  const { puestos, isLoadingPuestos } = usePuestos();
  
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedArea, setSelectedArea] = useState('all');
  const [selectedPuesto, setSelectedPuesto] = useState('all');

  useEffect(() => {
    setIsLoading(true);
    try {
      const storedData = localStorage.getItem(CAPTURED_DATA_LOCAL_STORAGE_KEY);
      if (storedData) {
        const allProcesses: CapturedProcess[] = JSON.parse(storedData);
        setProcesses(allProcesses.filter(p => !p.deletedAt && p.activo !== false));
      }
    } catch (e) {
      console.error("Error loading processes for matrix view:", e);
      toast({ title: "Error al cargar procesos", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const filteredProcesses = useMemo(() => {
    return processes.filter(proc => {
      const matchesArea = selectedArea === 'all' || proc.area === selectedArea;
      const matchesPuesto = selectedPuesto === 'all' || proc.puesto === selectedPuesto;
      const matchesSearch = searchTerm === '' || 
        proc.proceso.toLowerCase().includes(searchTerm.toLowerCase()) ||
        proc.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (proc.activityOrder || []).some(actId => {
          const act = actividades.find(a => a.id === actId);
          return act?.nombre.toLowerCase().includes(searchTerm.toLowerCase());
        });
      
      return matchesArea && matchesPuesto && matchesSearch;
    }).sort((a,b) => a.proceso.localeCompare(b.proceso));
  }, [processes, searchTerm, selectedArea, selectedPuesto, actividades]);

  const handleExportCsv = () => {
    if (filteredProcesses.length === 0) {
      toast({ title: "Nada que exportar", description: "No hay procesos que coincidan con los filtros actuales.", variant: "default" });
      return;
    }

    const csvRows: string[][] = [];
    const headers = [
      "Tipo", "ID Proceso", "Proceso", "Área", "Puesto", "Frecuencia", "Tiempo Est. (min)", "Costo Est.",
      "ID Actividad", "Actividad", "Tiempo Act. (min)", "Costo Act.", "Sistema Act."
    ];
    csvRows.push(headers);

    filteredProcesses.forEach(proc => {
      csvRows.push([
        "PROCESO",
        escapeCsvCell(proc.id),
        escapeCsvCell(proc.proceso),
        escapeCsvCell(proc.area),
        escapeCsvCell(proc.puesto),
        escapeCsvCell(proc.frecuencia),
        escapeCsvCell(proc.tiempoEstimado),
        escapeCsvCell(proc.costoEstimado ? `${proc.costoEstimado} ${proc.monedaCosto || ''}` : ''),
        "", "", "", "", ""
      ]);

      (proc.activityOrder || []).forEach(actId => {
        const act = actividades.find(a => a.id === actId);
        if (act) {
          csvRows.push([
            "ACTIVIDAD",
            "", "", "", "", "", "", "", // Empty process fields
            escapeCsvCell(act.id),
            escapeCsvCell(act.nombre),
            escapeCsvCell(act.tiempoEstimadoActividad),
            escapeCsvCell(act.costoEstimadoActividad ? `${act.costoEstimadoActividad} ${act.monedaCostoActividad || ''}`: ''),
            escapeCsvCell(act.sistemaUtilizado)
          ]);
        }
      });
      csvRows.push(Array(headers.length).fill("")); // Add a blank row for separation
    });

    const csvString = csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob(["\uFEFF" + csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `matriz_manuales_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: "Exportación Iniciada", description: "El archivo CSV se está descargando." });
    } else {
      toast({ title: "Exportación Fallida", description: "Su navegador no soporta la descarga directa.", variant: "destructive" });
    }
  };


  const isInitialLoading = isLoading || isLoadingActividades || isLoadingAreas || isLoadingPuestos;

  if (isInitialLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-16 w-16 text-primary animate-spin" />
          <p className="ml-4 text-lg text-muted-foreground">Cargando datos maestros...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl font-headline">Matriz de Análisis para Manuales</CardTitle>
          </div>
          <CardDescription>
            Visualice todos los detalles de los procesos y sus actividades en un solo lugar. Utilice los filtros y el exportador para generar manuales y documentación.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 p-4 border rounded-lg bg-muted/30 space-y-4">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-primary" />
              <h4 className="text-md font-semibold">Filtros de la Matriz</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
              <div className="relative lg:col-span-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Buscar en procesos o actividades..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10"
                />
              </div>
              <div>
                <Select value={selectedArea} onValueChange={setSelectedArea} disabled={isLoadingAreas}>
                  <SelectTrigger><SelectValue placeholder="Filtrar por Área..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las Áreas</SelectItem>
                    {areas.map(area => <SelectItem key={area.id} value={area.nombre}>{area.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Select value={selectedPuesto} onValueChange={setSelectedPuesto} disabled={isLoadingPuestos}>
                  <SelectTrigger><SelectValue placeholder="Filtrar por Puesto..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los Puestos</SelectItem>
                    {puestos.map(puesto => <SelectItem key={puesto.id} value={puesto.nombre}>{puesto.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleExportCsv} variant="outline" disabled={filteredProcesses.length === 0}>
                <Download className="mr-2 h-4 w-4" /> Exportar a CSV ({filteredProcesses.length})
              </Button>
            </div>
          </div>
          
          <div className="mt-6">
            {filteredProcesses.length > 0 ? (
              <Accordion type="multiple" className="w-full">
                {filteredProcesses.map(proc => (
                  <AccordionItem key={proc.id} value={proc.id}>
                    <AccordionTrigger>
                      <div className="flex flex-col text-left">
                        <span className="font-bold text-base text-primary">{proc.proceso}</span>
                        <span className="text-xs text-muted-foreground">{proc.area} / {proc.puesto}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 p-4 bg-muted/20 rounded-b-md">
                      <Card>
                        <CardHeader><CardTitle className="text-lg">Detalles del Proceso</CardTitle></CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          <DetailDisplay title="Descripción" value={proc.descripcion} isTextarea />
                          <DetailDisplay title="Frecuencia" value={proc.frecuencia} />
                          <DetailDisplay title="Tiempo Estimado" value={proc.tiempoEstimado !== undefined ? `${proc.tiempoEstimado} min` : null} />
                          <DetailDisplay title="Costo Estimado" value={proc.costoEstimado !== undefined ? `${proc.costoEstimado} ${proc.monedaCosto || ''}`: null} />
                          <DetailDisplay title="Sistemas" value={proc.sistemas} isList />
                          <DetailDisplay title="Entradas" value={proc.informacionRecibe} isTextarea />
                          <DetailDisplay title="Salidas" value={proc.informacionEntrega} isTextarea />
                           <DetailDisplay title="Procesos de Entrada" value={proc.procesosEntrada} isList />
                          <DetailDisplay title="Procesos de Salida" value={proc.procesosSalida} isList />
                        </CardContent>
                      </Card>
                      
                      <div>
                        <h4 className="font-semibold text-lg mb-2">Actividades en Orden</h4>
                         {(proc.activityOrder && proc.activityOrder.length > 0) ? (
                            <div className="space-y-3">
                              {proc.activityOrder.map((actId, index) => {
                                const act = actividades.find(a => a.id === actId);
                                if (!act) return <div key={actId} className="p-2 border rounded text-sm text-destructive">Actividad con ID {actId} no encontrada.</div>;
                                return (
                                  <Card key={act.id} className="bg-background">
                                    <CardHeader className="flex-row items-center gap-4 space-y-0 p-4">
                                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">{index + 1}</span>
                                      <CardTitle className="text-base">{act.nombre}</CardTitle>
                                    </CardHeader>
                                    <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4 pt-0 pl-16">
                                      <DetailDisplay title="Descripción" value={act.descripcionBreve} isTextarea />
                                      <DetailDisplay title="Tiempo Estimado" value={act.tiempoEstimadoActividad !== undefined ? `${act.tiempoEstimadoActividad} min` : null} />
                                      <DetailDisplay title="Costo Estimado" value={act.costoEstimadoActividad !== undefined ? `${act.costoEstimadoActividad} ${act.monedaCostoActividad || ''}` : null} />
                                      <DetailDisplay title="Sistema Utilizado" value={act.sistemaUtilizado} />
                                       <DetailDisplay title="Frecuencia" value={act.frecuenciaActividad} />
                                    </CardContent>
                                  </Card>
                                );
                              })}
                            </div>
                         ) : (
                           <p className="text-sm text-muted-foreground italic">Este proceso no tiene actividades definidas en orden.</p>
                         )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : (
              <div className="mt-10 p-8 border border-dashed border-border rounded-lg flex flex-col items-center justify-center min-h-[300px] bg-muted/20">
                <ActivitySquare className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-lg font-semibold text-foreground">
                  {processes.length === 0 ? "No hay procesos activos" : "No se encontraron procesos"}
                </p>
                <p className="text-sm text-muted-foreground text-center">
                  {processes.length === 0 
                    ? 'Comience registrando procesos en el módulo de "Captura".'
                    : 'Intente ajustar su término de búsqueda o filtros.'
                  }
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
