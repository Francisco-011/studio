
'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useActivityLog } from './ActivityLogContext';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import type { TipoMoneda } from './SistemasCostosContext';

export const nivelesOrganizacionales = ["Directivo", "Gerencial", "Supervisión", "Operativo", "Administrativo"] as const;
export type NivelOrganizacional = typeof nivelesOrganizacionales[number];

export interface Puesto {
  id: string;
  nombre: string;
  areaId: string;
  departamentoId?: string;
  jefeInmediato?: string; 
  nivelOrganizacional: NivelOrganizacional;
  numeroPersonas?: number;
  auditFrequencyInDays?: number;
  lastAuditedAt?: string; // ISO String
  createdAt?: any;
  costoHora?: number;
  monedaCosto?: TipoMoneda;
}

export type PuestoCreationData = Omit<Puesto, 'id' | 'createdAt'>;

interface PuestosContextType {
  puestos: Puesto[];
  addPuesto: (data: PuestoCreationData) => Promise<void>;
  updatePuesto: (id: string, data: Partial<PuestoCreationData>) => Promise<void>;
  deletePuesto: (id: string, checkUsage: (puestoId: string, puestoName: string) => { isUsed: boolean; message: string }) => Promise<void>;
  isLoadingPuestos: boolean;
}

const PuestosContext = createContext<PuestosContextType | undefined>(undefined);

const PUESTOS_COLLECTION = 'puestos';

export function PuestosProvider({ children }: { children: ReactNode }) {
  const [puestos, setPuestos] = useState<Puesto[]>([]);
  const [isLoadingPuestos, setIsLoadingPuestos] = useState(true);
  const { addLogEntry } = useActivityLog();

  useEffect(() => {
    const q = query(collection(db, PUESTOS_COLLECTION), orderBy("nombre", "asc"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const puestosData: Puesto[] = [];
      querySnapshot.forEach((doc) => {
        puestosData.push({ id: doc.id, ...doc.data() } as Puesto);
      });
      setPuestos(puestosData);
      setIsLoadingPuestos(false);
    }, (error) => {
      console.error("Error fetching puestos from Firestore: ", error);
      setIsLoadingPuestos(false);
    });

    return () => unsubscribe();
  }, []);

  const addPuesto = useCallback(async (data: PuestoCreationData) => {
    try {
      const payload: { [key: string]: any } = {
        ...data,
        createdAt: serverTimestamp(),
      };
      Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);

      await addDoc(collection(db, PUESTOS_COLLECTION), payload);
      addLogEntry({ action: 'create', entityType: 'Puesto', entityName: data.nombre, details: `Se creó el puesto "${data.nombre}".` });
    } catch(e) {
      console.error("Error adding puesto: ", e);
      toast({ title: "Error", description: "No se pudo agregar el puesto.", variant: "destructive"});
    }
  }, [addLogEntry]);

  const updatePuesto = useCallback(async (id: string, data: Partial<PuestoCreationData>) => {
    const puestoDocRef = doc(db, PUESTOS_COLLECTION, id);
    const originalPuesto = puestos.find(p => p.id === id);
    try {
      const updateData: { [key: string]: any } = { ...data };
      Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);
      
      await updateDoc(puestoDocRef, updateData);
      if (originalPuesto && originalPuesto.nombre !== data.nombre) {
        addLogEntry({ action: 'update', entityType: 'Puesto', entityName: data.nombre || originalPuesto.nombre, details: `El puesto "${originalPuesto.nombre}" fue renombrado a "${data.nombre}".` });
      }
    } catch(e) {
      console.error("Error updating puesto: ", e);
      toast({ title: "Error", description: "No se pudo actualizar el puesto.", variant: "destructive"});
    }
  }, [puestos, addLogEntry]);

  const deletePuesto = useCallback(async (id: string, checkUsage: (puestoId: string, puestoName: string) => { isUsed: boolean; message: string }) => {
    const puestoToDelete = puestos.find(p => p.id === id);
    if (!puestoToDelete) return;
    
    const { isUsed, message } = checkUsage(id, puestoToDelete.nombre);
    if (isUsed) {
        toast({
            title: "Eliminación Bloqueada",
            description: message,
            variant: "destructive",
            duration: 7000
        });
        return;
    }

    try {
      await deleteDoc(doc(db, PUESTOS_COLLECTION, id));
      addLogEntry({ action: 'delete', entityType: 'Puesto', entityName: puestoToDelete.nombre, details: `Se eliminó el puesto "${puestoToDelete.nombre}".` });
      toast({ title: "Puesto Eliminado", variant: "destructive" });
    } catch(e) {
      console.error("Error deleting puesto: ", e);
      toast({ title: "Error", description: "No se pudo eliminar el puesto.", variant: "destructive" });
    }
  }, [puestos, addLogEntry]);

  return (
    <PuestosContext.Provider value={{ puestos, addPuesto, updatePuesto, deletePuesto, isLoadingPuestos }}>
      {children}
    </PuestosContext.Provider>
  );
}

export function usePuestos(): PuestosContextType {
  const context = useContext(PuestosContext);
  if (context === undefined) {
    throw new Error('usePuestos must be used within a PuestosProvider');
  }
  return context;
}
