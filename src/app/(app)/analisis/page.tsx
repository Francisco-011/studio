
'use client';

import { useState, type ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from '@/hooks/use-toast';
import { ActivitySquare } from "lucide-react";
import { cn } from '@/lib/utils';

interface Area {
  id: string;
  nombre: string;
}

interface Actividad {
  id: string;
  nombre: string;
}

// Mock data - in a real app, this would come from state management or API calls
const initialMockAreas: Area[] = [
  { id: 'area1', nombre: 'Ventas Global' },
  { id: 'area2', nombre: 'Marketing Digital' },
  { id: 'area3', nombre: 'Operaciones Central' },
  { id: 'area4', nombre: 'Finanzas Corporativas' },
  { id: 'area5', nombre: 'Recursos Humanos LatAm' },
];

const initialMockActividades: Actividad[] = [
  { id: 'act1', nombre: 'Prospección de Clientes Nuevos' },
  { id: 'act2', nombre: 'Elaboración de Propuestas Comerciales' },
  { id: 'act3', nombre: 'Seguimiento de Leads Calificados' },
  { id: 'act4', nombre: 'Cierre de Ventas y Contratos' },
  { id: 'act5', nombre: 'Facturación y Cobranza de Servicios' },
  { id: 'act6', nombre: 'Soporte Post-Venta y Fidelización' },
  { id: 'act7', nombre: 'Desarrollo de Campañas Publicitarias' },
  { id: 'act8', nombre: 'Gestión de Inventarios y Logística' },
];

export default function AnalisisPage() {
  const [areas, setAreas] = useState<Area[]>(initialMockAreas);
  const [actividades, setActividades] = useState<Actividad[]>(initialMockActividades);
  const [matrixData, setMatrixData] = useState<Record<string, Record<string, boolean>>>({});

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
    toast({ title: "Matriz Actualizada", description: "Los cambios en la matriz han sido guardados." });
  };

  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center gap-2">
          <ActivitySquare className="h-6 w-6 text-primary" />
          <CardTitle className="text-2xl font-headline">Matriz de Análisis Transversal</CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription className="mb-6">
            Visualiza las relaciones entre actividades y áreas. Marque las casillas donde una actividad se realiza dentro de un área.
            Las actividades realizadas en múltiples áreas (duplicidades) se resaltarán automáticamente. Los cambios se guardan al marcar/desmarcar.
          </CardDescription>

          {areas.length === 0 || actividades.length === 0 ? (
            <div className="mt-6 p-8 border border-dashed border-border rounded-lg flex flex-col items-center justify-center min-h-[300px] bg-muted/20">
              <ActivitySquare className="h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-lg font-semibold text-foreground">Datos Insuficientes para la Matriz</p>
              <p className="text-sm text-muted-foreground text-center">
                Asegúrese de tener áreas y actividades configuradas para poder visualizarlas en la matriz.
              </p>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-card z-10 min-w-[250px] font-semibold">Actividad</TableHead>
                    {areas.map(area => (
                      <TableHead key={area.id} className="text-center min-w-[180px] font-semibold">{area.nombre}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {actividades.map(actividad => {
                    const areasPerformingActivity = Object.keys(matrixData[actividad.id] || {}).filter(
                      areaId => matrixData[actividad.id]?.[areaId]
                    );
                    const isDuplicated = areasPerformingActivity.length > 1;

                    return (
                      <TableRow key={actividad.id}>
                        <TableCell className="font-medium sticky left-0 bg-card z-10">{actividad.nombre}</TableCell>
                        {areas.map(area => {
                          const isChecked = matrixData[actividad.id]?.[area.id] || false;
                          const cellIsHighlighted = isChecked && isDuplicated;
                          
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
