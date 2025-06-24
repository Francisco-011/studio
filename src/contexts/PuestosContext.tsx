
'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useActivityLog } from './ActivityLogContext';
import { toast } from '@/hooks/use-toast';
import type { CapturedProcess } from '@/app/(app)/procesos-y-flujos-registrados/page';
import type { Accion } from './AccionesContext';
import type { Sistema } from './SistemasCostosContext';

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
  updatePuesto: (id: string, data: PuestoCreationData, allProcesses: CapturedProcess[], allAcciones: Accion[]) => void;
  deletePuesto: (id: string, allPuestos: Puesto[], allSistemas: Sistema[], allProcesses: CapturedProcess[], allAcciones: Accion[]) => boolean;
  isLoadingPuestos: boolean;
}

const PuestosContext = createContext<PuestosContextType | undefined>(undefined);

const LOCAL_STORAGE_PUESTOS_KEY = 'proceza-puestos';
const LOCAL_STORAGE_PROCESOS_KEY = 'proceza-captured-data';
const LOCAL_STORAGE_ACCIONES_KEY = 'proceza-acciones';

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
    const newPuesto = { ...data, id: Date.now().toString() };
    setPuestos((prevPuestos) => [...prevPuestos, newPuesto]);
    addLogEntry({ action: 'create', entityType: 'Puesto', entityName: data.nombre, details: `Se creó el puesto "${data.nombre}".` });
  }, [addLogEntry]);

  const updatePuesto = useCallback((id: string, data: PuestoCreationData, allProcesses: CapturedProcess[], allAcciones: Accion[]) => {
    setPuestos((prevPuestos) => {
      const originalPuesto = prevPuestos.find(p => p.id === id);
      if (!originalPuesto) return prevPuestos;
      
      const hasNameChanged = originalPuesto.nombre !== data.nombre;

      if(hasNameChanged && typeof window !== 'undefined') {
          // Cascade update to processes
          const storedProcesses = localStorage.getItem(LOCAL_STORAGE_PROCESOS_KEY);
          let processes: CapturedProcess[] = storedProcesses ? JSON.parse(storedProcesses) : allProcesses;
          processes = processes.map(p => p.puesto === originalPuesto.nombre ? { ...p, puesto: data.nombre } : p);
          localStorage.setItem(LOCAL_STORAGE_PROCESOS_KEY, JSON.stringify(processes));
          
          // Cascade update to actions
          const storedAcciones = localStorage.getItem(LOCAL_STORAGE_ACCIONES_KEY);
          let acciones: Accion[] = storedAcciones ? JSON.parse(storedAcciones) : allAcciones;
          acciones = acciones.map(a => a.puesto === originalPuesto.nombre ? { ...a, puesto: data.nombre } : a);
          localStorage.setItem(LOCAL_STORAGE_ACCIONES_KEY, JSON.stringify(acciones));
      }
       
      addLogEntry({ action: 'update', entityType: 'Puesto', entityName: data.nombre, details: `Se actualizó el puesto "${originalPuesto.nombre}" a "${data.nombre}".` });
      
      return prevPuestos.map((puesto) => (puesto.id === id ? { ...data, id } : puesto));
    });
  }, [addLogEntry]);

  const deletePuesto = useCallback((id: string, allPuestos: Puesto[], allSistemas: Sistema[], allProcesses: CapturedProcess[], allAcciones: Accion[]): boolean => {
    const puestoToDelete = puestos.find(p => p.id === id);
    if(!puestoToDelete) return false;

    // Dependency checks
    if (allPuestos.some(p => p.jefeInmediato === id)) {
        toast({ title: 'Eliminación Bloqueada', description: `El puesto "${puestoToDelete.nombre}" es Jefe Inmediato de otro puesto.`, variant: 'destructive'});
        return false;
    }
    if (allSistemas.some(s => s.scope === "Puesto" && s.scopeId === id)) {
        toast({ title: "Eliminación Bloqueada", description: `El puesto "${puestoToDelete.nombre}" está asignado a uno o más sistemas.`, variant: "destructive"});
        return false;
    }
    if (allProcesses.some(proc => proc.puesto === puestoToDelete.nombre && !proc.deletedAt)) {
        toast({ title: 'Eliminación Bloqueada', description: `El puesto "${puestoToDelete.nombre}" está en uso por uno o más procesos.`, variant: 'destructive'});
        return false;
    }
    if (allAcciones.some(a => a.puesto === puestoToDelete.nombre)) {
        toast({ title: "Eliminación Bloqueada", description: `El puesto "${puestoToDelete.nombre}" está asignado a una o más acciones de mejora.`, variant: "destructive"});
        return false;
    }

    // Proceed with deletion
    setPuestos(prevPuestos => prevPuestos.filter((puesto) => puesto.id !== id));
    addLogEntry({ action: 'delete', entityType: 'Puesto', entityName: puestoToDelete.nombre, details: `Se eliminó el puesto "${puestoToDelete.nombre}".` });
    return true;
  }, [puestos, addLogEntry]);

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
