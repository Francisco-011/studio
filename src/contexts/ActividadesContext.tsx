
'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useActivityLog } from './ActivityLogContext';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, query, Timestamp } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';

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
  politicasAsociadasIds?: string[];
  createdAt: number; 
  updatedAt?: number;
  deletedAt?: number; 
  descripcionBreve?: string;
  sistemaUtilizado?: string;
  historialDeCambios?: CambioHistorial[];
}

interface ActividadesContextType {
  actividades: Actividad[];
  deletedActividades: Actividad[];
  addActividad: (data: Omit<Actividad, 'id' | 'createdAt' | 'updatedAt' | 'codigo'>) => Promise<Actividad>;
  updateActividad: (id: string, data: Partial<Omit<Actividad, 'id' | 'createdAt' | 'updatedAt' | 'codigo'>>) => Promise<void>;
  softDeleteActividad: (id: string) => Promise<void>;
  restoreActividad: (id: string) => Promise<void>;
  toggleActividadStatus: (actividadToToggle: Actividad) => Promise<void>;
  isLoadingActividades: boolean;
}

const ActividadesContext = createContext<ActividadesContextType | undefined>(undefined);

const ACTIVIDADES_COLLECTION = 'actividades';

export function ActividadesProvider({ children }: { children: ReactNode }) {
  const [actividades, setActividades] = useState<Actividad[]>([]);
  const [deletedActividades, setDeletedActividades] = useState<Actividad[]>([]);
  const [isLoadingActividades, setIsLoadingActividades] = useState(true);
  const { addLogEntry } = useActivityLog();

  useEffect(() => {
    const q = query(collection(db, ACTIVIDADES_COLLECTION));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const allData = snapshot.docs.map(doc => {
            const data = doc.data();
            const docCreatedAt = data.createdAt;
            const docUpdatedAt = data.updatedAt;
            const docDeletedAt = data.deletedAt;

            return {
                id: doc.id,
                ...data,
                createdAt: docCreatedAt?.toMillis ? docCreatedAt.toMillis() : (typeof docCreatedAt === 'number' ? docCreatedAt : 0),
                updatedAt: docUpdatedAt?.toMillis ? docUpdatedAt.toMillis() : (typeof docUpdatedAt === 'number' ? docUpdatedAt : undefined),
                deletedAt: docDeletedAt?.toMillis ? docDeletedAt.toMillis() : (typeof docDeletedAt === 'number' ? docDeletedAt : undefined),
            } as Actividad;
        });
        
        setActividades(allData.filter(act => !act.deletedAt).sort((a,b) => b.createdAt - a.createdAt));
        setDeletedActividades(allData.filter(act => !!act.deletedAt).sort((a,b) => (b.deletedAt || 0) - (a.deletedAt || 0)));
        setIsLoadingActividades(false);
    }, (error) => {
        console.error("Error fetching actividades: ", error);
        setIsLoadingActividades(false);
        toast({ title: "Error de Red", description: "No se pudieron cargar las actividades.", variant: "destructive" });
    });

    return () => unsubscribe();
  }, []);

  const addActividad = useCallback(async (data: Omit<Actividad, 'id' | 'createdAt' | 'updatedAt' | 'codigo'>): Promise<Actividad> => {
    try {
      const codigo = `AC-${Date.now().toString().slice(-6)}`;
      const payload = {
        ...data,
        codigo,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        activa: data.activa === undefined ? true : data.activa,
        historialDeCambios: [],
        deletedAt: null,
      };
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
      };
      return newActividad;
    } catch(e) {
      console.error("Error adding actividad: ", e);
      toast({ title: "Error", description: "No se pudo agregar la actividad.", variant: "destructive"});
      throw e;
    }
  }, [addLogEntry]);

  const updateActividad = useCallback(async (id: string, data: Partial<Omit<Actividad, 'id' | 'createdAt' | 'updatedAt' | 'codigo'>>) => {
    const allKnownActivities = [...actividades, ...deletedActividades];
    const originalActividad = allKnownActivities.find(a => a.id === id);
    if (!originalActividad) return;
    
    addLogEntry({ action: 'update', entityType: 'Actividad', entityName: data.nombre || originalActividad.nombre, details: `Se actualizó la actividad "${originalActividad.nombre}".` });
    
    const changes: CambioHistorial[] = [];
    const fieldsToCompare: (keyof typeof data)[] = ['nombre', 'descripcionBreve', 'sistemaUtilizado', 'politicasAsociadasIds', 'procedimientoId'];
    
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
      await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp(),
        historialDeCambios: [...(originalActividad.historialDeCambios || []), ...changes]
      });
    } catch(e) {
      console.error("Error updating actividad: ", e);
      toast({ title: "Error", description: "No se pudo actualizar la actividad.", variant: "destructive"});
    }
  }, [actividades, deletedActividades, addLogEntry]);

  const softDeleteActividad = useCallback(async (id: string) => {
    const activityToMove = actividades.find(act => act.id === id);
    if (activityToMove) {
      try {
        const docRef = doc(db, ACTIVIDADES_COLLECTION, id);
        await updateDoc(docRef, {
          deletedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        addLogEntry({ action: 'delete', entityType: 'Actividad', entityName: activityToMove.nombre, details: `Se eliminó la actividad "${activityToMove.nombre}".` });
      } catch (e) {
        console.error("Error deleting actividad: ", e);
        toast({ title: "Error", description: "No se pudo eliminar la actividad.", variant: "destructive"});
      }
    }
  }, [actividades, addLogEntry]);

  const restoreActividad = useCallback(async (id: string) => {
    const activityToRestore = deletedActividades.find(act => act.id === id);
    if (activityToRestore) {
      try {
        const docRef = doc(db, ACTIVIDADES_COLLECTION, id);
        await updateDoc(docRef, {
            deletedAt: null,
            activa: true,
            updatedAt: serverTimestamp(),
        });
        addLogEntry({ action: 'restore', entityType: 'Actividad', entityName: activityToRestore.nombre, details: `Se restauró la actividad "${activityToRestore.nombre}".` });
      } catch(e) {
        console.error("Error restoring actividad: ", e);
        toast({ title: "Error", description: "No se pudo restaurar la actividad.", variant: "destructive"});
      }
    }
  }, [deletedActividades, addLogEntry]);

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
      deletedActividades, 
      addActividad, 
      updateActividad, 
      softDeleteActividad, 
      restoreActividad, 
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
