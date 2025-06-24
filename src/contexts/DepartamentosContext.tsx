
'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useActivityLog } from './ActivityLogContext';
import { toast } from '@/hooks/use-toast';
import type { CapturedProcess } from '@/app/(app)/procesos-y-flujos-registrados/page';
import type { Puesto } from './PuestosContext';
import type { Sistema } from './SistemasCostosContext';


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
const LOCAL_STORAGE_PUESTOS_KEY = 'proceza-puestos';
const LOCAL_STORAGE_SISTEMAS_KEY = 'proceza-sistemas';
const LOCAL_STORAGE_PROCESOS_KEY = 'proceza-captured-data';

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
    if (!original || (original.nombre === nombre && original.areaId === areaId)) return;

    setDepartamentos((prev) =>
      prev.map((dep) => (dep.id === id ? { ...dep, nombre, areaId } : dep))
    );

    if (original.nombre !== nombre) {
      const storedProcesses = localStorage.getItem(LOCAL_STORAGE_PROCESOS_KEY);
      if (storedProcesses) {
        let processes: CapturedProcess[] = JSON.parse(storedProcesses);
        processes = processes.map(p => p.departamento === original.nombre ? { ...p, departamento: nombre } : p);
        localStorage.setItem(LOCAL_STORAGE_PROCESOS_KEY, JSON.stringify(processes));
      }
    }

    addLogEntry({ action: 'update', entityType: 'Departamento', entityName: nombre, details: `Se actualizó el departamento de "${original.nombre}" a "${nombre}".` });
    
  }, [addLogEntry, departamentos]);

  const deleteDepartamento = useCallback((id: string) => {
    const toDelete = departamentos.find(d => d.id === id);
    if (!toDelete) return;

    const storedPuestos = localStorage.getItem(LOCAL_STORAGE_PUESTOS_KEY);
    if(storedPuestos){
        const puestos: Puesto[] = JSON.parse(storedPuestos);
        if(puestos.some(p => p.departamentoId === id)){
            toast({ title: "Eliminación Bloqueada", description: `El departamento "${toDelete.nombre}" está asignado a uno o más puestos.`, variant: "destructive"});
            return;
        }
    }
    
    const storedSistemas = localStorage.getItem(LOCAL_STORAGE_SISTEMAS_KEY);
    if(storedSistemas){
        const sistemas: Sistema[] = JSON.parse(storedSistemas);
        if(sistemas.some(s => s.scope === "Departamento" && s.scopeId === id)){
            toast({ title: "Eliminación Bloqueada", description: `El departamento "${toDelete.nombre}" está asignado a uno o más sistemas.`, variant: "destructive"});
            return;
        }
    }
    
    const storedProcesses = localStorage.getItem(LOCAL_STORAGE_PROCESOS_KEY);
    if (storedProcesses) {
        const processes: CapturedProcess[] = JSON.parse(storedProcesses);
        const isDeptoInUseByProcess = processes.some(p => p.departamento === toDelete.nombre && !p.deletedAt);
        if(isDeptoInUseByProcess) {
            toast({
              title: 'Eliminación Bloqueada',
              description: `El departamento "${toDelete.nombre}" no puede ser eliminado porque está en uso por uno o más procesos.`,
              variant: 'destructive',
            });
            return;
        }
    }
    
    setDepartamentos((prev) => prev.filter((dep) => dep.id !== id));
    addLogEntry({ action: 'delete', entityType: 'Departamento', entityName: toDelete.nombre, details: `Se eliminó el departamento "${toDelete.nombre}".` });

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
