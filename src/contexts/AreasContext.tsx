
'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useActivityLog } from './ActivityLogContext';
import { toast } from '@/hooks/use-toast';
import type { CapturedProcess } from '@/app/(app)/procesos-y-flujos-registrados/page';
import type { Accion } from './AccionesContext';
import type { Departamento } from './DepartamentosContext';
import type { Puesto } from './PuestosContext';
import type { Sistema } from './SistemasCostosContext';

export interface Area {
  id: string;
  nombre: string;
}

interface AreasContextType {
  areas: Area[];
  addArea: (nombre: string) => void;
  updateArea: (id: string, nombre: string, allProcesses: CapturedProcess[], allAcciones: Accion[]) => void;
  deleteArea: (id: string, allDepartamentos: Departamento[], allPuestos: Puesto[], allSistemas: Sistema[], allProcesses: CapturedProcess[], allAcciones: Accion[]) => boolean;
  isLoading: boolean;
}

const AreasContext = createContext<AreasContextType | undefined>(undefined);

const LOCAL_STORAGE_AREAS_KEY = 'proceza-areas';
const LOCAL_STORAGE_PROCESOS_KEY = 'proceza-captured-data';
const LOCAL_STORAGE_ACCIONES_KEY = 'proceza-acciones';

export function AreasProvider({ children }: { children: ReactNode }) {
  const [areas, setAreas] = useState<Area[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { addLogEntry } = useActivityLog();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedAreas = localStorage.getItem(LOCAL_STORAGE_AREAS_KEY);
        if (savedAreas) {
          setAreas(JSON.parse(savedAreas));
        }
      } catch (error) {
        console.error("Failed to load areas from localStorage", error);
        setAreas([]); 
      } finally {
        setIsLoading(false);
      }
    } else {
        setIsLoading(false); // No localStorage on server
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && !isLoading) {
       try {
        localStorage.setItem(LOCAL_STORAGE_AREAS_KEY, JSON.stringify(areas));
      } catch (error) {
        console.error("Failed to save areas to localStorage", error);
      }
    }
  }, [areas, isLoading]);

  const addArea = useCallback((nombre: string) => {
    const newArea = { id: Date.now().toString(), nombre };
    setAreas((prevAreas) => [...prevAreas, newArea]);
    addLogEntry({ action: 'create', entityType: 'Área', entityName: nombre, details: `Se creó el área "${nombre}".` });
  }, [addLogEntry]);

  const updateArea = useCallback((id: string, nombre: string, allProcesses: CapturedProcess[], allAcciones: Accion[]) => {
    setAreas((prevAreas) => {
      const originalArea = prevAreas.find(a => a.id === id);
      if (!originalArea || originalArea.nombre === nombre) return prevAreas;

      // Cascade update logic to localStorage for dependent items
      if (typeof window !== 'undefined') {
        const storedProcesses = localStorage.getItem(LOCAL_STORAGE_PROCESOS_KEY);
        let processes = storedProcesses ? JSON.parse(storedProcesses) : allProcesses;
        processes = processes.map((p: CapturedProcess) => p.area === originalArea.nombre ? { ...p, area: nombre } : p);
        localStorage.setItem(LOCAL_STORAGE_PROCESOS_KEY, JSON.stringify(processes));

        const storedAcciones = localStorage.getItem(LOCAL_STORAGE_ACCIONES_KEY);
        let acciones = storedAcciones ? JSON.parse(storedAcciones) : allAcciones;
        acciones = acciones.map((a: Accion) => a.area === originalArea.nombre ? { ...a, area: nombre } : a);
        localStorage.setItem(LOCAL_STORAGE_ACCIONES_KEY, JSON.stringify(acciones));
      }

      addLogEntry({ action: 'update', entityType: 'Área', entityName: nombre, details: `Se actualizó el área de "${originalArea.nombre}" a "${nombre}", y se reflejó en procesos y acciones.` });
      
      return prevAreas.map((area) => (area.id === id ? { ...area, nombre } : area));
    });
  }, [addLogEntry]);

  const deleteArea = useCallback((id: string, allDepartamentos: Departamento[], allPuestos: Puesto[], allSistemas: Sistema[], allProcesses: CapturedProcess[], allAcciones: Accion[]): boolean => {
    const areaToDelete = areas.find(a => a.id === id);
    if (!areaToDelete) return false;

    // Dependency checks
    if (allDepartamentos.some(d => d.areaId === id)) {
        toast({ title: "Eliminación Bloqueada", description: `El área "${areaToDelete.nombre}" está asignada a uno o más departamentos.`, variant: "destructive"});
        return false;
    }
    if (allPuestos.some(p => p.areaId === id)) {
        toast({ title: "Eliminación Bloqueada", description: `El área "${areaToDelete.nombre}" está asignada a uno o más puestos.`, variant: "destructive"});
        return false;
    }
    if (allSistemas.some(s => s.scope === "Área" && s.scopeId === id)) {
        toast({ title: "Eliminación Bloqueada", description: `El área "${areaToDelete.nombre}" está asignada a uno o más sistemas.`, variant: "destructive"});
        return false;
    }
    if (allProcesses.some(proc => proc.area === areaToDelete.nombre && !proc.deletedAt)) {
        toast({ title: 'Eliminación Bloqueada', description: `El área "${areaToDelete.nombre}" está en uso por uno o más procesos.`, variant: 'destructive'});
        return false;
    }
    if (allAcciones.some(a => a.area === areaToDelete.nombre)) {
        toast({ title: "Eliminación Bloqueada", description: `El área "${areaToDelete.nombre}" está asignada a una o más acciones de mejora.`, variant: "destructive"});
        return false;
    }
    
    // Proceed with deletion
    setAreas(prevAreas => prevAreas.filter(area => area.id !== id));
    addLogEntry({ action: 'delete', entityType: 'Área', entityName: areaToDelete.nombre, details: `Se eliminó el área "${areaToDelete.nombre}".` });
    return true;
  }, [areas, addLogEntry]);

  return (
    <AreasContext.Provider value={{ areas, addArea, updateArea, deleteArea, isLoading }}>
      {children}
    </AreasContext.Provider>
  );
}

export function useAreas(): AreasContextType {
  const context = useContext(AreasContext);
  if (context === undefined) {
    throw new Error('useAreas must be used within an AreasProvider');
  }
  return context;
}
