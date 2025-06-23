
'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useActivityLog } from './ActivityLogContext';

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
    setAreas((prevAreas) =>
      prevAreas.map((area) => (area.id === id ? { ...area, nombre } : area))
    );
    if(originalArea) {
      addLogEntry({ action: 'update', entityType: 'Área', entityName: nombre, details: `Se actualizó el área de "${originalArea.nombre}" a "${nombre}".` });
    }
  }, [addLogEntry, areas]);

  const deleteArea = useCallback((id: string) => {
    const areaToDelete = areas.find(a => a.id === id);
    setAreas((prevAreas) => prevAreas.filter((area) => area.id !== id));
    if (areaToDelete) {
       addLogEntry({ action: 'delete', entityType: 'Área', entityName: areaToDelete.nombre, details: `Se eliminó el área "${areaToDelete.nombre}".` });
    }
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
