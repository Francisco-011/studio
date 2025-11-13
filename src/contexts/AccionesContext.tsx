
'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';
import { useActivityLog } from './ActivityLogContext';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, Timestamp, limit } from 'firebase/firestore';
import { format, parseISO } from 'date-fns';


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
  departamento?: string;
  puesto?: string;
  procesoId?: string;
  procedimientoId?: string;
  actividadId?: string;
  sistemaId?: string;
  politicaId?: string;
  updatedAt: number; // timestamp
  historialDeCambios?: CambioHistorial[];
}

interface AccionesContextType {
  acciones: Accion[];
  addAccion: (data: Omit<Accion, 'id' | 'fechaCreacion' | 'updatedAt'>) => Promise<string | null>;
  updateAccion: (id: string, data: Partial<Omit<Accion, 'id' | 'fechaCreacion' | 'updatedAt'>>, historial?: CambioHistorial[]) => Promise<void>;
  deleteAccion: (id: string) => Promise<void>;
  isLoadingAcciones: boolean;
}

const AccionesContext = createContext<AccionesContextType | undefined>(undefined);

const ACCIONES_COLLECTION = 'acciones';

export function AccionesProvider({ children }: { children: ReactNode }) {
  const [acciones, setAcciones] = useState<Accion[]>([]);
  const [isLoadingAcciones, setIsLoadingAcciones] = useState(true);
  const { addLogEntry } = useActivityLog();

  useEffect(() => {
    // Limit query to prevent loading too many documents at once
    const MAX_ACCIONES = 1000;
    const q = query(
      collection(db, ACCIONES_COLLECTION),
      orderBy("fechaCreacion", "desc"),
      limit(MAX_ACCIONES)
    );
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

  const addAccion = useCallback(async (data: Omit<Accion, 'id' | 'fechaCreacion' | 'updatedAt'>): Promise<string | null> => {
    try {
        const payload: { [key: string]: any } = {
          ...data,
          fechaCreacion: serverTimestamp(),
          updatedAt: serverTimestamp(),
          historialDeCambios: [],
        };
        Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);
        const docRef = await addDoc(collection(db, ACCIONES_COLLECTION), payload);
        addLogEntry({ action: 'create', entityType: 'Acción de Mejora', entityName: data.nombre, details: `Se creó la acción de mejora "${data.nombre}".` });
        return docRef.id;
    } catch(e) {
        console.error("Error adding accion:", e);
        toast({ title: "Error", description: "No se pudo agregar la acción de mejora.", variant: "destructive"});
        return null;
    }
  }, [addLogEntry]);

  const updateAccion = useCallback(async (id: string, data: Partial<Omit<Accion, 'id' | 'fechaCreacion' | 'updatedAt'>>, historial: CambioHistorial[] = []) => {
    const originalAccion = acciones.find(a => a.id === id);
    if (!originalAccion) {
      toast({ title: "Error", description: "No se pudo encontrar la acción a actualizar.", variant: "destructive" });
      return;
    }
    
    const changes: CambioHistorial[] = [];
    const fieldsToCompare: (keyof typeof data)[] = [
        'nombre', 'descripcion', 'responsable', 'estado', 'fechaObjetivo', 'fechaFinalizacion',
        'ahorroEstimado', 'monedaAhorro', 'ahorroTiempoEstimado', 'unidadTiempoAhorro',
        'origenMejora', 'area', 'puesto', 'procesoId', 'actividadId', 'procedimientoId', 'departamento',
        'sistemaId', 'politicaId'
    ];

    fieldsToCompare.forEach(key => {
        const originalValue = originalAccion[key as keyof Accion];
        const newValue = data[key as keyof Partial<Accion>];
        
        const normalizedOriginal = originalValue ?? null;
        const normalizedNew = newValue ?? null;
        
        if (normalizedOriginal !== normalizedNew) {
            changes.push({
                timestamp: new Date().toISOString(),
                field: key,
                before: originalValue || 'No definido',
                after: newValue || 'No definido'
            });
        }
    });

    const accionDocRef = doc(db, ACCIONES_COLLECTION, id);
    const dataToUpdate: any = { ...data, updatedAt: serverTimestamp() };

    const combinedHistory = [...(originalAccion.historialDeCambios || []), ...changes, ...historial];
    
    if (changes.length > 0 || historial.length > 0) {
        dataToUpdate.historialDeCambios = combinedHistory;
    }
    
    try {
      Object.keys(dataToUpdate).forEach(key => {
        if (dataToUpdate[key] === undefined) {
          delete dataToUpdate[key];
        }
      });
      await updateDoc(accionDocRef, dataToUpdate);
      if (changes.length > 0) {
        addLogEntry({ action: 'update', entityType: 'Acción de Mejora', entityName: data.nombre || originalAccion.nombre, details: `Se actualizó la acción "${originalAccion.nombre}".` });
      }
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
