
'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useActivityLog } from './ActivityLogContext';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, Timestamp } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import type { Moneda } from './AccionesContext';
import { frecuenciaOptions } from './ProcesosContext';

export interface CambioHistorial {
  timestamp: string;
  field: string;
  before: any;
  after: any;
}

export interface Actividad {
  id: string;
  codigo: string;
  nombre: string;
  activa: boolean;
  procedimientoId?: string;
  puestoId?: string;
  createdAt: number; 
  updatedAt?: number;
  descripcionBreve?: string;
  historialDeCambios?: CambioHistorial[];
  
  // New time and cost fields
  tiempoEstimado?: number; // in minutes
  tiempoIdeal?: number; // in minutes
  costoEstimado?: number; // calculated field, maybe not stored
  costoIdeal?: number; // calculated field, maybe not stored
  monedaCosto?: Moneda; // currency for the cost
  frecuencia?: typeof frecuenciaOptions[number];
  ejecucionesPorPeriodo?: number; // How many times it's executed in the given frequency
}

export type ActividadCreationData = Omit<Actividad, 'id' | 'codigo' | 'createdAt' | 'updatedAt' | 'historialDeCambios' | 'costoEstimado' | 'costoIdeal'>;

interface ActividadesContextType {
  actividades: Actividad[];
  addActividad: (data: ActividadCreationData) => Promise<Actividad | null>;
  updateActividad: (id: string, data: Partial<ActividadCreationData>) => Promise<void>;
  deleteActividad: (id: string) => Promise<void>;
  toggleActividadStatus: (actividadToToggle: Actividad) => Promise<void>;
  isLoadingActividades: boolean;
}

const ActividadesContext = createContext<ActividadesContextType | undefined>(undefined);

const ACTIVIDADES_COLLECTION = 'actividades';

