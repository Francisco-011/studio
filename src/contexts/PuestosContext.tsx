
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
  updatePuesto: (id: string, data: PuestoCreationData) => void;
  deletePuesto: (id: string) => void;
  isLoadingPuestos: boolean;
}

const PuestosContext = createContext<PuestosContextType | undefined>(undefined);

const LOCAL_STORAGE_PUESTOS_KEY = 'proceza-puestos';
const LOCAL_STORAGE_SISTEMAS_KEY = 'proceza-sistemas';
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

  const addPuesto = useCallback((data: PuestoCreationData) => {
    const newPuesto = { ...data, id: Date.now().toString() };
    setPuestos((prevPuestos) => [...prevPuestos, newPuesto]);
    addLogEntry({ action: 'create', entityType: 'Puesto', entityName: data.nombre, details: `Se creó el puesto "${data.nombre}".` });
  }, [addLogEntry]);

  const updatePuesto = useCallback((id: string, data: PuestoCreationData) => {
    const originalPuesto = puestos.find(p => p.id === id);
    if (!originalPuesto) return;
    
    const hasNameChanged = originalPuesto.nombre !== data.nombre;

    setPuestos((prevPuestos) =>
      prevPuestos.map((puesto) => (puesto.id === id ? { ...data, id } : puesto))
    );

    if(hasNameChanged) {
        // Cascade update to processes
        const storedProcesses = localStorage.getItem(LOCAL_STORAGE_PROCESOS_KEY);
        if (storedProcesses) {
            let processes: CapturedProcess[] = JSON.parse(storedProcesses);
            processes = processes.map(p => p.puesto === originalPuesto.nombre ? { ...p, puesto: data.nombre } : p);
            localStorage.setItem(LOCAL_STORAGE_PROCESOS_KEY, JSON.stringify(processes));
        }
        // Cascade update to actions
        const storedAcciones = localStorage.getItem(LOCAL_STORAGE_ACCIONES_KEY);
        if (storedAcciones) {
            let acciones: Accion[] = JSON.parse(storedAcciones);
            acciones = acciones.map(a => a.puesto === originalPuesto.nombre ? { ...a, puesto: data.nombre } : a);
            localStorage.setItem(LOCAL_STORAGE_ACCIONES_KEY, JSON.stringify(acciones));
        }
    }
     
    addLogEntry({ action: 'update', entityType: 'Puesto', entityName: data.nombre, details: `Se actualizó el puesto "${originalPuesto.nombre}" a "${data.nombre}".` });
    
  }, [addLogEntry, puestos]);

  const deletePuesto = useCallback((id: string) => {
    const puestoToDelete = puestos.find(p => p.id === id);
    if(!puestoToDelete) return;

    // 1. Check dependency in other puestos (jefeInmediato)
    if (puestos.some(p => p.jefeInmediato === id)) {
        toast({ title: 'Eliminación Bloqueada', description: `El puesto "${puestoToDelete.nombre}" es Jefe Inmediato de otro puesto.`, variant: 'destructive'});
        return;
    }

    // 2. Check dependency in sistemas
    const storedSistemas = localStorage.getItem(LOCAL_STORAGE_SISTEMAS_KEY);
    if(storedSistemas){
      const sistemas: Sistema[] = JSON.parse(storedSistemas);
      if(sistemas.some(s => s.scope === "Puesto" && s.scopeId === id)){
        toast({ title: "Eliminación Bloqueada", description: `El puesto "${puestoToDelete.nombre}" está asignado a uno o más sistemas.`, variant: "destructive"});
        return;
      }
    }

    // 3. Check dependency in processes
    const storedProcesses = localStorage.getItem(LOCAL_STORAGE_PROCESOS_KEY);
    if (storedProcesses) {
      const processes: CapturedProcess[] = JSON.parse(storedProcesses);
      if (processes.some(proc => proc.puesto === puestoToDelete.nombre && !proc.deletedAt)) {
        toast({ title: 'Eliminación Bloqueada', description: `El puesto "${puestoToDelete.nombre}" está en uso por uno o más procesos.`, variant: 'destructive'});
        return;
      }
    }

    // 4. Check dependency in acciones
    const storedAcciones = localStorage.getItem(LOCAL_STORAGE_ACCIONES_KEY);
    if(storedAcciones){
      const acciones: Accion[] = JSON.parse(storedAcciones);
      if(acciones.some(a => a.puesto === puestoToDelete.nombre)){
        toast({ title: "Eliminación Bloqueada", description: `El puesto "${puestoToDelete.nombre}" está asignado a una o más acciones de mejora.`, variant: "destructive"});
        return;
      }
    }

    // If all checks pass, proceed with deletion
    setPuestos((prevPuestos) => prevPuestos.filter((puesto) => puesto.id !== id));
    addLogEntry({ action: 'delete', entityType: 'Puesto', entityName: puestoToDelete.nombre, details: `Se eliminó el puesto "${puestoToDelete.nombre}".` });

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
