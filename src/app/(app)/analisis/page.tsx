
'use client';

import { useState, type ReactNode, useMemo } from 'react';
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
import { ActivitySquare, Search, Filter, CheckSquare, XSquare, CopyCheck } from "lucide-react";
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface Area {
  id: string;
  nombre: string;
}

interface Actividad {
  id: string;
  nombre: string;
  activa: boolean; // Added for status filter
}

// Mock data - in a real app, this would come from state management or API calls
const initialMockAreas: Area[] = [
  { id: 'area1', nombre: 'Ventas Global' },
  { id: 'area2', nombre: 'Marketing Digital' },
  { id: 'area3', nombre: 'Operaciones Central' },
  { id: 'area4', nombre: 'Finanzas Corporativas' },
  { id: 'area5', nombre: 'Recursos Humanos LatAm' },
  { id: 'area6', nombre: 'Soporte Técnico Nivel 1' },
  { id: 'area7', nombre: 'Desarrollo de Producto' },
];

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
  const [areas] = useState<Area[]>(initialMockAreas);
  const [actividades] = useState<Actividad[]>(initialMockActividades);
  const [matrixData, setMatrixData] = useState<Record<string, Record<string, boolean>>>({});

  const [selectedAreaIds, setSelectedAreaIds] = useState<string[]>(areas.map(a => a.id)); // Default to all areas selected
  const [searchTermActividad, setSearchTermActividad] = useState('');
  const [statusFilterActividad, setStatusFilterActividad] = useState<'all' | 'active' | 'inactive'>('all');
  const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'assigned' | 'unassigned' | 'duplicated'>('all');

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

  const displayedAreas = useMemo(() => {
    if (selectedAreaIds.length === 0) return areas; // Show all if none are explicitly selected (or handle as "show none")
    return areas.filter(area => selectedAreaIds.includes(area.id));
  }, [areas, selectedAreaIds]);

  const displayedActividades = useMemo(() => {
    return actividades.filter(actividad => {
      // Filter by search term
      if (searchTermActividad && !actividad.nombre.toLowerCase().includes(searchTermActividad.toLowerCase())) {
        return false;
      }

      // Filter by activity status
      if (statusFilterActividad !== 'all') {
        if (statusFilterActividad === 'active' && !actividad.activa) return false;
        if (statusFilterActividad === 'inactive' && actividad.activa) return false;
      }

      // Filter by assignment
      const assignmentsForActivity = Object.values(matrixData[actividad.id] || {}).filter(Boolean).length;
      const assignmentsInDisplayedAreas = displayedAreas.reduce((count, area) => {
        if (matrixData[actividad.id]?.[area.id]) {
          return count + 1;
        }
        return count;
      }, 0);
      
      const totalAssignmentsGlobal = initialMockAreas.reduce((count, area) => {
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
            if (totalAssignmentsGlobal <= 1) return false; // Duplicated if assigned to >1 area globally
            break;
        }
      }
      return true;
    });
  }, [actividades, searchTermActividad, statusFilterActividad, assignmentFilter, matrixData, displayedAreas]);

  const toggleAreaSelection = (areaId: string) => {
    setSelectedAreaIds(prev =>
      prev.includes(areaId) ? prev.filter(id => id !== areaId) : [...prev, areaId]
    );
  };
  
  const selectAllAreas = () => setSelectedAreaIds(areas.map(a => a.id));
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
            Las duplicidades (actividades en múltiples áreas) se resaltan. Use los filtros para refinar la vista.
          </CardDescription>

          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <Filter className="mr-2 h-4 w-4" />
                  {selectedAreaIds.length === areas.length ? "Todas las áreas" : 
                   selectedAreaIds.length === 0 ? "Ninguna área seleccionada" :
                   `${selectedAreaIds.length} área(s) seleccionada(s)`}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]" align="start">
                <DropdownMenuLabel>Filtrar por Área</DropdownMenuLabel>
                <DropdownMenuSeparator />
                 <div className="flex justify-between px-2 py-1.5">
                    <Button variant="link" size="sm" onClick={selectAllAreas} className="p-0 h-auto">Seleccionar Todas</Button>
                    <Button variant="link" size="sm" onClick={deselectAllAreas} className="p-0 h-auto">Deseleccionar Todas</Button>
                 </div>
                <DropdownMenuSeparator />
                {areas.map(area => (
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
          </div>

          {displayedAreas.length === 0 || displayedActividades.length === 0 ? (
            <div className="mt-6 p-8 border border-dashed border-border rounded-lg flex flex-col items-center justify-center min-h-[300px] bg-muted/20">
              <ActivitySquare className="h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-lg font-semibold text-foreground">
                { (areas.length === 0 || actividades.length === 0) && !(selectedAreaIds.length === 0 && areas.length > 0)
                    ? "Datos Insuficientes para la Matriz"
                    : "No hay resultados con los filtros aplicados"
                }
              </p>
              <p className="text-sm text-muted-foreground text-center">
                 { (areas.length === 0 || actividades.length === 0) && !(selectedAreaIds.length === 0 && areas.length > 0)
                    ? "Asegúrese de tener áreas y actividades configuradas."
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
                    const areasPerformingActivityGlobally = initialMockAreas.filter(
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
