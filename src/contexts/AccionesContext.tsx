
'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';
import type { Actividad } from './ActividadesContext';
import type { CapturedProcess } from '@/app/(app)/procesos-y-flujos-registrados/page';


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
  updateAccion: (id: string, data: Partial<Omit<Accion, 'id' | 'fechaCreacion' | 'updatedAt'>>) => void;
  deleteAccion: (id: string) => void;
  isLoadingAcciones: boolean;
}

const AccionesContext = createContext<AccionesContextType | undefined>(undefined);

const LOCAL_STORAGE_ACCIONES_KEY = 'proceza-acciones';
const LOCAL_STORAGE_ACTIVIDADES_KEY = 'proceza-actividades';
const LOCAL_STORAGE_PROCESOS_KEY = 'proceza-captured-data';


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
    setAcciones(prevAcciones => {
        const newAccion: Accion = {
          ...data,
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          fechaCreacion: new Date().toISOString(),
          updatedAt: Date.now(),
          historialDeCambios: [],
        };
        return [...prevAcciones, newAccion];
    });
  }, []);

  const updateAccion = useCallback((id: string, data: Partial<Omit<Accion, 'id' | 'fechaCreacion' | 'updatedAt'>>) => {
    setAcciones(prevAcciones => {
      const newAcciones = [...prevAcciones];
      const accionIndex = newAcciones.findIndex(a => a.id === id);
      if (accionIndex === -1) return prevAcciones;

      const originalAccion = newAcciones[accionIndex];
      const updatedAccionData = { ...originalAccion, ...data, updatedAt: Date.now() };

      if (updatedAccionData.estado === 'Completada' && originalAccion.estado !== 'Completada') {
        const cambios: CambioHistorial[] = [];
        
        try {
          // Logic for Activities
          if (updatedAccionData.actividadId) {
            const storedActivities = localStorage.getItem(LOCAL_STORAGE_ACTIVIDADES_KEY);
            let allActivities: Actividad[] = storedActivities ? JSON.parse(storedActivities) : [];
            const activityIndex = allActivities.findIndex(a => a.id === updatedAccionData.actividadId);

            if (activityIndex !== -1) {
              const targetActivity = { ...allActivities[activityIndex] };
              
              if (updatedAccionData.ahorroTiempoEstimado !== undefined && targetActivity.tiempoEstimadoActividad !== undefined) {
                const antes = targetActivity.tiempoEstimadoActividad;
                const despues = Math.max(0, antes - updatedAccionData.ahorroTiempoEstimado);
                cambios.push({ timestamp: new Date().toISOString(), field: 'Tiempo Estimado Actividad', before: antes, after: despues });
                targetActivity.tiempoEstimadoActividad = despues;
              }
              if (updatedAccionData.ahorroEstimado !== undefined && targetActivity.costoEstimadoActividad !== undefined) {
                const antes = targetActivity.costoEstimadoActividad;
                const despues = Math.max(0, antes - updatedAccionData.ahorroEstimado);
                cambios.push({ timestamp: new Date().toISOString(), field: 'Costo Estimado Actividad', before: antes, after: despues });
                targetActivity.costoEstimadoActividad = despues;
              }

              if (cambios.length > 0) {
                targetActivity.updatedAt = Date.now();
                allActivities[activityIndex] = targetActivity;
                localStorage.setItem(LOCAL_STORAGE_ACTIVIDADES_KEY, JSON.stringify(allActivities));
              }
            }
          } 
          // Logic for Processes
          else if (updatedAccionData.procesoId) {
            const storedProcesses = localStorage.getItem(LOCAL_STORAGE_PROCESOS_KEY);
            let allProcesses: CapturedProcess[] = storedProcesses ? JSON.parse(storedProcesses) : [];
            const processIndex = allProcesses.findIndex(p => p.id === updatedAccionData.procesoId);

            if (processIndex !== -1) {
              const targetProcess = {...allProcesses[processIndex]};
              
              if (updatedAccionData.ahorroTiempoEstimado !== undefined && targetProcess.tiempoEstimado !== undefined) {
                const antes = targetProcess.tiempoEstimado;
                const despues = Math.max(0, antes - updatedAccionData.ahorroTiempoEstimado);
                cambios.push({ timestamp: new Date().toISOString(), field: 'Tiempo Estimado Proceso', before: antes, after: despues });
                targetProcess.tiempoEstimado = despues;
              }
              if (updatedAccionData.ahorroEstimado !== undefined && targetProcess.costoEstimado !== undefined) {
                const antes = targetProcess.costoEstimado;
                const despues = Math.max(0, antes - updatedAccionData.ahorroEstimado);
                cambios.push({ timestamp: new Date().toISOString(), field: 'Costo Estimado Proceso', before: antes, after: despues });
                targetProcess.costoEstimado = despues;
              }
              
              if(cambios.length > 0) {
                targetProcess.updatedAt = Date.now();
                allProcesses[processIndex] = targetProcess;
                localStorage.setItem(LOCAL_STORAGE_PROCESOS_KEY, JSON.stringify(allProcesses));
              }
            }
          }

          updatedAccionData.historialDeCambios = [...(updatedAccionData.historialDeCambios || []), ...cambios];
          
          if(cambios.length > 0) {
            toast({
              title: "Mejora Aplicada",
              description: `Se aplicaron ${cambios.length} cambio(s) al elemento asociado.`,
            });
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
      
      newAcciones[accionIndex] = updatedAccionData;
      return newAcciones;
    });
  }, []);


  const deleteAccion = useCallback((id: string) => {
    setAcciones(prevAcciones => prevAcciones.filter((accion) => accion.id !== id));
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
