

'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';
import { useActivityLog } from './ActivityLogContext';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, Timestamp, writeBatch, arrayRemove } from 'firebase/firestore';
import { clasificacionOptions } from './ProcesosContext';
import type { CambioHistorial, Actividad } from './ActividadesContext';
import type { Moneda } from './AccionesContext';
import { useActividades } from './ActividadesContext';

export interface Procedimiento {
  id: string;
  codigo: string;
  nombre: string;
  descripcion?: string;
  procesoId: string;
  activityOrder: string[];
  sistemasUtilizados?: string[];
  informacionRecibe?: string;
  procedimientosEntradaIds?: string[];
  informacionEntrega?: string;
  procedimientosSalidaIds?: string[];
  clasificacion: typeof clasificacionOptions[number];
  createdAt: number;
  updatedAt: number;
  activo: boolean;
  historialDeCambios?: CambioHistorial[];
  auditFrequencyInDays?: number;
  lastAuditedAt?: string; // ISO String
  tiempoEstimado?: number; // Sum of activities' time in minutes
  costoEstimado?: number; // Sum of activities' cost
  monedaCosto?: Moneda;
  politicasAsociadasIds?: string[];
}

export type ProcedimientoCreationData = Omit<Procedimiento, 'id' | 'codigo' | 'createdAt' | 'updatedAt' | 'historialDeCambios'>;

interface ProcedimientosContextType {
  procedimientos: Procedimiento[];
  addProcedimiento: (data: ProcedimientoCreationData) => Promise<Procedimiento | null>;
  updateProcedimiento: (id: string, data: Partial<Omit<ProcedimientoCreationData, 'activityOrder'>>) => Promise<void>;
  deleteProcedimiento: (id: string) => Promise<void>;
  toggleProcedimientoStatus: (procedimiento: Procedimiento) => Promise<void>;
  isLoadingProcedimientos: boolean;
}

const ProcedimientosContext = createContext<ProcedimientosContextType | undefined>(undefined);

const PROCEDIMIENTOS_COLLECTION = 'procedimientos';

