
'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface Actividad {
  id: string;
  nombre: string;
  activa: boolean;
  procesosAsociadosCount: number;
  procesosAsociadosIds?: string[];
  createdAt: number; // Timestamp of creation
  updatedAt?: number;
  deletedAt?: number;

  // New fields for detailed capture
  descripcionBreve?: string;
  sistemaUtilizado?: string;
  tiempoEstimadoActividad?: number; // in minutes
  frecuenciaActividad?: string; 
}

interface ActividadesContextType {
  actividades: Actividad[];
  deletedActividades: Actividad[];
  addActividad: (data: Omit<Actividad, 'id' | 'createdAt' | 'updatedAt' | 'procesosAsociadosCount'> & { procesosAsociadosIds?: string[] }) => Actividad;
  updateActividad: (id: string, data: Partial<Omit<Actividad, 'id' | 'createdAt' | 'updatedAt'>>) => void;
  softDeleteActividad: (id: string) => void;
  restoreActividad: (id: string) => void;
  toggleActividadStatus: (id: string) => void;
  isLoadingActividades: boolean;
}

const ActividadesContext = createContext<ActividadesContextType | undefined>(undefined);

const LOCAL_STORAGE_ACTIVIDADES_KEY = 'proceza-actividades';
const LOCAL_STORAGE_DELETED_ACTIVIDADES_KEY = 'proceza-deleted-actividades';

export function ActividadesProvider({ children }: { children: ReactNode }) {
  const [actividades, setActividades] = useState<Actividad[]>([]);
  const [deletedActividades, setDeletedActividades] = useState<Actividad[]>([]);
  const [isLoadingActividades, setIsLoadingActividades] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedActividades = localStorage.getItem(LOCAL_STORAGE_ACTIVIDADES_KEY);
        if (savedActividades) {
          const parsedActividades = JSON.parse(savedActividades) as Actividad[];
          // Ensure createdAt exists for older data, can default to id if it's a timestamp, or updatedAt
          setActividades(parsedActividades.map(act => ({
            ...act,
            createdAt: act.createdAt || act.updatedAt || parseInt(act.id, 10) || Date.now() 
          })));
        }
        const savedDeletedActividades = localStorage.getItem(LOCAL_STORAGE_DELETED_ACTIVIDADES_KEY);
        if (savedDeletedActividades) {
          const parsedDeleted = JSON.parse(savedDeletedActividades) as Actividad[];
           setDeletedActividades(parsedDeleted.map(act => ({
            ...act,
            createdAt: act.createdAt || act.updatedAt || parseInt(act.id, 10) || Date.now()
          })));
        }
      } catch (error) {
        console.error("Failed to load actividades from localStorage", error);
        setActividades([]);
        setDeletedActividades([]);
      } finally {
        setIsLoadingActividades(false);
      }
    } else {
      setIsLoadingActividades(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && !isLoadingActividades) {
      try {
        localStorage.setItem(LOCAL_STORAGE_ACTIVIDADES_KEY, JSON.stringify(actividades));
        localStorage.setItem(LOCAL_STORAGE_DELETED_ACTIVIDADES_KEY, JSON.stringify(deletedActividades));
      } catch (error) {
        console.error("Failed to save actividades to localStorage", error);
      }
    }
  }, [actividades, deletedActividades, isLoadingActividades]);

  const addActividad = useCallback((data: Omit<Actividad, 'id' | 'createdAt' | 'updatedAt' | 'procesosAsociadosCount'> & { procesosAsociadosIds?: string[] }): Actividad => {
    const currentTime = Date.now();
    const newActividad: Actividad = {
      ...data,
      id: currentTime.toString(), // Simple ID generation, can be improved
      createdAt: currentTime,
      procesosAsociadosCount: data.procesosAsociadosIds?.length || 0,
      updatedAt: currentTime,
      activa: data.activa === undefined ? true : data.activa, // Default to active if not specified
    };
    setActividades((prev) => [...prev, newActividad]);
    return newActividad;
  }, []);

  const updateActividad = useCallback((id: string, data: Partial<Omit<Actividad, 'id' | 'createdAt' | 'updatedAt'>>) => {
    setActividades((prev) =>
      prev.map((act) =>
        act.id === id ? { 
          ...act, 
          ...data, 
          procesosAsociadosCount: data.procesosAsociadosIds?.length ?? act.procesosAsociadosCount, 
          updatedAt: Date.now() 
        } : act
      )
    );
  }, []);

  const softDeleteActividad = useCallback((id: string) => {
    const activityToMove = actividades.find(act => act.id === id);
    if (activityToMove) {
      const currentTime = Date.now();
      setDeletedActividades(prev => [...prev, { ...activityToMove, deletedAt: currentTime, updatedAt: currentTime }]);
      setActividades(prev => prev.filter(act => act.id !== id));
    }
  }, [actividades]);

  const restoreActividad = useCallback((id: string) => {
    const activityToRestore = deletedActividades.find(act => act.id === id);
    if (activityToRestore) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { deletedAt, ...restoredActivityBase } = activityToRestore;
      const restoredActivity = { ...restoredActivityBase, activa: true, updatedAt: Date.now() };
      setActividades(prev => [...prev, restoredActivity]);
      setDeletedActividades(prev => prev.filter(act => act.id !== id));
    }
  }, [deletedActividades]);

  const toggleActividadStatus = useCallback((id: string) => {
    setActividades((prev) =>
      prev.map((act) =>
        act.id === id ? { ...act, activa: !act.activa, updatedAt: Date.now() } : act
      )
    );
  }, []);


  return (
    <ActividadesContext.Provider value={{ 
      actividades, 
      deletedActividades, 
      addActividad, 
      updateActividad, 
      softDeleteActividad, 
      restoreActividad, 
      toggleActividadStatus, 
      isLoadingActividades 
    }}>
      {children}
    </ActividadesContext.Provider>
  );
}

export function useActividades(): ActividadesContextType {
  const context = useContext(ActividadesContext);
  if (context === undefined) {
    throw new Error('useActividades must be used within an ActividadesProvider');
  }
  return context;
}
