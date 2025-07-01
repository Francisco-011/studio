
'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { useActivityLog } from './ActivityLogContext';
import { useDepartamentos } from './DepartamentosContext';
import { usePuestos } from './PuestosContext';
import { toast } from '@/hooks/use-toast';


export interface Area {
  id: string;
  nombre: string;
  createdAt?: any;
}

interface AreasContextType {
  areas: Area[];
  addArea: (nombre: string) => Promise<void>;
  updateArea: (id: string, nombre: string) => Promise<void>;
  deleteArea: (id: string, checkUsage: (areaId: string) => { isUsed: boolean; message: string }) => Promise<void>;
  isLoading: boolean;
}

const AreasContext = createContext<AreasContextType | undefined>(undefined);

const AREAS_COLLECTION = 'areas';

export function AreasProvider({ children }: { children: ReactNode }) {
  const [areas, setAreas] = useState<Area[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { addLogEntry } = useActivityLog();

  useEffect(() => {
    const q = query(collection(db, AREAS_COLLECTION), orderBy("nombre", "asc"));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const areasData: Area[] = [];
      querySnapshot.forEach((doc) => {
        areasData.push({ id: doc.id, ...doc.data() } as Area);
      });
      setAreas(areasData);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching areas from Firestore: ", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const addArea = useCallback(async (nombre: string) => {
    try {
      await addDoc(collection(db, AREAS_COLLECTION), {
        nombre: nombre,
        createdAt: serverTimestamp(),
      });
      addLogEntry({ action: 'create', entityType: 'Área', entityName: nombre, details: `Se creó el área "${nombre}".` });
    } catch (e) {
      console.error("Error adding document: ", e);
    }
  }, [addLogEntry]);

  const updateArea = useCallback(async (id: string, nombre: string) => {
    const areaDocRef = doc(db, AREAS_COLLECTION, id);
    let originalName = '';
    const areaToUpdate = areas.find(a => a.id === id);
    if(areaToUpdate) {
        originalName = areaToUpdate.nombre;
    }
    
    try {
      await updateDoc(areaDocRef, { nombre });
      if (originalName && originalName !== nombre) {
        addLogEntry({ action: 'update', entityType: 'Área', entityName: nombre, details: `El área "${originalName}" fue renombrada a "${nombre}".` });
      }
    } catch (e) {
      console.error("Error updating document: ", e);
    }
  }, [addLogEntry, areas]);

  const deleteArea = useCallback(async (id: string, checkUsage: (areaId: string) => { isUsed: boolean; message: string }) => {
    const { isUsed, message } = checkUsage(id);
    if (isUsed) {
      toast({
        title: "Eliminación Bloqueada",
        description: message,
        variant: "destructive",
        duration: 7000
      });
      return;
    }
    
    const areaToDelete = areas.find(a => a.id === id);
    if(areaToDelete) {
      try {
        await deleteDoc(doc(db, AREAS_COLLECTION, id));
        addLogEntry({ action: 'delete', entityType: 'Área', entityName: areaToDelete.nombre, details: `Se eliminó el área "${areaToDelete.nombre}".` });
      } catch (e) {
        console.error("Error deleting document: ", e);
      }
    }
  }, [areas, addLogEntry]);


  return (
    <AreasContext.Provider value={{ areas, addArea, updateArea, deleteArea, isLoading }}>
      {children}
    </AreasContext.Provider>
  );
}

export function useAreas(): AreasContextType {
  const context = useContext(AreasContext);
  if (context === undefined) {
    throw new Error('useAreas must be used within an AreasProvider');
  }
  return context;
}
