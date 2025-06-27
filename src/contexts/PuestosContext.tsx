
'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useActivityLog } from './ActivityLogContext';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';

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
  createdAt?: any;
}

export type PuestoCreationData = Omit<Puesto, 'id' | 'createdAt'>;

interface PuestosContextType {
  puestos: Puesto[];
  addPuesto: (data: PuestoCreationData) => Promise<void>;
  updatePuesto: (id: string, data: PuestoCreationData) => Promise<void>;
  deletePuesto: (id: string) => Promise<void>;
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
      await addDoc(collection(db, PUESTOS_COLLECTION), {
        ...data,
        createdAt: serverTimestamp(),
      });
      addLogEntry({ action: 'create', entityType: 'Puesto', entityName: data.nombre, details: `Se creó el puesto "${data.nombre}".` });
    } catch(e) {
      console.error("Error adding puesto: ", e);
      toast({ title: "Error", description: "No se pudo agregar el puesto.", variant: "destructive"});
    }
  }, [addLogEntry]);

  const updatePuesto = useCallback(async (id: string, data: PuestoCreationData) => {
    const puestoDocRef = doc(db, PUESTOS_COLLECTION, id);
    const originalPuesto = puestos.find(p => p.id === id);
    try {
      // Ensure no undefined fields are sent, which Firestore might reject
      const updateData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));
      await updateDoc(puestoDocRef, updateData);
      if (originalPuesto && originalPuesto.nombre !== data.nombre) {
        addLogEntry({ action: 'update', entityType: 'Puesto', entityName: data.nombre, details: `El puesto "${originalPuesto.nombre}" fue renombrado a "${data.nombre}".` });
      }
    } catch(e) {
      console.error("Error updating puesto: ", e);
      toast({ title: "Error", description: "No se pudo actualizar el puesto.", variant: "destructive"});
    }
  }, [puestos, addLogEntry]);

  const deletePuesto = useCallback(async (id: string) => {
    const puestoToDelete = puestos.find(p => p.id === id);
    if (!puestoToDelete) return;
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
