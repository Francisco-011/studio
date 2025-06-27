'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, Timestamp } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import type { CapturaFormData } from '@/app/(app)/captura/page';
import { useActivityLog } from './ActivityLogContext';

export interface CambioHistorial {
  timestamp: string;
  field: string;
  before: any;
  after: any;
}

export interface CapturedProcess extends CapturaFormData {
  id: string;
  capturedAt: string;
  updatedAt?: number;
  deletedAt?: string;
  activo?: boolean;
  historialDeCambios?: CambioHistorial[];
}

interface ProcesosContextType {
  procesos: CapturedProcess[];
  addProceso: (data: CapturaFormData) => Promise<CapturedProcess | null>;
  updateProceso: (id: string, data: Partial<Omit<CapturedProcess, 'id'>>) => Promise<void>;
  softDeleteProceso: (id: string) => Promise<void>;
  restoreProceso: (id: string) => Promise<void>;
  toggleProcesoStatus: (id: string) => Promise<void>;
  isLoadingProcesos: boolean;
}

const ProcesosContext = createContext<ProcesosContextType | undefined>(undefined);

const PROCESOS_COLLECTION = 'procesos';

export function ProcesosProvider({ children }: { children: ReactNode }) {
  const [procesos, setProcesos] = useState<CapturedProcess[]>([]);
  const [isLoadingProcesos, setIsLoadingProcesos] = useState(true);
  const { addLogEntry } = useActivityLog();

  useEffect(() => {
    const q = query(collection(db, PROCESOS_COLLECTION));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const procesosData = snapshot.docs.map(doc => {
            const data = doc.data();
            const capturedAtData = data.capturedAt as Timestamp;
            const updatedAtData = data.updatedAt as Timestamp;
            const deletedAtData = data.deletedAt as Timestamp;
            
            return {
                id: doc.id,
                ...data,
                capturedAt: capturedAtData?.toDate().toISOString() || new Date().toISOString(),
                updatedAt: updatedAtData?.toMillis() || capturedAtData?.toMillis() || Date.now(),
                deletedAt: deletedAtData?.toDate().toISOString(),
            } as CapturedProcess;
        });
        setProcesos(procesosData);
        setIsLoadingProcesos(false);
    }, (error) => {
        console.error("Error fetching procesos: ", error);
        toast({ title: "Error de Red", description: "No se pudieron cargar los procesos.", variant: "destructive" });
        setIsLoadingProcesos(false);
    });

    return () => unsubscribe();
  }, []);

  const addProceso = useCallback(async (data: CapturaFormData): Promise<CapturedProcess | null> => {
    try {
        const docRef = await addDoc(collection(db, PROCESOS_COLLECTION), {
          ...data,
          capturedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          activo: true,
          historialDeCambios: [],
        });
        addLogEntry({ action: 'create', entityType: 'Proceso', entityName: data.proceso, details: `Se capturó el nuevo proceso "${data.proceso}".` });
        return {
            ...data,
            id: docRef.id,
            capturedAt: new Date().toISOString(),
            updatedAt: Date.now(),
            activo: true,
            historialDeCambios: [],
        };
    } catch(e) {
        console.error("Error adding proceso:", e);
        toast({ title: "Error", description: "No se pudo agregar el proceso.", variant: "destructive"});
        return null;
    }
  }, [addLogEntry]);

  const updateProceso = useCallback(async (id: string, data: Partial<Omit<CapturedProcess, 'id'>>) => {
    const originalProceso = procesos.find(p => p.id === id);
    if (!originalProceso) return;

    try {
        const procesoDocRef = doc(db, PROCESOS_COLLECTION, id);
        await updateDoc(procesoDocRef, { ...data, updatedAt: serverTimestamp() });
        addLogEntry({ action: 'update', entityType: 'Proceso', entityName: data.proceso || originalProceso.proceso, details: `Se actualizó el proceso "${originalProceso.proceso}".` });
    } catch (e) {
        console.error("Error updating proceso: ", e);
        toast({ title: "Error", description: "No se pudo actualizar el proceso.", variant: "destructive"});
    }
  }, [procesos, addLogEntry]);
  
  const softDeleteProceso = useCallback(async (id: string) => {
      const procesoToDelete = procesos.find(p => p.id === id);
      if (!procesoToDelete) return;

      try {
          const procesoDocRef = doc(db, PROCESOS_COLLECTION, id);
          await updateDoc(procesoDocRef, { deletedAt: serverTimestamp(), updatedAt: serverTimestamp() });
          addLogEntry({ action: 'delete', entityType: 'Proceso', entityName: procesoToDelete.proceso, details: `Proceso "${procesoToDelete.proceso}" movido a la papelera.` });
          toast({ title: "Proceso Eliminado", variant: 'destructive' });
      } catch (e) {
          console.error("Error deleting proceso: ", e);
          toast({ title: "Error", description: "No se pudo eliminar el proceso.", variant: "destructive" });
      }
  }, [procesos, addLogEntry]);

  const restoreProceso = useCallback(async (id: string) => {
      const procesoToRestore = procesos.find(p => p.id === id);
      if (!procesoToRestore) return;

      try {
          const procesoDocRef = doc(db, PROCESOS_COLLECTION, id);
          await updateDoc(procesoDocRef, { deletedAt: null, activo: true, updatedAt: serverTimestamp() });
          addLogEntry({ action: 'restore', entityType: 'Proceso', entityName: procesoToRestore.proceso, details: `Se restauró el proceso "${procesoToRestore.proceso}".` });
          toast({ title: "Proceso Restaurado" });
      } catch (e) {
          console.error("Error restoring proceso: ", e);
          toast({ title: "Error", description: "No se pudo restaurar el proceso.", variant: "destructive" });
      }
  }, [procesos, addLogEntry]);
  
  const toggleProcesoStatus = useCallback(async (id: string) => {
    const procesoToToggle = procesos.find(p => p.id === id);
    if (!procesoToToggle) return;
    const newStatus = !(procesoToToggle.activo !== false);
    try {
        const procesoDocRef = doc(db, PROCESOS_COLLECTION, id);
        await updateDoc(procesoDocRef, { activo: newStatus, updatedAt: serverTimestamp() });
        addLogEntry({ action: 'status_change', entityType: 'Proceso', entityName: procesoToToggle.proceso, details: `El estado del proceso "${procesoToToggle.proceso}" cambió a ${newStatus ? 'Activo' : 'Inactivo'}.` });
        toast({ title: `Proceso ${newStatus ? 'Activado' : 'Inactivado'}` });
    } catch (e) {
        console.error("Error toggling proceso status: ", e);
        toast({ title: "Error", description: "No se pudo cambiar el estado del proceso.", variant: "destructive" });
    }
  }, [procesos, addLogEntry]);

  return (
    <ProcesosContext.Provider value={{ procesos, addProceso, updateProceso, softDeleteProceso, restoreProceso, toggleProcesoStatus, isLoadingProcesos }}>
      {children}
    </ProcesosContext.Provider>
  );
}

export function useProcesos(): ProcesosContextType {
  const context = useContext(ProcesosContext);
  if (context === undefined) {
    throw new Error('useProcesos must be used within a ProcesosProvider');
  }
  return context;
}
