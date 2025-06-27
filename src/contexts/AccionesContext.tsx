
'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';
import type { CapturedProcess } from '@/app/(app)/procesos-y-flujos-registrados/page';
import { useActivityLog } from './ActivityLogContext';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, Timestamp } from 'firebase/firestore';


export const accionEstados = ["Pendiente", "En Progreso", "Completada", "Cancelada", "En Revisión"] as const;
export type AccionEstado = typeof accionEstados[number];

export const monedaOptions = ["USD", "MXN", "EUR", "CAD", "GBP"] as const;
export type Moneda = typeof monedaOptions[number];

export const tiempoUnidadOptions = ["Minutos/Instancia", "Minutos/Día", "Horas/Día", "Horas/Semana", "Horas/Mes"] as const;
export type TiempoUnidad = typeof tiempoUnidadOptions[number];

export interface CambioHistorial {
  timestamp: string;
  field: string;
  before: any;
  after: any;
}


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
  ahorroTiempoEstimado?: number;
  unidadTiempoAhorro?: TiempoUnidad;
  origenMejora?: string;
  area?: string;
  puesto?: string;
  procesoId?: string;
  actividadId?: string;
  updatedAt: number; // timestamp
  historialDeCambios?: CambioHistorial[];
}

interface AccionesContextType {
  acciones: Accion[];
  addAccion: (data: Omit<Accion, 'id' | 'fechaCreacion' | 'updatedAt'>) => Promise<void>;
  updateAccion: (id: string, data: Partial<Omit<Accion, 'id' | 'fechaCreacion' | 'updatedAt'>>, options?: { applyTimeSaving?: boolean; applyCostSaving?: boolean }) => Promise<void>;
  deleteAccion: (id: string) => Promise<void>;
  isLoadingAcciones: boolean;
}

const AccionesContext = createContext<AccionesContextType | undefined>(undefined);

const ACCIONES_COLLECTION = 'acciones';
const LOCAL_STORAGE_PROCESOS_KEY = 'proceza-captured-data'; // This will remain for now

