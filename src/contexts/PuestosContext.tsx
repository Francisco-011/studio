
'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useActivityLog } from './ActivityLogContext';

export const nivelesOrganizacionales = ["Directivo", "Gerencial", "Supervisión", "Operativo", "Administrativo"] as const;
export type NivelOrganizacional = typeof nivelesOrganizacionales[number];

export interface Puesto {
  id: string;
  nombre: string;
  areaId: string;
  departamentoId?: string;
  jefeInmediato?: string; 
  nivelOrganizacional: NivelOrganizacional;
  numeroPersonas?: number;
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
  const { addLogEntry } = useActivityLog();

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

  const addPuesto = useCallback((data: PuestoCreationData) => {
    const newPuesto = { ...data, id: Date.now().toString() };
    setPuestos((prevPuestos) => [...prevPuestos, newPuesto]);
    addLogEntry({ action: 'create', entityType: 'Puesto', entityName: data.nombre, details: `Se creó el puesto "${data.nombre}".` });
  }, [addLogEntry]);

  const updatePuesto = useCallback((id: string, data: PuestoCreationData) => {
    const originalPuesto = puestos.find(p => p.id === id);
    setPuestos((prevPuestos) =>
      prevPuestos.map((puesto) => (puesto.id === id ? { ...data, id } : puesto))
    );
     if (originalPuesto) {
      addLogEntry({ action: 'update', entityType: 'Puesto', entityName: data.nombre, details: `Se actualizó el puesto "${originalPuesto.nombre}" a "${data.nombre}".` });
    }
  }, [addLogEntry, puestos]);

  const deletePuesto = useCallback((id: string) => {
    const puestoToDelete = puestos.find(p => p.id === id);
    setPuestos((prevPuestos) => prevPuestos.filter((puesto) => puesto.id !== id));
    if(puestoToDelete) {
        addLogEntry({ action: 'delete', entityType: 'Puesto', entityName: puestoToDelete.nombre, details: `Se eliminó el puesto "${puestoToDelete.nombre}".` });
    }
  }, [addLogEntry, puestos]);

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