export function ActividadesProvider({ children }: { children: ReactNode }) {
  const [actividades, setActividades] = useState<Actividad[]>([]);
  const [isLoadingActividades, setIsLoadingActividades] = useState(true);
  const { addLogEntry } = useActivityLog();

  useEffect(() => {
    const q = query(collection(db, ACTIVIDADES_COLLECTION));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const allData = snapshot.docs.map(doc => {
            const data = doc.data();
            const docCreatedAt = data.createdAt;
            const docUpdatedAt = data.updatedAt;

            return {
                id: doc.id,
                ...data,
                createdAt: docCreatedAt?.toMillis ? docCreatedAt.toMillis() : (typeof docCreatedAt === 'number' ? docCreatedAt : 0),
                updatedAt: docUpdatedAt?.toMillis ? docUpdatedAt.toMillis() : (typeof docUpdatedAt === 'number' ? docUpdatedAt : undefined),
            } as Actividad;
        });
        
        setActividades(allData.sort((a,b) => b.createdAt - a.createdAt));
        setIsLoadingActividades(false);
    }, (error) => {
        console.error("Error fetching actividades: ", error);
        setIsLoadingActividades(false);
        toast({ title: "Error de Red", description: "No se pudieron cargar las actividades.", variant: "destructive" });
    });

    return () => unsubscribe();
  }, []);

  const addActividad = useCallback(async (data: ActividadCreationData): Promise<Actividad | null> => {
    try {
      const codigo = `AC-${Date.now().toString().slice(-6)}`;
      const payload: { [key: string]: any } = {
        ...data,
        codigo,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        activa: data.activa === undefined ? true : data.activa,
        historialDeCambios: [],
      };

      Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);

      const docRef = await addDoc(collection(db, ACTIVIDADES_COLLECTION), payload);
      addLogEntry({ action: 'create', entityType: 'Actividad', entityName: data.nombre, details: `Se creó la actividad "${data.nombre}" (${codigo}).` });
      
      const currentTime = Date.now();
      const newActividad: Actividad = {
          ...data,
          id: docRef.id,
          codigo,
          createdAt: currentTime,
          updatedAt: currentTime,
          historialDeCambios: [],
          puestoId: data.puestoId,
          frecuencia: data.frecuencia,
      };
      return newActividad;
    } catch(e) {
      console.error("Error adding actividad: ", e);
      toast({ title: "Error", description: "No se pudo agregar la actividad.", variant: "destructive"});
      throw e;
    }
  }, [addLogEntry]);

  const updateActividad = useCallback(async (id: string, data: Partial<ActividadCreationData>) => {
    const originalActividad = actividades.find(a => a.id === id);
    if (!originalActividad) return;
    
    addLogEntry({ action: 'update', entityType: 'Actividad', entityName: data.nombre || originalActividad.nombre, details: `Se actualizó la actividad "${originalActividad.nombre}".` });
    
    const changes: CambioHistorial[] = [];
    const fieldsToCompare: (keyof typeof data)[] = ['nombre', 'descripcionBreve', 'tiempoEstimado', 'tiempoIdeal', 'frecuencia', 'puestoId', 'ejecucionesPorPeriodo', 'procedimientoId'];
    
    fieldsToCompare.forEach(key => {
        if (key in data && originalActividad[key as keyof Actividad] !== data[key]) {
             changes.push({
                timestamp: new Date().toISOString(),
                field: key,
                before: originalActividad[key as keyof Actividad] ?? 'N/A',
                after: data[key] ?? 'N/A'
             });
        }
    });

    const docRef = doc(db, ACTIVIDADES_COLLECTION, id);
    try {
      const payload: { [key: string]: any } = {
        ...data,
        updatedAt: serverTimestamp(),
        historialDeCambios: [...(originalActividad.historialDeCambios || []), ...changes]
      };
      
      Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);

      await updateDoc(docRef, payload);
    } catch(e) {
      console.error("Error updating actividad: ", e);
      toast({ title: "Error", description: "No se pudo actualizar la actividad.", variant: "destructive"});
    }
  }, [actividades, addLogEntry]);

  const deleteActividad = useCallback(async (id: string) => {
    const activityToDelete = actividades.find(act => act.id === id);
    if (activityToDelete) {
      try {
        const docRef = doc(db, ACTIVIDADES_COLLECTION, id);
        await deleteDoc(docRef);
        addLogEntry({ action: 'delete', entityType: 'Actividad', entityName: activityToDelete.nombre, details: `Se eliminó permanentemente la actividad "${activityToDelete.nombre}".` });
      } catch (e) {
        console.error("Error deleting actividad: ", e);
        toast({ title: "Error", description: "No se pudo eliminar la actividad.", variant: "destructive"});
      }
    }
  }, [actividades, addLogEntry]);

  const toggleActividadStatus = useCallback(async (actividadToToggle: Actividad) => {
    const change: CambioHistorial = {
      timestamp: new Date().toISOString(),
      field: 'activo',
      before: actividadToToggle.activa,
      after: !actividadToToggle.activa,
    };
    try {
        const docRef = doc(db, ACTIVIDADES_COLLECTION, actividadToToggle.id);
        await updateDoc(docRef, {
          activa: !actividadToToggle.activa,
          updatedAt: serverTimestamp(),
          historialDeCambios: [...(actividadToToggle.historialDeCambios || []), change]
        });
        addLogEntry({ action: 'status_change', entityType: 'Actividad', entityName: actividadToToggle.nombre, details: `El estado de la actividad "${actividadToToggle.nombre}" cambió a ${!actividadToToggle.activa ? 'Activa' : 'Inactiva'}.` });
    } catch(e) {
        console.error("Error toggling actividad status: ", e);
        toast({ title: "Error", description: "No se pudo cambiar el estado de la actividad.", variant: "destructive"});
    }
  }, [addLogEntry]);


  return (
    <ActividadesContext.Provider value={{ 
      actividades, 
      addActividad, 
      updateActividad, 
      deleteActividad, 
      toggleActividadStatus, 
      isLoadingActividades 
    }}>
      {children}
    </ActividadesContext.Provider>
  );
}

export function useActividades(): ActividadesContextType {
  const context = useContext(ActividadesContext);
  if (context === undefined) {
    throw new Error('useActividades must be used within an ActividadesProvider');
  }
  return context;
}
