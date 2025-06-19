
'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';

// Define NivelOrganizacional and Puesto interface here for context-wide use
export const nivelesOrganizacionales = ["Directivo", "Gerencial", "Supervisión", "Operativo", "Apoyo"] as const;
export type NivelOrganizacional = typeof nivelesOrganizacionales[number];

export interface Puesto {
  id: string;
  nombre: string;
  areaId?: string;
  jefeInmediato?: string; 
  nivelOrganizacional: NivelOrganizacional;
}

export type PuestoCreationData = Omit<Puesto, 'id'>;

interface PuestosContextType {
  puestos: Puesto[];
  addPuesto: (data: PuestoCreationData) => void;
  updatePuesto: (id: string, data: PuestoCreationData) => void;
  deletePuesto: (id: string) => void;
  isLoadingPuestos: boolean;
}

const PuestosContext = createContext<PuestosContextType | undefined>(undefined);

const LOCAL_STORAGE_PUESTOS_KEY = 'proceza-puestos';

export function PuestosProvider({ children }: { children: ReactNode }) {
  const [puestos, setPuestos] = useState<Puesto[]>([]);
  const [isLoadingPuestos, setIsLoadingPuestos] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedPuestos = localStorage.getItem(LOCAL_STORAGE_PUESTOS_KEY);
        if (savedPuestos) {
          setPuestos(JSON.parse(savedPuestos));
        }
      } catch (error) {
        console.error("Failed to load puestos from localStorage", error);
        setPuestos([]); 
      } finally {
        setIsLoadingPuestos(false);
      }
    } else {
      setIsLoadingPuestos(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && !isLoadingPuestos) {
       try {
        localStorage.setItem(LOCAL_STORAGE_PUESTOS_KEY, JSON.stringify(puestos));
      } catch (error) {
        console.error("Failed to save puestos to localStorage", error);
      }
    }
  }, [puestos, isLoadingPuestos]);

  const addPuesto = useCallback((data: PuestoCreationData) => {
    setPuestos((prevPuestos) => [...prevPuestos, { ...data, id: Date.now().toString() }]);
  }, []);

  const updatePuesto = useCallback((id: string, data: PuestoCreationData) => {
    setPuestos((prevPuestos) =>
      prevPuestos.map((puesto) => (puesto.id === id ? { ...data, id } : puesto))
    );
  }, []);

  const deletePuesto = useCallback((id: string) => {
    setPuestos((prevPuestos) => prevPuestos.filter((puesto) => puesto.id !== id));
  }, []);

  return (
    <PuestosContext.Provider value={{ puestos, addPuesto, updatePuesto, deletePuesto, isLoadingPuestos }}>
      {children}
    </PuestosContext.Provider>
  );
}

export function usePuestos(): PuestosContextType {
  const context = useContext(PuestosContext);
  if (context === undefined) {
    throw new Error('usePuestos must be used within a PuestosProvider');
  }
  return context;
}
