
'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, Timestamp } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { useActivityLog } from './ActivityLogContext';
import { z } from 'zod';
import type { PoliticaLinkType, PoliticaVinculo } from './PoliticasContext';
import { useAuth } from './AuthContext';
import { useExceptions } from './ExceptionsContext';
import type { NivelAcceso } from '@/app/(app)/usuarios/page';

export const frecuenciaOptions = ["Diario", "Semanal", "Quincenal", "Mensual", "Bimestral", "Trimestral", "Semestral", "Anual", "A demanda", "Otro"] as const;
export const monedaOptions = ["USD", "MXN", "EUR", "CAD", "GBP"] as const;
export const clasificacionOptions = ["Público", "Privado", "Confidencial"] as const;

export const capturaFormSchema = z.object({
  area: z.string().min(1, "El área es requerida."),
  departamento: z.string().optional(),
  puesto: z.string().min(1, "El puesto es requerido."),
  proceso: z.string().min(3, "El nombre del proceso es requerido y debe tener al menos 3 caracteres."),
  descripcion: z.string().min(1, "La descripción del proceso es requerida."),
  clasificacion: z.enum(clasificacionOptions).default('Privado'),
  frecuencia: z.enum(frecuenciaOptions, { errorMap: () => ({ message: "Seleccione una frecuencia válida."}) }),
  tiempoEstimado: z.preprocess(
    (val) => (String(val).trim() === '' ? undefined : parseInt(String(val), 10)),
    z.number().int("El tiempo debe ser un número entero.").nonnegative("El tiempo estimado debe ser un número positivo o cero.").optional()
  ),
  tiempoIdeal: z.preprocess(
    (val) => (String(val).trim() === '' ? undefined : parseInt(String(val), 10)),
    z.number().int("El tiempo debe ser un número entero.").nonnegative("El tiempo ideal debe ser un número positivo o cero.").optional()
  ),
  costoEstimado: z.preprocess(
    (val) => (String(val).trim() === '' ? undefined : parseFloat(String(val))),
    z.number().nonnegative("El costo estimado debe ser un número positivo.").optional()
  ),
  costoIdeal: z.preprocess(
    (val) => (String(val).trim() === '' ? undefined : parseFloat(String(val))),
    z.number().nonnegative("El costo ideal debe ser un número positivo.").optional()
  ),
  monedaCosto: z.enum(monedaOptions as [string, ...string[]]).optional(),
  sistemas: z.array(z.string()).optional().default([]),
  informacionRecibe: z.string().min(1, "La descripción de la información que recibe es requerida."),
  procesosEntrada: z.array(z.string()).optional().default([]),
  informacionEntrega: z.string().min(1, "La descripción de la información que entrega es requerida."),
  procesosSalida: z.array(z.string()).optional().default([]),
  procedimientoOrder: z.array(z.string()).optional().default([]),
  politicasAsociadas: z.array(z.object({
    policyId: z.string(),
    linkType: z.string(), // z.enum(politicaLinkTypes) would cause circular dependency
  })).optional().default([]),
}).refine(data => {
  if ((data.costoEstimado !== undefined || data.costoIdeal !== undefined) && !data.monedaCosto) {
    return false;
  }
  return true;
}, {
  message: "Debe seleccionar una moneda si especifica un costo.",
  path: ["monedaCosto"],
});
export type CapturaFormData = z.infer<typeof capturaFormSchema>;


export interface CambioHistorial {
  timestamp: string;
  field: string;
  before: any;
  after: any;
}

export interface CapturedProcess extends CapturaFormData {
  id: string;
  codigo: string;
  capturedAt: string;
  updatedAt?: number;
  deletedAt?: string;
  activo?: boolean;
  historialDeCambios?: CambioHistorial[];
  politicasAsociadasIds?: string[];
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

const getAllowedClassifications = (level: NivelAcceso): (typeof clasificacionOptions[number])[] => {
    switch (level) {
        case 'Confidencial':
        case 'Ejecutivo':
            return ['Público', 'Privado', 'Confidencial'];
        case 'Jerárquico':
        case 'Departamental':
            return ['Público', 'Privado'];
        case 'Público':
        default:
            return ['Público'];
    }
};

export function ProcesosProvider({ children }: { children: ReactNode }) {
  const [procesos, setProcesos] = useState<CapturedProcess[]>([]);
  const [isLoadingProcesos, setIsLoadingProcesos] = useState(true);
  const { addLogEntry } = useActivityLog();
  const { user, loading: authLoading } = useAuth();
  const { exceptions, isLoadingExceptions } = useExceptions();

  useEffect(() => {
    if (authLoading || isLoadingExceptions) {
      setIsLoadingProcesos(true);
      return;
    }

    if (!user) {
      setProcesos([]);
      setIsLoadingProcesos(false);
      return;
    }

    const q = query(collection(db, PROCESOS_COLLECTION));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const allProcesos = snapshot.docs.map(doc => {
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
                politicasAsociadas: Array.isArray(data.politicasAsociadas) ? data.politicasAsociadas : [],
            } as CapturedProcess;
        });
        
        if (user.rol === 'Administrador') {
            setProcesos(allProcesos);
        } else {
            const allowedClassifications = getAllowedClassifications(user.nivelAcceso);
            const userExceptions = exceptions.filter(ex => ex.userId === user.uid && (!ex.expiresAt || new Date(ex.expiresAt) > new Date()) && ex.documentType === 'proceso');

            const includeIds = new Set(userExceptions.filter(ex => ex.exceptionType === 'INCLUDE').map(ex => ex.documentId));
            const excludeIds = new Set(userExceptions.filter(ex => ex.exceptionType === 'EXCLUDE').map(ex => ex.documentId));

            const filtered = allProcesos.filter(proc => {
                if (excludeIds.has(proc.id)) return false;
                if (includeIds.has(proc.id)) return true;
                return allowedClassifications.includes(proc.clasificacion);
            });
            setProcesos(filtered);
        }
        setIsLoadingProcesos(false);
    }, (error) => {
        console.error("Error fetching procesos: ", error);
        toast({ title: "Error de Red", description: "No se pudieron cargar los procesos.", variant: "destructive" });
        setIsLoadingProcesos(false);
    });

    return () => unsubscribe();
  }, [user, authLoading, exceptions, isLoadingExceptions]);

  const addProceso = useCallback(async (data: CapturaFormData): Promise<CapturedProcess | null> => {
    try {
        const codigo = `PR-${Date.now().toString().slice(-6)}`;
        const docRef = await addDoc(collection(db, PROCESOS_COLLECTION), {
          ...data,
          codigo,
          capturedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          activo: true,
          historialDeCambios: [],
        });
        addLogEntry({ action: 'create', entityType: 'Proceso', entityName: data.proceso, details: `Se capturó el nuevo proceso "${data.proceso}" (${codigo}).` });
        return {
            ...data,
            id: docRef.id,
            codigo,
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
