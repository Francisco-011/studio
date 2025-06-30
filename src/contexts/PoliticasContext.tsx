
'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';
import { useActivityLog } from './ActivityLogContext';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, Timestamp } from 'firebase/firestore';
import type { clasificacionOptions } from './ProcesosContext';

export const nivelesCompliance = ["Obligatorio", "Recomendado", "Informativo"] as const;
export type NivelCompliance = typeof nivelesCompliance[number];

export interface Politica {
  id: string;
  codigo: string;
  titulo: string;
  descripcion: string;
  areaResponsable: string;
  departamentoResponsable?: string;
  clasificacion: typeof clasificacionOptions[number];
  nivelCompliance: NivelCompliance;
  fechaVigencia: string; // ISO string
  fechaRevision: string; // ISO string
  procesosAsociadosIds: string[];
  actividadesAsociadasIds: string[];
  createdAt: number;
  updatedAt: number;
}

export type PoliticaCreationData = Omit<Politica, 'id' | 'codigo' | 'createdAt' | 'updatedAt'>;

interface PoliticasContextType {
  politicas: Politica[];
  addPolitica: (data: PoliticaCreationData) => Promise<void>;
  updatePolitica: (id: string, data: Partial<PoliticaCreationData>) => Promise<void>;
  deletePolitica: (id: string) => Promise<void>;
  isLoadingPoliticas: boolean;
}

const PoliticasContext = createContext<PoliticasContextType | undefined>(undefined);

const POLITICAS_COLLECTION = 'politicas';

export function PoliticasProvider({ children }: { children: ReactNode }) {
  const [politicas, setPoliticas] = useState<Politica[]>([]);
  const [isLoadingPoliticas, setIsLoadingPoliticas] = useState(true);
  const { addLogEntry } = useActivityLog();

  useEffect(() => {
    const q = query(collection(db, POLITICAS_COLLECTION), orderBy("codigo", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const politicasData = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                createdAt: (data.createdAt as Timestamp)?.toMillis() || 0,
                updatedAt: (data.updatedAt as Timestamp)?.toMillis() || 0,
            } as Politica;
        });
        setPoliticas(politicasData);
        setIsLoadingPoliticas(false);
    }, (error) => {
        console.error("Error fetching politicas: ", error);
        toast({ title: "Error de Red", description: "No se pudieron cargar las políticas.", variant: "destructive" });
        setIsLoadingPoliticas(false);
    });

    return () => unsubscribe();
  }, []);

  const addPolitica = useCallback(async (data: PoliticaCreationData) => {
    try {
        const codigo = `PO-${Date.now().toString().slice(-6)}`;
        await addDoc(collection(db, POLITICAS_COLLECTION), {
          ...data,
          codigo,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        addLogEntry({ action: 'create', entityType: 'Política', entityName: data.titulo, details: `Se creó la política "${data.titulo}" (${codigo}).` });
    } catch(e) {
        console.error("Error adding política:", e);
        toast({ title: "Error", description: "No se pudo agregar la política.", variant: "destructive"});
    }
  }, [addLogEntry]);

  const updatePolitica = useCallback(async (id: string, data: Partial<PoliticaCreationData>) => {
    const politicaDocRef = doc(db, POLITICAS_COLLECTION, id);
    const originalPolitica = politicas.find(p => p.id === id);
    if (!originalPolitica) return;

    try {
      await updateDoc(politicaDocRef, { ...data, updatedAt: serverTimestamp() });
      addLogEntry({ action: 'update', entityType: 'Política', entityName: data.titulo || originalPolitica.titulo, details: `Se actualizó la política "${originalPolitica.titulo}".` });
    } catch(e) {
      console.error("Error updating política:", e);
      toast({ title: "Error", description: "No se pudo actualizar la política.", variant: "destructive" });
    }
  }, [politicas, addLogEntry]);


  const deletePolitica = useCallback(async (id: string) => {
    const politicaToDelete = politicas.find(p => p.id === id);
    if (!politicaToDelete) return;

    try {
      await deleteDoc(doc(db, POLITICAS_COLLECTION, id));
      addLogEntry({ action: 'delete', entityType: 'Política', entityName: politicaToDelete.titulo, details: `Se eliminó la política "${politicaToDelete.titulo}".` });
    } catch(e) {
      console.error("Error deleting política:", e);
      toast({ title: "Error", description: "No se pudo eliminar la política.", variant: "destructive" });
    }
  }, [politicas, addLogEntry]);

  return (
    <PoliticasContext.Provider value={{
      politicas,
      addPolitica,
      updatePolitica,
      deletePolitica,
      isLoadingPoliticas
    }}>
      {children}
    </PoliticasContext.Provider>
  );
}

export function usePoliticas(): PoliticasContextType {
  const context = useContext(PoliticasContext);
  if (context === undefined) {
    throw new Error('usePoliticas must be used within a PoliticasProvider');
  }
  return context;
}
