
'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';
import type { Actividad } from './ActividadesContext';
import type { CapturedProcess } from '@/app/(app)/procesos-y-flujos-registrados/page';
import { useActivityLog } from './ActivityLogContext';


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
  addAccion: (data: Omit<Accion, 'id' | 'fechaCreacion' | 'updatedAt'>) => void;
  updateAccion: (id: string, data: Partial<Omit<Accion, 'id' | 'fechaCreacion' | 'updatedAt'>>, options?: { applyTimeSaving?: boolean; applyCostSaving?: boolean }) => void;
  deleteAccion: (id: string) => void;
  isLoadingAcciones: boolean;
}

const AccionesContext = createContext<AccionesContextType | undefined>(undefined);

const LOCAL_STORAGE_ACCIONES_KEY = 'proceza-acciones';
const LOCAL_STORAGE_PROCESOS_KEY = 'proceza-captured-data';


export function AccionesProvider({ children }: { children: ReactNode }) {
  const [acciones, setAcciones] = useState<Accion[]>([]);
  const [isLoadingAcciones, setIsLoadingAcciones] = useState(true);
  const { addLogEntry } = useActivityLog();

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
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      fechaCreacion: new Date().toISOString(),
      updatedAt: Date.now(),
      historialDeCambios: [],
    };
    setAcciones(prevAcciones => [...prevAcciones, newAccion]);
    addLogEntry({ action: 'create', entityType: 'Acción de Mejora', entityName: newAccion.nombre, details: `Se creó la acción de mejora "${newAccion.nombre}".` });
  }, [addLogEntry]);

  const updateAccion = useCallback((id: string, data: Partial<Omit<Accion, 'id' | 'fechaCreacion' | 'updatedAt'>>, options?: { applyTimeSaving?: boolean; applyCostSaving?: boolean }) => {
    const originalAccion = acciones.find(a => a.id === id);
    if (!originalAccion) {
      toast({ title: "Error", description: "No se pudo encontrar la acción a actualizar.", variant: "destructive" });
      return;
    }

    const updatedAccionData = { ...originalAccion, ...data, updatedAt: Date.now() };

    // --- Start of Side Effect Logic ---
    addLogEntry({ action: 'update', entityType: 'Acción de Mejora', entityName: updatedAccionData.nombre, details: `Se actualizó la acción "${updatedAccionData.nombre}".` });

    if (updatedAccionData.estado === 'Completada' && originalAccion.estado !== 'Completada') {
      const cambios: CambioHistorial[] = [];
      
      try {
        const timeSavingInMinutes = (options?.applyTimeSaving && updatedAccionData.ahorroTiempoEstimado && updatedAccionData.unidadTiempoAhorro === 'Minutos/Instancia')
          ? updatedAccionData.ahorroTiempoEstimado
          : 0;

        const costSaving = (options?.applyCostSaving && updatedAccionData.ahorroEstimado !== undefined)
          ? updatedAccionData.ahorroEstimado
          : 0;

        if (updatedAccionData.procesoId && (timeSavingInMinutes > 0 || costSaving > 0)) {
          const storedProcesses = localStorage.getItem(LOCAL_STORAGE_PROCESOS_KEY);
          let allProcesses: CapturedProcess[] = storedProcesses ? JSON.parse(storedProcesses) : [];
          const processIndex = allProcesses.findIndex(p => p.id === updatedAccionData.procesoId);

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

        if(updatedAccionData.unidadTiempoAhorro && updatedAccionData.unidadTiempoAhorro !== 'Minutos/Instancia' && options?.applyTimeSaving){
          toast({
              title: "Mejora de tiempo no aplicada",
              description: `La unidad (${updatedAccionData.unidadTiempoAhorro}) no es 'por instancia' y no se pudo aplicar.`,
              variant: "default",
              duration: 7000
          });
        }

        updatedAccionData.historialDeCambios = [...(updatedAccionData.historialDeCambios || []), ...cambios];
        
        if(cambios.length > 0) {
          toast({
            title: "Mejora Aplicada",
            description: `Se aplicaron ${cambios.length} cambio(s) al elemento asociado.`,
          });
           addLogEntry({ action: 'update', entityType: 'Acción de Mejora', entityName: updatedAccionData.nombre, details: `Se completó la acción "${updatedAccionData.nombre}" y se aplicaron mejoras automáticas.` });
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
    // --- End of Side Effect Logic ---
    
    setAcciones(prevAcciones => prevAcciones.map(a => a.id === id ? updatedAccionData : a));

  }, [acciones, addLogEntry]);


  const deleteAccion = useCallback((id: string) => {
    const accionToDelete = acciones.find(a => a.id === id);
    setAcciones(prevAcciones => prevAcciones.filter((accion) => accion.id !== id));
    if (accionToDelete) {
        addLogEntry({ action: 'delete', entityType: 'Acción de Mejora', entityName: accionToDelete.nombre, details: `Se eliminó la acción de mejora "${accionToDelete.nombre}".` });
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
