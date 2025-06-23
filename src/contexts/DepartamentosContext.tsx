'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useActivityLog } from './ActivityLogContext';

export interface Departamento {
  id: string;
  nombre: string;
  areaId: string;
}

interface DepartamentosContextType {
  departamentos: Departamento[];
  addDepartamento: (nombre: string, areaId: string) => void;
  updateDepartamento: (id: string, nombre: string, areaId: string) => void;
  deleteDepartamento: (id: string) => void;
  isLoading: boolean;
}

const DepartamentosContext = createContext<DepartamentosContextType | undefined>(undefined);

const LOCAL_STORAGE_DEPARTAMENTOS_KEY = 'proceza-departamentos';

export function DepartamentosProvider({ children }: { children: ReactNode }) {
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { addLogEntry } = useActivityLog();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedData = localStorage.getItem(LOCAL_STORAGE_DEPARTAMENTOS_KEY);
        if (savedData) {
          setDepartamentos(JSON.parse(savedData));
        }
      } catch (error) {
        console.error("Failed to load departamentos from localStorage", error);
        setDepartamentos([]);
      } finally {
        setIsLoading(false);
      }
    } else {
        setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && !isLoading) {
       try {
        localStorage.setItem(LOCAL_STORAGE_DEPARTAMENTOS_KEY, JSON.stringify(departamentos));
      } catch (error) {
        console.error("Failed to save departamentos to localStorage", error);
      }
    }
  }, [departamentos, isLoading]);

  const addDepartamento = useCallback((nombre: string, areaId: string) => {
    const newDepartamento = { id: Date.now().toString(), nombre, areaId };
    setDepartamentos((prev) => [...prev, newDepartamento]);
    addLogEntry({ action: 'create', entityType: 'Departamento', entityName: nombre, details: `Se creó el departamento "${nombre}".` });
  }, [addLogEntry]);

  const updateDepartamento = useCallback((id: string, nombre: string, areaId: string) => {
    const original = departamentos.find(d => d.id === id);
    setDepartamentos((prev) =>
      prev.map((dep) => (dep.id === id ? { ...dep, nombre, areaId } : dep))
    );
    if(original) {
      addLogEntry({ action: 'update', entityType: 'Departamento', entityName: nombre, details: `Se actualizó el departamento de "${original.nombre}" a "${nombre}".` });
    }
  }, [addLogEntry, departamentos]);

  const deleteDepartamento = useCallback((id: string) => {
    const toDelete = departamentos.find(d => d.id === id);
    setDepartamentos((prev) => prev.filter((dep) => dep.id !== id));
    if (toDelete) {
       addLogEntry({ action: 'delete', entityType: 'Departamento', entityName: toDelete.nombre, details: `Se eliminó el departamento "${toDelete.nombre}".` });
    }
  }, [addLogEntry, departamentos]);

  return (
    <DepartamentosContext.Provider value={{ departamentos, addDepartamento, updateDepartamento, deleteDepartamento, isLoading }}>
      {children}
    </DepartamentosContext.Provider>
  );
}

export function useDepartamentos(): DepartamentosContextType {
  const context = useContext(DepartamentosContext);
  if (context === undefined) {
    throw new Error('useDepartamentos must be used within a DepartamentosProvider');
  }
  return context;
}