export function AccionesProvider({ children }: { children: ReactNode }) {
  const [acciones, setAcciones] = useState<Accion[]>([]);
  const [isLoadingAcciones, setIsLoadingAcciones] = useState(true);
  const { addLogEntry } = useActivityLog();

  useEffect(() => {
    const q = query(collection(db, ACCIONES_COLLECTION), orderBy("fechaCreacion", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const actionsData = snapshot.docs.map(doc => {
            const data = doc.data();
            const fechaCreacionData = data.fechaCreacion as Timestamp;
            const updatedAtData = data.updatedAt as Timestamp;
            
            return {
                id: doc.id,
                ...data,
                fechaCreacion: fechaCreacionData?.toDate().toISOString() || new Date().toISOString(),
                updatedAt: updatedAtData?.toMillis() || Date.now(),
            } as Accion;
        });
        setAcciones(actionsData);
        setIsLoadingAcciones(false);
    }, (error) => {
        console.error("Error fetching acciones: ", error);
        toast({ title: "Error de Red", description: "No se pudieron cargar las acciones de mejora.", variant: "destructive" });
        setIsLoadingAcciones(false);
    });

    return () => unsubscribe();
  }, []);

  const addAccion = useCallback(async (data: Omit<Accion, 'id' | 'fechaCreacion' | 'updatedAt'>) => {
    try {
        await addDoc(collection(db, ACCIONES_COLLECTION), {
          ...data,
          fechaCreacion: serverTimestamp(),
          updatedAt: serverTimestamp(),
          historialDeCambios: [],
        });
        addLogEntry({ action: 'create', entityType: 'Acción de Mejora', entityName: data.nombre, details: `Se creó la acción de mejora "${data.nombre}".` });
    } catch(e) {
        console.error("Error adding accion:", e);
        toast({ title: "Error", description: "No se pudo agregar la acción de mejora.", variant: "destructive"});
    }
  }, [addLogEntry]);

  const updateAccion = useCallback(async (id: string, data: Partial<Omit<Accion, 'id' | 'fechaCreacion' | 'updatedAt'>>, options?: { applyTimeSaving?: boolean; applyCostSaving?: boolean }) => {
    const originalAccion = acciones.find(a => a.id === id);
    if (!originalAccion) {
      toast({ title: "Error", description: "No se pudo encontrar la acción a actualizar.", variant: "destructive" });
      return;
    }

    const accionDocRef = doc(db, ACCIONES_COLLECTION, id);
    const dataToUpdate: any = { ...data, updatedAt: serverTimestamp() };
    
    addLogEntry({ action: 'update', entityType: 'Acción de Mejora', entityName: data.nombre || originalAccion.nombre, details: `Se actualizó la acción "${originalAccion.nombre}".` });

    if (data.estado === 'Completada' && originalAccion.estado !== 'Completada') {
      const cambios: CambioHistorial[] = [];
      
      try {
        const timeSavingInMinutes = (options?.applyTimeSaving && data.ahorroTiempoEstimado && data.unidadTiempoAhorro === 'Minutos/Instancia')
          ? data.ahorroTiempoEstimado
          : 0;

        const costSaving = (options?.applyCostSaving && data.ahorroEstimado !== undefined)
          ? data.ahorroEstimado
          : 0;

        if (data.procesoId && (timeSavingInMinutes > 0 || costSaving > 0)) {
          const storedProcesses = localStorage.getItem(LOCAL_STORAGE_PROCESOS_KEY);
          let allProcesses: CapturedProcess[] = storedProcesses ? JSON.parse(storedProcesses) : [];
          const processIndex = allProcesses.findIndex(p => p.id === data.procesoId);

          if (processIndex !== -1) {
            const targetProcess = {...allProcesses[processIndex]};
            let processWasUpdated = false;
            
            if (timeSavingInMinutes > 0 && targetProcess.tiempoEstimado !== undefined) {
              const antes = targetProcess.tiempoEstimado;
              const despues = Math.max(0, antes - timeSavingInMinutes);
              cambios.push({ timestamp: new Date().toISOString(), field: 'Tiempo Estimado Proceso', before: antes, after: despues });
              targetProcess.tiempoEstimado = despues;
              processWasUpdated = true;
            }
            if (costSaving > 0 && targetProcess.costoEstimado !== undefined) {
              const antes = targetProcess.costoEstimado;
              const despues = Math.max(0, antes - costSaving);
              cambios.push({ timestamp: new Date().toISOString(), field: 'Costo Estimado Proceso', before: antes, after: despues });
              targetProcess.costoEstimado = despues;
              processWasUpdated = true;
            }
            
            if(processWasUpdated) {
              targetProcess.updatedAt = Date.now();
              allProcesses[processIndex] = targetProcess;
              localStorage.setItem(LOCAL_STORAGE_PROCESOS_KEY, JSON.stringify(allProcesses));
            }
          }
        }

        if(data.unidadTiempoAhorro && data.unidadTiempoAhorro !== 'Minutos/Instancia' && options?.applyTimeSaving){
          toast({
              title: "Mejora de tiempo no aplicada",
              description: `La unidad (${data.unidadTiempoAhorro}) no es 'por instancia' y no se pudo aplicar.`,
              variant: "default",
              duration: 7000
          });
        }

        dataToUpdate.historialDeCambios = [...(originalAccion.historialDeCambios || []), ...cambios];
        
        if(cambios.length > 0) {
          toast({
            title: "Mejora Aplicada",
            description: `Se aplicaron ${cambios.length} cambio(s) al elemento asociado.`,
          });
           addLogEntry({ action: 'update', entityType: 'Acción de Mejora', entityName: originalAccion.nombre, details: `Se completó la acción "${originalAccion.nombre}" y se aplicaron mejoras automáticas.` });
        }

      } catch (e) {
        console.error("Error al aplicar cambios de la acción completada:", e);
        toast({
          title: "Error al aplicar mejora",
          description: "No se pudieron actualizar los datos del proceso/actividad asociado.",
          variant: "destructive",
        });
      }
    }
    
    try {
      await updateDoc(accionDocRef, dataToUpdate);
    } catch(e) {
      console.error("Error updating accion:", e);
      toast({ title: "Error", description: "No se pudo actualizar la acción de mejora.", variant: "destructive" });
    }

  }, [acciones, addLogEntry]);


  const deleteAccion = useCallback(async (id: string) => {
    const accionToDelete = acciones.find(a => a.id === id);
    if (!accionToDelete) return;

    try {
      await deleteDoc(doc(db, ACCIONES_COLLECTION, id));
      addLogEntry({ action: 'delete', entityType: 'Acción de Mejora', entityName: accionToDelete.nombre, details: `Se eliminó la acción de mejora "${accionToDelete.nombre}".` });
    } catch(e) {
      console.error("Error deleting accion:", e);
      toast({ title: "Error", description: "No se pudo eliminar la acción de mejora.", variant: "destructive" });
    }
  }, [acciones, addLogEntry]);

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
