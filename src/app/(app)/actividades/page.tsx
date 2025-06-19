
'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ListChecks, Search } from "lucide-react";

interface Actividad {
  id: string;
  nombre: string;
  activa: boolean;
  procesosAsociadosCount: number;
}

// Mock data - in a real application, this would come from a service or global state
const initialMockActividades: Actividad[] = [
  { id: '1', nombre: 'Revisión de Documentación Legal', activa: true, procesosAsociadosCount: 5 },
  { id: '2', nombre: 'Elaboración de Propuesta Comercial', activa: true, procesosAsociadosCount: 12 },
  { id: '3', nombre: 'Aprobación de Descuentos Especiales', activa: false, procesosAsociadosCount: 2 },
  { id: '4', nombre: 'Seguimiento Post-Venta', activa: true, procesosAsociadosCount: 8 },
  { id: '5', nombre: 'Capacitación de Nuevo Personal', activa: true, procesosAsociadosCount: 3 },
  { id: '6', nombre: 'Generación de Reporte de Cumplimiento', activa: false, procesosAsociadosCount: 1 },
];

export default function ActividadesPage() {
  const [actividades, setActividades] = useState<Actividad[]>(initialMockActividades);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Placeholder for filtering logic - to be implemented later
  const filteredActividades = actividades.filter(actividad => {
    const matchesSearchTerm = actividad.nombre.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && actividad.activa) ||
      (statusFilter === 'inactive' && !actividad.activa);
    return matchesSearchTerm && matchesStatus;
  });

  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-2 mb-1">
            <ListChecks className="h-6 w-6 text-primary" />
            <CardTitle className="text-2xl font-headline">Gestión de Actividades</CardTitle>
          </div>
          <CardDescription className="text-muted-foreground">
            Visualización centralizada de todas las actividades granulares. La creación, edición y gestión de estados se realiza en Configuración &gt; Actividades.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 space-y-4 md:flex md:items-end md:justify-between md:space-y-0 md:space-x-4">
            <div className="relative flex-1 md:flex-grow">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar actividad por nombre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Select
                value={statusFilter}
                onValueChange={(value: 'all' | 'active' | 'inactive') => setStatusFilter(value)}
              >
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Filtrar por estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="active">Activas</SelectItem>
                  <SelectItem value="inactive">Inactivas</SelectItem>
                </SelectContent>
              </Select>
              {/* Placeholder for more actions or a "Sync" button if needed later */}
            </div>
          </div>

          {filteredActividades.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre de la Actividad</TableHead>
                    <TableHead className="w-[120px] text-center">Estado</TableHead>
                    <TableHead className="w-[180px] text-center">Procesos Asociados</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredActividades.map((actividad) => (
                    <TableRow key={actividad.id}>
                      <TableCell className="font-medium">{actividad.nombre}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={actividad.activa ? 'default' : 'secondary'}>
                          {actividad.activa ? 'Activa' : 'Inactiva'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {actividad.procesosAsociadosCount > 0 ? `${actividad.procesosAsociadosCount} procesos` : 'Próximamente'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="mt-6 p-8 border border-dashed border-border rounded-lg flex flex-col items-center justify-center min-h-[200px] bg-muted/20">
              <ListChecks className="h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-lg font-semibold text-foreground">No se encontraron actividades</p>
              <p className="text-sm text-muted-foreground text-center">
                Ajuste los filtros o agregue actividades en Configuración &gt; Actividades.
              </p>
            </div>
          )}
           <p className="text-xs text-muted-foreground mt-4 text-center md:text-right">
            La gestión detallada (crear, editar, eliminar, activar/inactivar) de actividades se realiza en el módulo de <span className="font-semibold">Configuración &gt; Actividades</span>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
