
'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface Proceso {
  id: string;
  nombre: string;
}

interface ProcesosContextType {
  procesos: Proceso[];
  addProceso: (nombre: string) => void;
  updateProceso: (id: string, nombre: string) => void;
  deleteProceso: (id: string) => void;
  isLoadingProcesos: boolean;
}

const ProcesosContext = createContext<ProcesosContextType | undefined>(undefined);

const LOCAL_STORAGE_PROCESOS_KEY = 'proceza-procesos';

export function ProcesosProvider({ children }: { children: ReactNode }) {
  const [procesos, setProcesos] = useState<Proceso[]>([]);
  const [isLoadingProcesos, setIsLoadingProcesos] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedProcesos = localStorage.getItem(LOCAL_STORAGE_PROCESOS_KEY);
        if (savedProcesos) {
          setProcesos(JSON.parse(savedProcesos));
        }
      } catch (error) {
        console.error("Failed to load procesos from localStorage", error);
        setProcesos([]);
      } finally {
        setIsLoadingProcesos(false);
      }
    } else {
        setIsLoadingProcesos(false); // No localStorage on server
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && !isLoadingProcesos) {
       try {
        localStorage.setItem(LOCAL_STORAGE_PROCESOS_KEY, JSON.stringify(procesos));
      } catch (error) {
        console.error("Failed to save procesos to localStorage", error);
      }
    }
  }, [procesos, isLoadingProcesos]);

  const addProceso = useCallback((nombre: string) => {
    setProcesos((prevProcesos) => [...prevProcesos, { id: Date.now().toString(), nombre }]);
  }, []);

  const updateProceso = useCallback((id: string, nombre: string) => {
    setProcesos((prevProcesos) =>
      prevProcesos.map((proceso) => (proceso.id === id ? { ...proceso, nombre } : proceso))
    );
  }, []);

  const deleteProceso = useCallback((id: string) => {
    setProcesos((prevProcesos) => prevProcesos.filter((proceso) => proceso.id !== id));
  }, []);

  return (
    <ProcesosContext.Provider value={{ procesos, addProceso, updateProceso, deleteProceso, isLoadingProcesos }}>
      {children}
    </ProcesosContext.Provider>
  );
}

export function useProcesos(): ProcesosContextType {
  const context = useContext(ProcesosContext);
  if (context === undefined) {
    throw new Error('useProcesos must be used within a ProcesosProvider');
  }
  return context;
}
