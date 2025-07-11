

'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, Timestamp, writeBatch, getDocs, where } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { useActivityLog } from './ActivityLogContext';
import { z } from 'zod';
import type { PoliticaLinkType, PoliticaVinculo } from './PoliticasContext';
import { useAuth } from './AuthContext';
import { useExceptions } from './ExceptionsContext';
import type { NivelAcceso } from '@/app/(app)/usuarios/page';
import { useProcedimientos, type Procedimiento } from './ProcedimientosContext';
import { usePuestos } from './PuestosContext';
import type { Moneda } from './AccionesContext';


export const frecuenciaOptions = ["Diario", "Semanal", "Quincenal", "Mensual", "Bimestral", "Trimestral", "Semestral", "Anual", "A demanda", "Otro"] as const;
export const monedaOptions = ["USD", "MXN", "EUR", "CAD", "GBP"] as const;
export const clasificacionOptions = ["Público", "Privado", "Confidencial"] as const;
export const auditFrequencyOptions = [
    { label: "Cada mes", value: 30 },
    { label: "Cada 3 meses (Trimestral)", value: 90 },
    { label: "Cada 6 meses (Semestral)", value: 180 },
    { label: "Cada año (Anual)", value: 365 },
    { label: "Cada 2 años", value: 730 },
];


