'use client';

import { useState, useMemo, useEffect } from 'react';
import { format, parseISO, isSameDay, startOfDay, endOfDay, isAfter, isBefore, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { History, Loader2, CalendarIcon, Users, Layers, Filter, ListOrdered, FileText } from "lucide-react";
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

const escapeCsvCell = (cellData: string | number | undefined | null): string => {
  if (cellData === undefined || cellData === null) {
    return '';
  }
  const stringValue = String(cellData);
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};


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
    let auditLogIndex = 0; // Counter for unique IDs

    try {
      const storedCapturedProcesses = localStorage.getItem(CAPTURED_DATA_LOCAL_STORAGE_KEY);
      const capturedProcesses: CapturedProcess[] = storedCapturedProcesses ? JSON.parse(storedCapturedProcesses) : [];

      capturedProcesses.forEach(proc => {
        if (proc.capturedAt && isValid(parseISO(proc.capturedAt))) {
          generatedLog.push({
            id: `log_${auditLogIndex++}_proc_create_${proc.id}_${parseISO(proc.capturedAt).getTime()}`,
            timestamp: proc.capturedAt,
            user,
            module: "Procesos y Flujos",
            action: "Creación",
            details: `Proceso '${proc.proceso}' (ID: ${proc.id}) registrado.`
          });
        }
        if (proc.deletedAt && isValid(parseISO(proc.deletedAt))) {
           generatedLog.push({
            id: `log_${auditLogIndex++}_proc_delete_${proc.id}_${parseISO(proc.deletedAt).getTime()}`,
            timestamp: proc.deletedAt,
            user,
            module: "Procesos y Flujos",
            action: "Eliminación",
            details: `Proceso '${proc.proceso}' (ID: ${proc.id}) eliminado.`
          });
        }
        // Ensure proc.updatedAt is a number and different enough from capturedAt to be considered a distinct update
        const capturedTime = proc.capturedAt ? parseISO(proc.capturedAt).getTime() : 0;
        if (proc.updatedAt && typeof proc.updatedAt === 'number' && isValid(new Date(proc.updatedAt)) && proc.updatedAt > (capturedTime + 60000) && !proc.deletedAt) {
          generatedLog.push({
            id: `log_${auditLogIndex++}_proc_update_${proc.id}_${proc.updatedAt}`,
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
        // Ensure act.id is a string for key generation consistency
        const activityIdStr = String(act.id);
        const creationTime = act.createdAt || parseInt(activityIdStr, 10) || Date.now();
        const isEffectivelyCreated = !deletedActividadesData.some(da => da.id === act.id) || (act.deletedAt && creationTime < act.deletedAt);

        if (isValid(new Date(creationTime)) && isEffectivelyCreated) {
             generatedLog.push({
                id: `log_${auditLogIndex++}_act_create_${activityIdStr}_${creationTime}`,
                timestamp: new Date(creationTime).toISOString(),
                user,
                module: "Actividades",
                action: "Creación",
                details: `Actividad '${act.nombre}' (ID: ${activityIdStr}) creada. Estado inicial: ${act.activa ? 'Activa' : 'Inactiva'}.`
              });
        }
        
        if (act.updatedAt && typeof act.updatedAt === 'number' && act.updatedAt > (creationTime + 1000) && !act.deletedAt && isValid(new Date(act.updatedAt))) {
             generatedLog.push({
                id: `log_${auditLogIndex++}_act_update_${activityIdStr}_${act.updatedAt}`,
                timestamp: new Date(act.updatedAt).toISOString(),
                user,
                module: "Actividades",
                action: "Actualización",
                details: `Actividad '${act.nombre}' (ID: ${activityIdStr}) actualizada. Estado: ${act.activa ? 'Activa' : 'Inactiva'}.`
              });
        }

        if (act.deletedAt && typeof act.deletedAt === 'number' && isValid(new Date(act.deletedAt))) {
          generatedLog.push({
            id: `log_${auditLogIndex++}_act_delete_${activityIdStr}_${act.deletedAt}`,
            timestamp: new Date(act.deletedAt).toISOString(),
            user,
            module: "Actividades",
            action: "Eliminación",
            details: `Actividad '${act.nombre}' (ID: ${activityIdStr}) eliminada.`
          });
        }
      });
      
      const storedAcciones = localStorage.getItem(ACCIONES_LOCAL_STORAGE_KEY);
      const acciones: AccionContextType[] = storedAcciones ? JSON.parse(storedAcciones) : [];

      acciones.forEach(acc => {
        // Ensure acc.id is a string
        const accionIdStr = String(acc.id);
        if (acc.fechaCreacion && isValid(parseISO(acc.fechaCreacion))) {
          generatedLog.push({
            id: `log_${auditLogIndex++}_accion_create_${accionIdStr}_${parseISO(acc.fechaCreacion).getTime()}`,
            timestamp: acc.fechaCreacion,
            user,
            module: "Acciones",
            action: "Creación",
            details: `Acción de mejora '${acc.nombre}' (ID: ${accionIdStr}) creada.`
          });
        }
        // Ensure acc.updatedAt is a number and different enough from fechaCreacion
        const creacionTimeAccion = acc.fechaCreacion ? parseISO(acc.fechaCreacion).getTime() : 0;
        if (acc.updatedAt && typeof acc.updatedAt === 'number' && isValid(new Date(acc.updatedAt)) && (acc.updatedAt > (creacionTimeAccion + 60000))) {
           generatedLog.push({
            id: `log_${auditLogIndex++}_accion_update_${accionIdStr}_${acc.updatedAt}`,
            timestamp: new Date(acc.updatedAt).toISOString(),
            user,
            module: "Acciones",
            action: "Actualización",
            details: `Acción de mejora '${acc.nombre}' (ID: ${accionIdStr}) actualizada. Estado: ${acc.estado}.`
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
    setCurrentPage(1); 
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

  const handleExport = () => {
    if (filteredSimulatedLog.length === 0) {
      toast({ title: "Nada que exportar", description: "No hay entradas de auditoría que coincidan con los filtros actuales.", variant: "default" });
      return;
    }

    const headers = ["ID Log", "Fecha y Hora", "Usuario", "Módulo", "Acción", "Detalles"];
    const csvRows = [
      headers.join(','),
      ...filteredSimulatedLog.map(entry => [
        escapeCsvCell(entry.id),
        escapeCsvCell(isValid(parseISO(entry.timestamp)) ? format(parseISO(entry.timestamp), 'yyyy-MM-dd HH:mm:ss') : 'Fecha inválida'),
        escapeCsvCell(entry.user),
        escapeCsvCell(entry.module),
        escapeCsvCell(entry.action),
        escapeCsvCell(entry.details)
      ].join(','))
    ];

    const csvString = csvRows.join('\n');
    const blob = new Blob(["\uFEFF" + csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `auditoria_${new Date().toISOString().split('T')[0]}.csv`);
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
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
                  <Button onClick={handleExport} variant="outline" className="w-full self-end">
                    <FileText className="mr-2 h-4 w-4" /> Exportar CSV ({filteredSimulatedLog.length})
                  </Button>
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

    