
'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useActivityLog } from './ActivityLogContext';
import { toast } from '@/hooks/use-toast';
import type { CapturedProcess } from '@/app/(app)/procesos-y-flujos-registrados/page';
import type { Accion } from './AccionesContext';

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
    const originalArea = areas.find(a => a.id === id);
    if (!originalArea || originalArea.nombre === nombre) return;

    setAreas((prevAreas) =>
      prevAreas.map((area) => (area.id === id ? { ...area, nombre } : area))
    );
    
    // Cascade update to processes
    const storedProcesses = localStorage.getItem(LOCAL_STORAGE_PROCESOS_KEY);
    if (storedProcesses) {
      let processes: CapturedProcess[] = JSON.parse(storedProcesses);
      processes = processes.map(p => p.area === originalArea.nombre ? { ...p, area: nombre } : p);
      localStorage.setItem(LOCAL_STORAGE_PROCESOS_KEY, JSON.stringify(processes));
    }

    // Cascade update to actions
    const storedAcciones = localStorage.getItem(LOCAL_STORAGE_ACCIONES_KEY);
    if (storedAcciones) {
      let acciones: Accion[] = JSON.parse(storedAcciones);
      acciones = acciones.map(a => a.area === originalArea.nombre ? { ...a, area: nombre } : a);
      localStorage.setItem(LOCAL_STORAGE_ACCIONES_KEY, JSON.stringify(acciones));
    }
    
    addLogEntry({ action: 'update', entityType: 'Área', entityName: nombre, details: `Se actualizó el área de "${originalArea.nombre}" a "${nombre}", y se reflejó en procesos y acciones.` });
    
  }, [addLogEntry, areas]);

  const deleteArea = useCallback((id: string) => {
    const areaToDelete = areas.find(a => a.id === id);
    if (!areaToDelete) return;

    const storedProcesses = localStorage.getItem(LOCAL_STORAGE_PROCESOS_KEY);
    if (storedProcesses) {
      const processes: CapturedProcess[] = JSON.parse(storedProcesses);
      const isAreaInUseByProcess = processes.some(proc => proc.area === areaToDelete.nombre && !proc.deletedAt);
      if (isAreaInUseByProcess) {
        toast({
          title: 'Eliminación Bloqueada',
          description: `El área "${areaToDelete.nombre}" no puede ser eliminada porque está en uso por uno o más procesos.`,
          variant: 'destructive',
        });
        return;
      }
    }

    setAreas((prevAreas) => prevAreas.filter((area) => area.id !== id));
    addLogEntry({ action: 'delete', entityType: 'Área', entityName: areaToDelete.nombre, details: `Se eliminó el área "${areaToDelete.nombre}".` });

  }, [addLogEntry, areas]);

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
