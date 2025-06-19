
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { ActivitySquare } from "lucide-react";

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
  { id: 'area1', nombre: 'Ventas' },
  { id: 'area2', nombre: 'Marketing' },
  { id: 'area3', nombre: 'Operaciones' },
  { id: 'area4', nombre: 'Finanzas' },
];

const initialMockActividades: Actividad[] = [
  { id: 'act1', nombre: 'Prospección de Clientes' },
  { id: 'act2', nombre: 'Elaboración de Propuestas' },
  { id: 'act3', nombre: 'Seguimiento de Leads' },
  { id: 'act4', nombre: 'Cierre de Ventas' },
  { id: 'act5', nombre: 'Facturación' },
  { id: 'act6', nombre: 'Soporte Post-Venta' },
];

export default function AnalisisPage() {
  const [areas, setAreas] = useState<Area[]>(initialMockAreas);
  const [actividades, setActividades] = useState<Actividad[]>(initialMockActividades);
  
  // In a real app, matrixData would be managed and likely stored
  // For now, it's just for rendering checkboxes.
  // const [matrixData, setMatrixData] = useState<Record<string, Record<string, boolean>>>({});

  // const handleCheckboxChange = (actividadId: string, areaId: string) => {
  //   setMatrixData(prev => ({
  //     ...prev,
  //     [actividadId]: {
  //       ...prev[actividadId],
  //       [areaId]: !prev[actividadId]?.[areaId]
  //     }
  //   }));
  //   // TODO: Persist this change
  // };

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
            (Funcionalidad de guardado y resaltado de duplicidades próximamente).
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
                    <TableHead className="sticky left-0 bg-card z-10 min-w-[200px]">Actividad</TableHead>
                    {areas.map(area => (
                      <TableHead key={area.id} className="text-center min-w-[150px]">{area.nombre}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {actividades.map(actividad => (
                    <TableRow key={actividad.id}>
                      <TableCell className="font-medium sticky left-0 bg-card z-10">{actividad.nombre}</TableCell>
                      {areas.map(area => (
                        <TableCell key={area.id} className="text-center">
                          <Checkbox
                            aria-label={`Actividad ${actividad.nombre} en Área ${area.nombre}`}
                            // checked={matrixData[actividad.id]?.[area.id] || false}
                            // onCheckedChange={() => handleCheckboxChange(actividad.id, area.id)}
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
