
'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';

export const accionEstados = ["Pendiente", "En Progreso", "Completada", "Cancelada", "En Revisión"] as const;
export type AccionEstado = typeof accionEstados[number];

export const monedaOptions = ["USD", "MXN", "EUR", "CAD", "GBP"] as const;
export type Moneda = typeof monedaOptions[number];

export interface Accion {
  id: string;
  nombre: string;
  descripcion: string;
  responsable: string;
  estado: AccionEstado;
  fechaCreacion: string; // ISO string
  fechaObjetivo?: string; // ISO string
  fechaFinalizacion?: string; // ISO string
  ahorroEstimado?: number;
  monedaAhorro?: Moneda;
  origenMejora?: string;
  updatedAt: number; // timestamp
}

interface AccionesContextType {
  acciones: Accion[];
  addAccion: (data: Omit<Accion, 'id' | 'fechaCreacion' | 'updatedAt'>) => void;
  updateAccion: (id: string, data: Partial<Omit<Accion, 'id' | 'fechaCreacion' | 'updatedAt'>>) => void;
  deleteAccion: (id: string) => void;
  isLoadingAcciones: boolean;
}

const AccionesContext = createContext<AccionesContextType | undefined>(undefined);

const LOCAL_STORAGE_ACCIONES_KEY = 'proceza-acciones';

export function AccionesProvider({ children }: { children: ReactNode }) {
  const [acciones, setAcciones] = useState<Accion[]>([]);
  const [isLoadingAcciones, setIsLoadingAcciones] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedAcciones = localStorage.getItem(LOCAL_STORAGE_ACCIONES_KEY);
        if (savedAcciones) {
          setAcciones(JSON.parse(savedAcciones));
        }
      } catch (error) {
        console.error("Failed to load acciones from localStorage", error);
        toast({ title: "Error al cargar acciones", description: "No se pudieron cargar las acciones.", variant: "destructive" });
        setAcciones([]);
      } finally {
        setIsLoadingAcciones(false);
      }
    } else {
      setIsLoadingAcciones(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && !isLoadingAcciones) {
      try {
        localStorage.setItem(LOCAL_STORAGE_ACCIONES_KEY, JSON.stringify(acciones));
      } catch (error) {
        console.error("Failed to save acciones to localStorage", error);
        toast({ title: "Error al guardar acciones", description: "No se pudieron guardar los cambios en las acciones.", variant: "destructive" });
      }
    }
  }, [acciones, isLoadingAcciones]);

  const addAccion = useCallback((data: Omit<Accion, 'id' | 'fechaCreacion' | 'updatedAt'>) => {
    const newAccion: Accion = {
      ...data,
      id: Date.now().toString(),
      fechaCreacion: new Date().toISOString(),
      updatedAt: Date.now(),
    };
    setAcciones((prev) => [...prev, newAccion]);
  }, []);

  const updateAccion = useCallback((id: string, data: Partial<Omit<Accion, 'id' | 'fechaCreacion' | 'updatedAt'>>) => {
    setAcciones((prev) =>
      prev.map((accion) =>
        accion.id === id ? { ...accion, ...data, updatedAt: Date.now() } : accion
      )
    );
  }, []);

  const deleteAccion = useCallback((id: string) => {
    setAcciones((prev) => prev.filter((accion) => accion.id !== id));
  }, []);

  return (
    <AccionesContext.Provider value={{
      acciones,
      addAccion,
      updateAccion,
      deleteAccion,
      isLoadingAcciones
    }}>
      {children}
    </AccionesContext.Provider>
  );
}

export function useAcciones(): AccionesContextType {
  const context = useContext(AccionesContext);
  if (context === undefined) {
    throw new Error('useAcciones must be used within an AccionesProvider');
  }
  return context;
}