export const capturaFormSchema = z.object({
  area: z.string({ required_error: "El área es requerida."}).min(1, "El área es requerida."),
  departamento: z.string().optional(),
  puesto: z.string({ required_error: "El puesto es requerido."}).min(1, "El puesto es requerido."),
  proceso: z.string().min(3, "El nombre del proceso es requerido y debe tener al menos 3 caracteres."),
  descripcion: z.string().min(1, "La descripción del proceso es requerida."),
  procedimientoOrder: z.array(z.string()).optional().default([]),
  auditFrequencyInDays: z.preprocess(
    (val) => (String(val).trim() === '' ? undefined : parseInt(String(val), 10)),
    z.number().int().optional()
  ),
  lastAuditedAt: z.string().optional(),
  politicasAsociadas: z.array(z.object({
    policyId: z.string(),
    linkType: z.string(),
  })).optional().default([]),
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
  puestoId?: string;
  // Calculated fields
  tiempoEstimado?: number;
  costoEstimado?: number;
  monedaCosto?: Moneda;
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
  const { puestos } = usePuestos();
  const { exceptions, isLoadingExceptions } = useExceptions();
  const { procedimientos, isLoadingProcedimientos } = useProcedimientos();

  const getSubordinateHierarchy = useCallback((userId: string | undefined): Set<string> => {
    const subordinatePuestos = new Set<string>();
    if (!userId) return subordinatePuestos;

    const directReports = puestos.filter(p => p.jefeInmediato === userId);
    const queue = [...directReports];

    while (queue.length > 0) {
        const currentPuesto = queue.shift();
        if (currentPuesto && !subordinatePuestos.has(currentPuesto.id)) {
            subordinatePuestos.add(currentPuesto.id);
            const reportsOfCurrent = puestos.filter(p => p.jefeInmediato === currentPuesto.id);
            queue.push(...reportsOfCurrent);
        }
    }
    return subordinatePuestos;
  }, [puestos]);

  useEffect(() => {
    if (authLoading || isLoadingExceptions || isLoadingProcedimientos) {
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
        const allProcesosFromDB = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                capturedAt: (data.capturedAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
                updatedAt: (data.updatedAt as Timestamp)?.toMillis() || (data.capturedAt as Timestamp)?.toMillis() || Date.now(),
                deletedAt: (data.deletedAt as Timestamp)?.toDate().toISOString(),
                politicasAsociadas: Array.isArray(data.politicasAsociadas) ? data.politicasAsociadas : [],
            } as CapturedProcess;
        });
        
        if (user.rol === 'Administrador') {
            setProcesos(allProcesosFromDB);
        } else {
            const allowedClassifications = getAllowedClassifications(user.nivelAcceso);
            const userExceptions = exceptions.filter(ex => ex.userId === user.uid && (!ex.expiresAt || new Date(ex.expiresAt) > new Date()) && ex.documentType === 'proceso');

            const includeProcessIds = new Set(userExceptions.filter(ex => ex.exceptionType === 'INCLUDE').map(ex => ex.documentId));
            const excludeProcessIds = new Set(userExceptions.filter(ex => ex.exceptionType === 'EXCLUDE').map(ex => ex.documentId));
            
            const subordinatePuestoIds = getSubordinateHierarchy(user.puestoId);
            if(user.puestoId) subordinatePuestoIds.add(user.puestoId);
            
            const visibleProcesses = allProcesosFromDB.filter(proc => {
                if (excludeProcessIds.has(proc.id)) return false;
                if (includeProcessIds.has(proc.id)) return true;

                if (!proc.procedimientoOrder || proc.procedimientoOrder.length === 0) {
                    return false;
                }

                const hasVisibleProcedure = proc.procedimientoOrder.some(procId => {
                    const procedure = procedimientos.find(p => p.id === procId);
                    if (!procedure) return false;

                    const classificationAllowed = allowedClassifications.includes(procedure.clasificacion);
                    if (!classificationAllowed) return false;

                    if (procedure.clasificacion === 'Público') return true;
                    
                    if (user.nivelAcceso === 'Departamental') {
                        return proc.puestoId ? puestos.find(p => p.id === proc.puestoId)?.departamentoId === user.departamentoId : false;
                    }

                    if (user.nivelAcceso === 'Jerárquico' || user.nivelAcceso === 'Ejecutivo') {
                        return proc.puestoId ? subordinatePuestoIds.has(proc.puestoId) : false;
                    }
                    
                    return true;
                });

                return hasVisibleProcedure;
            });

            setProcesos(visibleProcesses);
        }
        setIsLoadingProcesos(false);
    }, (error) => {
        console.error("Error fetching procesos: ", error);
        toast({ title: "Error de Red", description: "No se pudieron cargar los procesos.", variant: "destructive" });
        setIsLoadingProcesos(false);
    });

    return () => unsubscribe();
  }, [user, authLoading, exceptions, isLoadingExceptions, procedimientos, isLoadingProcedimientos, puestos, getSubordinateHierarchy]);

  const addProceso = useCallback(async (data: CapturaFormData): Promise<CapturedProcess | null> => {
    try {
        const codigo = `PR-${Date.now().toString().slice(-6)}`;
        const payload: { [key: string]: any } = {
          ...data,
          codigo,
          capturedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          activo: true,
          historialDeCambios: [],
        };
        Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);
        const docRef = await addDoc(collection(db, PROCESOS_COLLECTION), payload);
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

        const changes: CambioHistorial[] = [];
        const fieldsToCompare: (keyof typeof data)[] = [
            'proceso', 'area', 'puesto', 'departamento', 'descripcion', 'procedimientoOrder',
            'tiempoEstimado', 'costoEstimado', 'monedaCosto', 'auditFrequencyInDays'
        ];

        fieldsToCompare.forEach(key => {
            if(data[key] !== undefined && originalProceso[key as keyof CapturedProcess] !== data[key]) {
                changes.push({
                    timestamp: new Date().toISOString(),
                    field: key,
                    before: originalProceso[key as keyof CapturedProcess] ?? 'No especificado',
                    after: data[key] ?? 'No especificado'
                });
            }
        });
        
        const dataWithHistory: {[key: string]: any} = {
            ...data,
            updatedAt: serverTimestamp(),
            historialDeCambios: [...(originalProceso.historialDeCambios || []), ...changes]
        };
        Object.keys(dataWithHistory).forEach(key => dataWithHistory[key] === undefined && delete dataWithHistory[key]);
        await updateDoc(procesoDocRef, dataWithHistory);

        if (changes.length > 0) {
           addLogEntry({ action: 'update', entityType: 'Proceso', entityName: data.proceso || originalProceso.proceso, details: `Se actualizó el proceso "${originalProceso.proceso}".` });
        }
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
          await updateDoc(procesoDocRef, { deletedAt: serverTimestamp(), updatedAt: serverTimestamp(), activo: false });
          addLogEntry({ action: 'delete', entityType: 'Proceso', entityName: procesoToDelete.proceso, details: `Proceso "${procesoToDelete.proceso}" movido a la papelera.` });
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
      } catch (e) {
          console.error("Error restoring proceso: ", e);
          toast({ title: "Error", description: "No se pudo restaurar el proceso.", variant: "destructive" });
      }
  }, [procesos, addLogEntry]);
  
  const toggleProcesoStatus = useCallback(async (id: string) => {
    const procesoToToggle = procesos.find(p => p.id === id);
    if (!procesoToToggle) return;
    const newStatus = !(procesoToToggle.activo !== false);

    if (newStatus === false) { // Logic for deactivating
      const hasActiveChildren = (procesoToToggle.procedimientoOrder || []).some(procId => {
          const procedure = procedimientos.find(p => p.id === procId);
          return procedure && procedure.activo;
      });

      if (hasActiveChildren) {
          toast({
              title: "Acción no permitida",
              description: "No puede inactivar un proceso que tiene procedimientos activos.",
              variant: "destructive",
              duration: 5000
          });
          return;
      }
    }

    try {
        const procesoDocRef = doc(db, PROCESOS_COLLECTION, id);
        await updateDoc(procesoDocRef, { activo: newStatus, updatedAt: serverTimestamp() });
        addLogEntry({ action: 'status_change', entityType: 'Proceso', entityName: procesoToToggle.proceso, details: `El estado del proceso "${procesoToToggle.proceso}" cambió a ${newStatus ? 'Activo' : 'Inactivo'}.` });
    } catch (e) {
        console.error("Error toggling proceso status: ", e);
        toast({ title: "Error", description: "No se pudo cambiar el estado del proceso.", variant: "destructive" });
    }
  }, [procesos, addLogEntry, procedimientos]);

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
