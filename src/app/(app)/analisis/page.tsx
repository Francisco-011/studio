
'use client';

import { useState, type ReactNode, useMemo, useEffect } from 'react';
import { useAreas, type Area } from '@/contexts/AreasContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from '@/hooks/use-toast';
import { ActivitySquare, Search, Filter, CheckSquare, XSquare, CopyCheck, Sparkles, Building } from "lucide-react";
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

// Area interface is now imported from AreasContext

interface Actividad {
  id: string;
  nombre: string;
  activa: boolean;
}

// Removed initialMockAreas, will use areas from context

const initialMockActividades: Actividad[] = [
  { id: 'act1', nombre: 'Prospección de Clientes Nuevos', activa: true },
  { id: 'act2', nombre: 'Elaboración de Propuestas Comerciales', activa: true },
  { id: 'act3', nombre: 'Seguimiento de Leads Calificados', activa: false },
  { id: 'act4', nombre: 'Cierre de Ventas y Contratos', activa: true },
  { id: 'act5', nombre: 'Facturación y Cobranza de Servicios', activa: true },
  { id: 'act6', nombre: 'Soporte Post-Venta y Fidelización', activa: false },
  { id: 'act7', nombre: 'Desarrollo de Campañas Publicitarias', activa: true },
  { id: 'act8', nombre: 'Gestión de Inventarios y Logística', activa: true },
  { id: 'act9', nombre: 'Onboarding de Nuevos Empleados', activa: true },
  { id: 'act10', nombre: 'Revisión de Cumplimiento Normativo', activa: false },
];

