
'use client';

import { useState, useMemo, useEffect } from 'react';
import { format, parseISO, isSameDay, startOfDay, endOfDay, isAfter, isBefore, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { History, Loader2, CalendarIcon, Users, Layers, Filter, ListOrdered } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';

import type { CapturedProcess } from '../procesos-y-flujos-registrados/page';
import type { Actividad as ActividadContextType } from '@/contexts/ActividadesContext';
import type { Accion as AccionContextType } from '@/contexts/AccionesContext';

const CAPTURED_DATA_LOCAL_STORAGE_KEY = 'proceza-captured-data';
const ACTIVIDADES_LOCAL_STORAGE_KEY = 'proceza-actividades';
const DELETED_ACTIVIDADES_LOCAL_STORAGE_KEY = 'proceza-deleted-actividades';
const ACCIONES_LOCAL_STORAGE_KEY = 'proceza-acciones';


interface SimulatedAuditEntry {
  id: string;
  timestamp: string;
  user: string;
  module: string;
  action: string;
  details: string;
}

const ITEMS_PER_PAGE = 15;

export default function AuditoriaPage() {
  const [dynamicSimulatedLog, setDynamicSimulatedLog] = useState<SimulatedAuditEntry[]>([]);
  const [isLoadingLog, setIsLoadingLog] = useState(true);

  const [actionTypeFilter, setActionTypeFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({ from: undefined, to: undefined });
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setIsLoadingLog(true);
    const generatedLog: SimulatedAuditEntry[] = [];
    const user = "Sistema";

    try {
      const storedCapturedProcesses = localStorage.getItem(CAPTURED_DATA_LOCAL_STORAGE_KEY);
      const capturedProcesses: CapturedProcess[] = storedCapturedProcesses ? JSON.parse(storedCapturedProcesses) : [];

      capturedProcesses.forEach(proc => {
        if (proc.capturedAt && isValid(parseISO(proc.capturedAt))) {
          generatedLog.push({
            id: `proc_create_${proc.id}`,
            timestamp: proc.capturedAt,
            user,
            module: "Procesos y Flujos",
            action: "Creación",
            details: `Proceso '${proc.proceso}' (ID: ${proc.id}) registrado.`
          });
        }
        if (proc.deletedAt && isValid(parseISO(proc.deletedAt))) {
           generatedLog.push({
            id: `proc_delete_${proc.id}`,
            timestamp: proc.deletedAt,
            user,
            module: "Procesos y Flujos",
            action: "Eliminación",
            details: `Proceso '${proc.proceso}' (ID: ${proc.id}) eliminado.`
          });
        }
         // Log for updates based on updatedAt timestamp
        if (proc.updatedAt && proc.capturedAt && proc.updatedAt > parseISO(proc.capturedAt).getTime() + 60000 && !proc.deletedAt) {
          generatedLog.push({
            id: `proc_update_${proc.id}`,
            timestamp: new Date(proc.updatedAt).toISOString(),
            user,
            module: "Procesos y Flujos",
            action: "Actualización",
            details: `Proceso '${proc.proceso}' (ID: ${proc.id}) actualizado. Estado: ${proc.activo !== false ? 'Activo' : 'Inactivo'}.`
          });
        }
      });

      const storedActividades = localStorage.getItem(ACTIVIDADES_LOCAL_STORAGE_KEY);
      const activeActividades: ActividadContextType[] = storedActividades ? JSON.parse(storedActividades) : [];
      const storedDeletedActividades = localStorage.getItem(DELETED_ACTIVIDADES_LOCAL_STORAGE_KEY);
      const deletedActividadesData: ActividadContextType[] = storedDeletedActividades ? JSON.parse(storedDeletedActividades) : [];
      
      const allActividades = [...activeActividades, ...deletedActividadesData];

      allActividades.forEach(act => {
        const creationTime = act.createdAt || parseInt(act.id, 10);
        if (creationTime && isValid(new Date(creationTime)) && !act.deletedAt) {
           generatedLog.push({
            id: `act_create_update_${act.id}`,
            timestamp: new Date(creationTime).toISOString(),
            user,
            module: "Actividades",
            action: act.updatedAt && act.updatedAt > creationTime + 1000 ? "Actualización" : "Creación",
            details: `Actividad '${act.nombre}' (ID: ${act.id}) ${act.updatedAt && act.updatedAt > creationTime + 1000 ? 'actualizada' : 'creada'}. Estado: ${act.activa ? 'Activa' : 'Inactiva'}.`
          });
        }
        if (act.deletedAt && isValid(new Date(act.deletedAt))) {
          generatedLog.push({
            id: `act_delete_${act.id}`,
            timestamp: new Date(act.deletedAt).toISOString(),
            user,
            module: "Actividades",
            action: "Eliminación",
            details: `Actividad '${act.nombre}' (ID: ${act.id}) eliminada.`
          });
        }
      });
      
      const storedAcciones = localStorage.getItem(ACCIONES_LOCAL_STORAGE_KEY);
      const acciones: AccionContextType[] = storedAcciones ? JSON.parse(storedAcciones) : [];

      acciones.forEach(acc => {
        if (acc.fechaCreacion && isValid(parseISO(acc.fechaCreacion))) {
          generatedLog.push({
            id: `accion_create_${acc.id}`,
            timestamp: acc.fechaCreacion,
            user,
            module: "Acciones",
            action: "Creación",
            details: `Acción de mejora '${acc.nombre}' (ID: ${acc.id}) creada.`
          });
        }
        if (acc.updatedAt && acc.fechaCreacion && isValid(new Date(acc.updatedAt)) && isValid(parseISO(acc.fechaCreacion)) && (new Date(acc.updatedAt).getTime() > parseISO(acc.fechaCreacion).getTime() + 60000)) {
           generatedLog.push({
            id: `accion_update_${acc.id}`,
            timestamp: new Date(acc.updatedAt).toISOString(),
            user,
            module: "Acciones",
            action: "Actualización",
            details: `Acción de mejora '${acc.nombre}' (ID: ${acc.id}) actualizada. Estado: ${acc.estado}.`
          });
        }
      });

    } catch (e) {
      console.error("Error generating dynamic audit log:", e);
      toast({title: "Error al cargar log", description: "No se pudo generar el registro de actividad dinámico.", variant: "destructive"});
    } finally {
      generatedLog.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setDynamicSimulatedLog(generatedLog);
      setIsLoadingLog(false);
    }
  }, []);


  const uniqueUsers = useMemo(() => {
    const users = new Set(dynamicSimulatedLog.map(entry => entry.user));
    return Array.from(users).sort();
  }, [dynamicSimulatedLog]);

  const uniqueActionTypes = useMemo(() => {
    const actions = new Set(dynamicSimulatedLog.map(entry => entry.action));
    return Array.from(actions).sort();
  }, [dynamicSimulatedLog]);

  const filteredSimulatedLog = useMemo(() => {
    setCurrentPage(1); // Reset page on filter change
    return dynamicSimulatedLog
      .filter(entry => {
        if (actionTypeFilter !== 'all' && entry.action !== actionTypeFilter) {
          return false;
        }
        if (userFilter !== 'all' && entry.user !== userFilter) {
          return false;
        }
        const entryDate = parseISO(entry.timestamp);
        if (!isValid(entryDate)) return false;

        if (dateRange.from && isValid(dateRange.from) && isBefore(entryDate, startOfDay(dateRange.from))) {
          return false;
        }
        if (dateRange.to && isValid(dateRange.to) && isAfter(entryDate, endOfDay(dateRange.to))) {
          return false;
        }
        return true;
      });
  }, [dynamicSimulatedLog, actionTypeFilter, userFilter, dateRange]);

  const totalPages = Math.ceil(filteredSimulatedLog.length / ITEMS_PER_PAGE);
  const paginatedLog = useMemo(() => {
    return filteredSimulatedLog.slice(
      (currentPage - 1) * ITEMS_PER_PAGE,
      currentPage * ITEMS_PER_PAGE
    );
  }, [filteredSimulatedLog, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    } else if (currentPage !== 1 && totalPages === 0 && filteredSimulatedLog.length > 0) {
       setCurrentPage(1);
    }
  }, [currentPage, totalPages, filteredSimulatedLog.length]);

  const totalCambiosFiltrados = useMemo(() => filteredSimulatedLog.length, [filteredSimulatedLog]);

  const cambiosHoyCount = useMemo(() => {
    const today = new Date();
    return filteredSimulatedLog.filter(entry => {
       const entryDate = parseISO(entry.timestamp);
       return isValid(entryDate) && isSameDay(entryDate, today);
    }).length;
  }, [filteredSimulatedLog]);

  const usuariosUnicosEnLogFiltradoCount = useMemo(() => {
    const usersInFilteredLog = new Set(filteredSimulatedLog.map(entry => entry.user));
    return usersInFilteredLog.size;
  }, [filteredSimulatedLog]);
  
  const clearFilters = () => {
    setActionTypeFilter('all');
    setUserFilter('all');
    setDateRange({ from: undefined, to: undefined });
  };

  return (
    <div className="container mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center gap-2">
          <History className="h-6 w-6 text-primary" />
          <CardTitle className="text-2xl font-headline">Módulo de Auditoría</CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription className="mb-6">
            Registro de actividad del sistema con cambios y eventos inferidos de los datos almacenados en Procesos Capturados, Actividades y Acciones de Mejora.
          </CardDescription>
          
          {isLoadingLog ? (
             <div className="flex items-center justify-center min-h-[200px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-3 text-muted-foreground">Cargando registro de actividad...</p>
             </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-3 mb-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total de Cambios Registrados</CardTitle>
                    <Layers className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{totalCambiosFiltrados}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Cambios Hoy</CardTitle>
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{cambiosHoyCount}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Usuarios Únicos (en log filtrado)</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{usuariosUnicosEnLogFiltradoCount}</div>
                  </CardContent>
                </Card>
              </div>

              <div className="mb-6 p-4 border rounded-lg bg-muted/30">
                <div className="flex items-center gap-2 mb-3">
                    <Filter className="h-5 w-5 text-primary"/>
                    <h4 className="text-md font-semibold">Filtros de Auditoría</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                  <div>
                    <Label htmlFor="actionTypeFilter" className="text-xs">Tipo de Acción</Label>
                    <Select value={actionTypeFilter} onValueChange={setActionTypeFilter}>
                      <SelectTrigger id="actionTypeFilter"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los Tipos</SelectItem>
                        {uniqueActionTypes.map(action => <SelectItem key={action} value={action}>{action}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="userFilter" className="text-xs">Usuario</Label>
                    <Select value={userFilter} onValueChange={setUserFilter}>
                      <SelectTrigger id="userFilter"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos los Usuarios</SelectItem>
                        {uniqueUsers.map(user => <SelectItem key={user} value={user}>{user}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="dateFrom" className="text-xs">Fecha Desde</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button id="dateFrom" variant={"outline"} className={cn("w-full justify-start text-left font-normal", !dateRange.from && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateRange.from && isValid(dateRange.from) ? format(dateRange.from, "PPP", { locale: es }) : <span>Seleccione fecha</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={dateRange.from} onSelect={(date) => setDateRange(prev => ({ ...prev, from: date ?? undefined }))} initialFocus />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label htmlFor="dateTo" className="text-xs">Fecha Hasta</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button id="dateTo" variant={"outline"} className={cn("w-full justify-start text-left font-normal", !dateRange.to && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateRange.to && isValid(dateRange.to) ? format(dateRange.to, "PPP", { locale: es }) : <span>Seleccione fecha</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={dateRange.to} onSelect={(date) => setDateRange(prev => ({ ...prev, to: date ?? undefined }))} initialFocus disabled={(date) => dateRange.from && isValid(dateRange.from) ? date < dateRange.from : false }/>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <Button onClick={clearFilters} variant="link" className="mt-3 px-0 text-sm">Limpiar Filtros</Button>
              </div>

              {paginatedLog.length > 0 ? (
                <>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[180px]">Fecha y Hora</TableHead>
                        <TableHead>Usuario</TableHead>
                        <TableHead>Módulo</TableHead>
                        <TableHead>Acción</TableHead>
                        <TableHead>Detalles</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedLog.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="text-xs text-muted-foreground">
                            {isValid(parseISO(entry.timestamp)) ? format(parseISO(entry.timestamp), 'dd/MM/yyyy HH:mm:ss', { locale: es }) : 'Fecha inválida'}
                          </TableCell>
                          <TableCell>{entry.user}</TableCell>
                          <TableCell>{entry.module}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              entry.action === 'Creación' ? 'bg-green-100 text-green-800 dark:bg-green-800/30 dark:text-green-300' :
                              entry.action === 'Actualización' ? 'bg-blue-100 text-blue-800 dark:bg-blue-800/30 dark:text-blue-300' :
                              entry.action === 'Eliminación' ? 'bg-red-100 text-red-800 dark:bg-red-800/30 dark:text-red-300' :
                              'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                            }`}>
                              {entry.action}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm">{entry.details}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex items-center justify-between space-x-2 py-4">
                  <span className="text-sm text-muted-foreground">
                    Página {currentPage} de {totalPages} (Total: {filteredSimulatedLog.length} entradas)
                  </span>
                  <div className="space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages || totalPages === 0}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
                </>
              ) : (
                <div className="mt-6 p-8 border border-dashed border-border rounded-lg flex flex-col items-center justify-center min-h-[200px] bg-muted/20">
                    <ListOrdered className="h-16 w-16 text-muted-foreground mb-4" />
                    <p className="text-lg font-semibold text-foreground">No hay entradas de auditoría</p>
                    <p className="text-sm text-muted-foreground text-center">
                        { dynamicSimulatedLog.length === 0 ? "No hay actividad registrada en los módulos monitorizados (Procesos, Actividades, Acciones)." : "Ajuste los filtros para ver resultados."}
                    </p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

