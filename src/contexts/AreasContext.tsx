
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
  updateArea: (id: string, nombre: string) => void;
  deleteArea: (id: string) => void;
  isLoading: boolean;
}

const AreasContext = createContext<AreasContextType | undefined>(undefined);

const LOCAL_STORAGE_AREAS_KEY = 'proceza-areas';
const LOCAL_STORAGE_DEPARTAMENTOS_KEY = 'proceza-departamentos';
const LOCAL_STORAGE_PUESTOS_KEY = 'proceza-puestos';
const LOCAL_STORAGE_SISTEMAS_KEY = 'proceza-sistemas';
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

  const updateArea = useCallback((id: string, nombre: string) => {
    setAreas((prevAreas) => {
      const originalArea = prevAreas.find(a => a.id === id);
      if (!originalArea || originalArea.nombre === nombre) return prevAreas;

      // Cascade update logic inside the state update to ensure consistency
      const storedProcesses = localStorage.getItem(LOCAL_STORAGE_PROCESOS_KEY);
      if (storedProcesses) {
        let processes: CapturedProcess[] = JSON.parse(storedProcesses);
        processes = processes.map(p => p.area === originalArea.nombre ? { ...p, area: nombre } : p);
        localStorage.setItem(LOCAL_STORAGE_PROCESOS_KEY, JSON.stringify(processes));
      }

      const storedAcciones = localStorage.getItem(LOCAL_STORAGE_ACCIONES_KEY);
      if (storedAcciones) {
        let acciones: Accion[] = JSON.parse(storedAcciones);
        acciones = acciones.map(a => a.area === originalArea.nombre ? { ...a, area: nombre } : a);
        localStorage.setItem(LOCAL_STORAGE_ACCIONES_KEY, JSON.stringify(acciones));
      }

      addLogEntry({ action: 'update', entityType: 'Área', entityName: nombre, details: `Se actualizó el área de "${originalArea.nombre}" a "${nombre}", y se reflejó en procesos y acciones.` });
      
      return prevAreas.map((area) => (area.id === id ? { ...area, nombre } : area));
    });
  }, [addLogEntry]);

  const deleteArea = useCallback((id: string) => {
    setAreas((prevAreas) => {
      const areaToDelete = prevAreas.find(a => a.id === id);
      if (!areaToDelete) return prevAreas;

      // Dependency checks using the latest state from prevAreas
      const storedDepartamentos = localStorage.getItem(LOCAL_STORAGE_DEPARTAMENTOS_KEY);
      if(storedDepartamentos){
        const departamentos: Departamento[] = JSON.parse(storedDepartamentos);
        if(departamentos.some(d => d.areaId === id)){
          toast({ title: "Eliminación Bloqueada", description: `El área "${areaToDelete.nombre}" está asignada a uno o más departamentos.`, variant: "destructive"});
          return prevAreas;
        }
      }

      const storedPuestos = localStorage.getItem(LOCAL_STORAGE_PUESTOS_KEY);
      if(storedPuestos){
          const puestos: Puesto[] = JSON.parse(storedPuestos);
          if(puestos.some(p => p.areaId === id)){
              toast({ title: "Eliminación Bloqueada", description: `El área "${areaToDelete.nombre}" está asignada a uno o más puestos.`, variant: "destructive"});
              return prevAreas;
          }
      }
      
      const storedSistemas = localStorage.getItem(LOCAL_STORAGE_SISTEMAS_KEY);
      if(storedSistemas){
        const sistemas: Sistema[] = JSON.parse(storedSistemas);
        if(sistemas.some(s => s.scope === "Área" && s.scopeId === id)){
          toast({ title: "Eliminación Bloqueada", description: `El área "${areaToDelete.nombre}" está asignada a uno o más sistemas.`, variant: "destructive"});
          return prevAreas;
        }
      }
      
      const storedProcesses = localStorage.getItem(LOCAL_STORAGE_PROCESOS_KEY);
      if (storedProcesses) {
        const processes: CapturedProcess[] = JSON.parse(storedProcesses);
        const isAreaInUseByProcess = processes.some(proc => proc.area === areaToDelete.nombre && !proc.deletedAt);
        if (isAreaInUseByProcess) {
          toast({ title: 'Eliminación Bloqueada', description: `El área "${areaToDelete.nombre}" no puede ser eliminada porque está en uso por uno o más procesos.`, variant: 'destructive'});
          return prevAreas;
        }
      }
      
      const storedAcciones = localStorage.getItem(LOCAL_STORAGE_ACCIONES_KEY);
      if(storedAcciones){
        const acciones: Accion[] = JSON.parse(storedAcciones);
        if(acciones.some(a => a.area === areaToDelete.nombre)){
          toast({ title: "Eliminación Bloqueada", description: `El área "${areaToDelete.nombre}" está asignada a una o más acciones de mejora.`, variant: "destructive"});
          return prevAreas;
        }
      }

      addLogEntry({ action: 'delete', entityType: 'Área', entityName: areaToDelete.nombre, details: `Se eliminó el área "${areaToDelete.nombre}".` });
      return prevAreas.filter((area) => area.id !== id);
    });
  }, [addLogEntry]);

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