export default function AnalisisPage() {
  const { areas: contextAreas, isLoading: isLoadingAreas } = useAreas(); // Get areas from context
  const [actividades] = useState<Actividad[]>(initialMockActividades);
  const [matrixData, setMatrixData] = useState<Record<string, Record<string, boolean>>>({});

  const [selectedAreaIds, setSelectedAreaIds] = useState<string[]>([]);
  const [searchTermActividad, setSearchTermActividad] = useState('');
  const [statusFilterActividad, setStatusFilterActividad] = useState<'all' | 'active' | 'inactive'>('all');
  const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'assigned' | 'unassigned' | 'duplicated'>('all');

  // Initialize selectedAreaIds when contextAreas load
  useEffect(() => {
    if (!isLoadingAreas && contextAreas.length > 0 && selectedAreaIds.length === 0) {
      setSelectedAreaIds(contextAreas.map(a => a.id));
    }
  }, [contextAreas, isLoadingAreas, selectedAreaIds.length]);


  const handleCheckboxChange = (actividadId: string, areaId: string) => {
    setMatrixData(prev => {
      const newMatrixData = {
        ...prev,
        [actividadId]: {
          ...prev[actividadId],
          [areaId]: !prev[actividadId]?.[areaId]
        }
      };
      return newMatrixData;
    });
    toast({ title: "Matriz Actualizada", description: "Los cambios en la matriz han sido guardados localmente." });
  };

  const handleAutoFill = () => {
    const newMatrixData = { ...matrixData };
    displayedActividades.forEach(actividad => {
      displayedAreas.forEach(area => {
        if (!newMatrixData[actividad.id]) {
          newMatrixData[actividad.id] = {};
        }
        // Simulate AI decision with 30% chance of being true
        newMatrixData[actividad.id][area.id] = Math.random() < 0.3;
      });
    });
    setMatrixData(newMatrixData);
    toast({ title: "Llenado Automático Simulado", description: "La matriz ha sido actualizada con sugerencias (simulación)." });
  };

  const displayedAreas = useMemo(() => {
    if (isLoadingAreas) return [];
    if (selectedAreaIds.length === 0) return contextAreas;
    return contextAreas.filter(area => selectedAreaIds.includes(area.id));
  }, [contextAreas, selectedAreaIds, isLoadingAreas]);

  const displayedActividades = useMemo(() => {
    return actividades.filter(actividad => {
      if (searchTermActividad && !actividad.nombre.toLowerCase().includes(searchTermActividad.toLowerCase())) {
        return false;
      }
      if (statusFilterActividad !== 'all') {
        if (statusFilterActividad === 'active' && !actividad.activa) return false;
        if (statusFilterActividad === 'inactive' && actividad.activa) return false;
      }
      
      const assignmentsInDisplayedAreas = displayedAreas.reduce((count, area) => {
        if (matrixData[actividad.id]?.[area.id]) {
          return count + 1;
        }
        return count;
      }, 0);
      
      // For 'duplicated' filter, check against all contextAreas, not just displayedAreas
      const totalAssignmentsGlobal = contextAreas.reduce((count, area) => {
         if (matrixData[actividad.id]?.[area.id]) {
          return count + 1;
        }
        return count;
      }, 0);

      if (assignmentFilter !== 'all') {
        switch (assignmentFilter) {
          case 'assigned':
            if (assignmentsInDisplayedAreas === 0) return false;
            break;
          case 'unassigned':
            if (assignmentsInDisplayedAreas > 0) return false;
            break;
          case 'duplicated':
            if (totalAssignmentsGlobal <= 1) return false;
            break;
        }
      }
      return true;
    });
  }, [actividades, searchTermActividad, statusFilterActividad, assignmentFilter, matrixData, displayedAreas, contextAreas]);

  const toggleAreaSelection = (areaId: string) => {
    setSelectedAreaIds(prev =>
      prev.includes(areaId) ? prev.filter(id => id !== areaId) : [...prev, areaId]
    );
  };
  
  const selectAllAreas = () => setSelectedAreaIds(contextAreas.map(a => a.id));
  const deselectAllAreas = () => setSelectedAreaIds([]);

  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center gap-2">
          <ActivitySquare className="h-6 w-6 text-primary" />
          <CardTitle className="text-2xl font-headline">Matriz de Análisis Transversal</CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription className="mb-6">
            Visualiza las relaciones entre actividades y áreas. Marque casillas para indicar dónde se realiza una actividad.
            Las duplicidades (actividades en múltiples áreas) se resaltan. Use los filtros para refinar la vista o el botón de "Llenar Automático" para una simulación de IA.
            Las áreas se cargan desde el módulo de Configuración.
          </CardDescription>

          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal" disabled={isLoadingAreas}>
                  <Filter className="mr-2 h-4 w-4" />
                  {isLoadingAreas ? "Cargando áreas..." :
                   selectedAreaIds.length === contextAreas.length ? "Todas las áreas" : 
                   selectedAreaIds.length === 0 ? "Ninguna área seleccionada" :
                   `${selectedAreaIds.length} área(s) seleccionada(s)`}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]" align="start">
                <DropdownMenuLabel>Filtrar por Área</DropdownMenuLabel>
                <DropdownMenuSeparator />
                 <div className="flex justify-between px-2 py-1.5">
                    <Button variant="link" size="sm" onClick={selectAllAreas} className="p-0 h-auto" disabled={contextAreas.length === 0}>Seleccionar Todas</Button>
                    <Button variant="link" size="sm" onClick={deselectAllAreas} className="p-0 h-auto" disabled={contextAreas.length === 0}>Deseleccionar Todas</Button>
                 </div>
                <DropdownMenuSeparator />
                {isLoadingAreas && <DropdownMenuLabel>Cargando...</DropdownMenuLabel>}
                {!isLoadingAreas && contextAreas.length === 0 && <DropdownMenuLabel>No hay áreas configuradas</DropdownMenuLabel>}
                {!isLoadingAreas && contextAreas.map(area => (
                  <DropdownMenuCheckboxItem
                    key={area.id}
                    checked={selectedAreaIds.includes(area.id)}
                    onCheckedChange={() => toggleAreaSelection(area.id)}
                  >
                    {area.nombre}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar actividad..."
                value={searchTermActividad}
                onChange={(e) => setSearchTermActividad(e.target.value)}
                className="w-full pl-10"
              />
            </div>

            <Select value={statusFilterActividad} onValueChange={(v: 'all'|'active'|'inactive') => setStatusFilterActividad(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Estado Actividad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas (Estado)</SelectItem>
                <SelectItem value="active"><CheckSquare className="mr-2 h-4 w-4 inline-block" /> Activas</SelectItem>
                <SelectItem value="inactive"><XSquare className="mr-2 h-4 w-4 inline-block" /> Inactivas</SelectItem>
              </SelectContent>
            </Select>

            <Select value={assignmentFilter} onValueChange={(v: 'all'|'assigned'|'unassigned'|'duplicated') => setAssignmentFilter(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Asignación" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas (Asignación)</SelectItem>
                <SelectItem value="assigned"><CheckSquare className="mr-2 h-4 w-4 inline-block" /> Asignadas</SelectItem>
                <SelectItem value="unassigned"><XSquare className="mr-2 h-4 w-4 inline-block" /> No Asignadas</SelectItem>
                <SelectItem value="duplicated"><CopyCheck className="mr-2 h-4 w-4 inline-block" /> Duplicadas</SelectItem>
              </SelectContent>
            </Select>
            
            <Button onClick={handleAutoFill} variant="outline" className="w-full">
              <Sparkles className="mr-2 h-4 w-4 text-primary" />
              Llenar Automático
            </Button>
          </div>
          {isLoadingAreas ? (
            <div className="mt-6 p-8 border border-dashed border-border rounded-lg flex flex-col items-center justify-center min-h-[300px] bg-muted/20">
              <Building className="h-16 w-16 text-muted-foreground animate-pulse mb-4" />
              <p className="text-lg font-semibold text-foreground">Cargando Áreas...</p>
              <p className="text-sm text-muted-foreground text-center">
                Esperando datos del módulo de configuración.
              </p>
            </div>
          ) : displayedAreas.length === 0 || displayedActividades.length === 0 ? (
            <div className="mt-6 p-8 border border-dashed border-border rounded-lg flex flex-col items-center justify-center min-h-[300px] bg-muted/20">
              <ActivitySquare className="h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-lg font-semibold text-foreground">
                { (contextAreas.length === 0 || actividades.length === 0) && !(selectedAreaIds.length === 0 && contextAreas.length > 0)
                    ? "Datos Insuficientes para la Matriz"
                    : "No hay resultados con los filtros aplicados"
                }
              </p>
              <p className="text-sm text-muted-foreground text-center">
                 { (contextAreas.length === 0 || actividades.length === 0) && !(selectedAreaIds.length === 0 && contextAreas.length > 0)
                    ? "Asegúrese de tener áreas (en Configuración) y actividades configuradas."
                    : "Ajuste los filtros para ver resultados o verifique la configuración de áreas y actividades."
                }
              </p>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-card z-10 min-w-[250px] font-semibold">
                        Actividad
                        <Badge variant="outline" className="ml-2">{displayedActividades.length}</Badge>
                    </TableHead>
                    {displayedAreas.map(area => (
                      <TableHead key={area.id} className="text-center min-w-[180px] font-semibold">{area.nombre}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedActividades.map(actividad => {
                    const areasPerformingActivityGlobally = contextAreas.filter( // Check against all contextAreas
                      area => matrixData[actividad.id]?.[area.id]
                    );
                    const isGloballyDuplicated = areasPerformingActivityGlobally.length > 1;

                    return (
                      <TableRow key={actividad.id}>
                        <TableCell className={cn(
                            "font-medium sticky left-0 bg-card z-10",
                            !actividad.activa && "text-muted-foreground italic"
                          )}>
                          {actividad.nombre}
                          {!actividad.activa && <Badge variant="outline" className="ml-2">Inactiva</Badge>}
                        </TableCell>
                        {displayedAreas.map(area => {
                          const isChecked = matrixData[actividad.id]?.[area.id] || false;
                          const cellIsHighlighted = isChecked && isGloballyDuplicated;
                          
                          return (
                            <TableCell 
                              key={area.id} 
                              className={cn(
                                "text-center transition-colors duration-150",
                                cellIsHighlighted && "bg-yellow-100 dark:bg-yellow-800/30"
                              )}
                            >
                              <Checkbox
                                aria-label={`Actividad ${actividad.nombre} en Área ${area.nombre}`}
                                checked={isChecked}
                                onCheckedChange={() => handleCheckboxChange(actividad.id, area.id)}
                              />
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