export function ProcedimientosProvider({ children }: { children: ReactNode }) {
  const [procedimientos, setProcedimientos] = useState<Procedimiento[]>([]);
  const [isLoadingProcedimientos, setIsLoadingProcedimientos] = useState(true);
  const { addLogEntry } = useActivityLog();
  const { actividades } = useActividades();

  useEffect(() => {
    const q = query(collection(db, PROCEDIMIENTOS_COLLECTION));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => {
            const docData = doc.data();
            return {
                id: doc.id,
                ...docData,
                activo: docData.activo !== false, // Default to true if not present
                historialDeCambios: docData.historialDeCambios || [],
                createdAt: (docData.createdAt as Timestamp)?.toMillis() || 0,
                updatedAt: (docData.updatedAt as Timestamp)?.toMillis() || 0,
                sistemasUtilizados: Array.isArray(docData.sistemasUtilizados) ? docData.sistemasUtilizados : [],
                procedimientosEntradaIds: Array.isArray(docData.procedimientosEntradaIds) ? docData.procedimientosEntradaIds : [],
                procedimientosSalidaIds: Array.isArray(docData.procedimientosSalidaIds) ? docData.procedimientosSalidaIds : [],
                clasificacion: docData.clasificacion || 'Privado',
            } as Procedimiento;
        });
        setProcedimientos(data);
        setIsLoadingProcedimientos(false);
    }, (error) => {
        console.error("Error fetching procedimientos: ", error);
        toast({ title: "Error de Red", description: "No se pudieron cargar los procedimientos.", variant: "destructive" });
        setIsLoadingProcedimientos(false);
    });

    return () => unsubscribe();
  }, []);

  const addProcedimiento = useCallback(async (data: ProcedimientoCreationData): Promise<Procedimiento | null> => {
    try {
        const codigo = `PC-${Date.now().toString().slice(-6)}`;
        const payload: { [key: string]: any } = {
            ...data,
            codigo,
            activo: true,
            historialDeCambios: [],
            sistemasUtilizados: data.sistemasUtilizados || [],
            procedimientosEntradaIds: data.procedimientosEntradaIds || [],
            procedimientosSalidaIds: data.procedimientosSalidaIds || [],
            politicasAsociadasIds: data.politicasAsociadasIds || [],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };
        // Ensure no undefined values are sent to Firestore
        Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);
        
        const docRef = await addDoc(collection(db, PROCEDIMIENTOS_COLLECTION), payload);
        addLogEntry({ action: 'create', entityType: 'Procedimiento', entityName: data.nombre, details: `Se creó el procedimiento "${data.nombre}" (${codigo}).` });
        
        const currentTime = Date.now();
        const newProcedimiento: Procedimiento = {
            ...data,
            id: docRef.id,
            codigo,
            activo: true,
            historialDeCambios: [],
            sistemasUtilizados: data.sistemasUtilizados || [],
            procedimientosEntradaIds: data.procedimientosEntradaIds || [],
            procedimientosSalidaIds: data.procedimientosSalidaIds || [],
            createdAt: currentTime,
            updatedAt: currentTime,
        };
        return newProcedimiento;
    } catch(e) {
        console.error("Error adding procedimiento:", e);
        toast({ title: "Error", description: "No se pudo agregar el procedimiento.", variant: "destructive"});
        return null;
    }
  }, [addLogEntry]);

  const updateProcedimiento = useCallback(async (id: string, data: Partial<ProcedimientoCreationData>) => {
    const procedimientoDocRef = doc(db, PROCEDIMIENTOS_COLLECTION, id);
    const originalProcedimiento = procedimientos.find(p => p.id === id);
    if (!originalProcedimiento) return;

    const changes: CambioHistorial[] = [];
    const fieldsToCompare: (keyof typeof data)[] = ['nombre', 'descripcion', 'clasificacion', 'sistemasUtilizados', 'auditFrequencyInDays', 'tiempoEstimado', 'costoEstimado', 'politicasAsociadasIds', 'monedaCosto', 'procesoId'];
    
    fieldsToCompare.forEach(key => {
        const originalValue = originalProcedimiento[key as keyof Procedimiento];
        const newValue = data[key as keyof ProcedimientoCreationData];
        
        if (JSON.stringify(originalValue) !== JSON.stringify(newValue)) {
             changes.push({
                timestamp: new Date().toISOString(),
                field: key,
                before: originalValue ?? 'N/A',
                after: newValue ?? 'N/A'
             });
        }
    });

    try {
      const payload: { [key: string]: any } = { 
          ...data, 
          updatedAt: serverTimestamp(),
          historialDeCambios: [...(originalProcedimiento.historialDeCambios || []), ...changes]
      };
      
      Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);

      await updateDoc(procedimientoDocRef, payload);
      addLogEntry({ action: 'update', entityType: 'Procedimiento', entityName: data.nombre || originalProcedimiento.nombre, details: `Se actualizó el procedimiento "${originalProcedimiento.nombre}".` });
    } catch (e) {
      console.error("Error updating procedimiento: ", e);
      toast({ title: "Error", description: "No se pudo actualizar el procedimiento.", variant: "destructive"});
    }
  }, [procedimientos, addLogEntry]);
  
  const deleteProcedimiento = useCallback(async (id: string) => {
    const procedimientoToDelete = procedimientos.find(p => p.id === id);
    if (!procedimientoToDelete) return;

    if (procedimientoToDelete.activityOrder && procedimientoToDelete.activityOrder.length > 0) {
        toast({
            title: "Eliminación Bloqueada",
            description: `El procedimiento "${procedimientoToDelete.nombre}" tiene ${procedimientoToDelete.activityOrder.length} actividad(es) asignada(s). Por favor, remuévalas primero desde el Panel Jerárquico.`,
            variant: "destructive",
            duration: 7000
        });
        return;
    }

    try {
        const batch = writeBatch(db);
        const procedimientoDocRef = doc(db, PROCEDIMIENTOS_COLLECTION, id);
        batch.delete(procedimientoDocRef);

        if (procedimientoToDelete.politicasAsociadasIds && procedimientoToDelete.politicasAsociadasIds.length > 0) {
            for (const policyId of procedimientoToDelete.politicasAsociadasIds) {
                const policyRef = doc(db, 'politicas', policyId);
                batch.update(policyRef, { procedimientosAsociadosIds: arrayRemove(id) });
            }
        }
        
        await batch.commit();

        addLogEntry({ action: 'delete', entityType: 'Procedimiento', entityName: procedimientoToDelete.nombre, details: `Se eliminó el procedimiento "${procedimientoToDelete.nombre}".` });
        toast({ title: "Procedimiento Eliminado", variant: "destructive"});
    } catch(e) {
        console.error("Error deleting procedimiento: ", e);
        toast({ title: "Error", description: "No se pudo eliminar el procedimiento.", variant: "destructive"});
    }
  }, [procedimientos, addLogEntry]);

  const toggleProcedimientoStatus = useCallback(async (procedimiento: Procedimiento) => {
    const newStatus = !procedimiento.activo;
    
    if (newStatus === false) { // Logic for deactivating
      const hasActiveChildren = (procedimiento.activityOrder || []).some(actId => {
          const activity = actividades.find(a => a.id === actId);
          return activity && activity.activa;
      });

      if (hasActiveChildren) {
          toast({
              title: "Acción no permitida",
              description: "No puede inactivar un procedimiento que tiene actividades activas.",
              variant: "destructive",
              duration: 5000
          });
          return;
      }
    }

    const docRef = doc(db, PROCEDIMIENTOS_COLLECTION, procedimiento.id);
    const change: CambioHistorial = {
        timestamp: new Date().toISOString(),
        field: 'activo',
        before: procedimiento.activo,
        after: newStatus,
    };
    try {
        await updateDoc(docRef, {
            activo: newStatus,
            updatedAt: serverTimestamp(),
            historialDeCambios: [...(procedimiento.historialDeCambios || []), change],
        });
        addLogEntry({ action: 'status_change', entityType: 'Procedimiento', entityName: procedimiento.nombre, details: `El estado cambió a ${newStatus ? 'Activo' : 'Inactivo'}.` });
    } catch (e) {
        console.error("Error toggling status:", e);
        toast({ title: "Error", description: "No se pudo cambiar el estado.", variant: "destructive" });
    }
  }, [addLogEntry, actividades]);


  return (
    <ProcedimientosContext.Provider value={{ procedimientos, addProcedimiento, updateProcedimiento, deleteProcedimiento, toggleProcedimientoStatus, isLoadingProcedimientos }}>
      {children}
    </ProcedimientosContext.Provider>
  );
}

export function useProcedimientos(): ProcedimientosContextType {
  const context = useContext(ProcedimientosContext);
  if (context === undefined) {
    throw new Error('useProcedimientos must be used within a ProcedimientosProvider');
  }
  return context;
}
