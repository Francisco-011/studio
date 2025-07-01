
'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';
import { useActivityLog } from './ActivityLogContext';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, Timestamp, where } from 'firebase/firestore';
import type { clasificacionOptions } from './ProcesosContext';
import type { CambioHistorial } from './ActividadesContext';
import { useAuth } from './AuthContext';
import type { NivelAcceso } from '@/app/(app)/usuarios/page';

export const nivelesCompliance = ["Obligatorio", "Recomendado", "Informativo"] as const;
export type NivelCompliance = typeof nivelesCompliance[number];

export const politicaEstados = ["Borrador", "En Revisión", "Aprobada", "Archivada"] as const;
export type PoliticaEstado = typeof politicaEstados[number];

export const politicaLinkTypes = ["Aplica a", "Regula", "Complementa", "Requiere", "Implementa"] as const;
export type PoliticaLinkType = typeof politicaLinkTypes[number];

export interface PoliticaVinculo {
  policyId: string;
  linkType: PoliticaLinkType;
}

export interface Politica {
  id: string;
  codigo: string;
  titulo: string;
  descripcion: string;
  estado: PoliticaEstado;
  areaResponsable: string;
  departamentoResponsable?: string;
  clasificacion: typeof clasificacionOptions[number];
  nivelCompliance: NivelCompliance;
  fechaVigencia: string; // ISO string
  fechaRevision: string; // ISO string
  createdAt: number;
  updatedAt: number;
  consecuenciasIncumplimiento?: string;
  referenciasLegales?: string;
  historialDeCambios?: CambioHistorial[];
  procesosAsociadosIds?: string[];
  procedimientosAsociadosIds?: string[];
  actividadesAsociadasIds?: string[];
}

export type PoliticaCreationData = Omit<Politica, 'id' | 'codigo' | 'createdAt' | 'updatedAt' | 'historialDeCambios'>;

interface PoliticasContextType {
  politicas: Politica[];
  addPolitica: (data: Omit<PoliticaCreationData, 'estado'>) => Promise<string | null>;
  updatePolitica: (id: string, data: Partial<Omit<PoliticaCreationData, 'estado'>>) => Promise<void>;
  updatePoliticaStatus: (id: string, estado: PoliticaEstado) => Promise<void>;
  deletePolitica: (id: string) => Promise<void>;
  isLoadingPoliticas: boolean;
}

const PoliticasContext = createContext<PoliticasContextType | undefined>(undefined);

const POLITICAS_COLLECTION = 'politicas';

export function PoliticasProvider({ children }: { children: ReactNode }) {
  const [politicas, setPoliticas] = useState<Politica[]>([]);
  const [isLoadingPoliticas, setIsLoadingPoliticas] = useState(true);
  const { addLogEntry } = useActivityLog();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
        setPoliticas([]);
        setIsLoadingPoliticas(false);
        return;
    }
    
    const userLevel = user.nivelAcceso;
    const allowedClassifications: string[] = ['Público'];
    if (userLevel === 'Confidencial') {
      allowedClassifications.push('Privado', 'Confidencial');
    } else if (userLevel === 'Ejecutivo' || userLevel === 'Jerárquico' || userLevel === 'Departamental') {
      allowedClassifications.push('Privado');
    }

    if (allowedClassifications.length === 0) {
      setPoliticas([]);
      setIsLoadingPoliticas(false);
      return;
    }

    const q = query(
      collection(db, POLITICAS_COLLECTION),
      where("clasificacion", "in", allowedClassifications),
      orderBy("codigo", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const politicasData = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                createdAt: (data.createdAt as Timestamp)?.toMillis() || 0,
                updatedAt: (data.updatedAt as Timestamp)?.toMillis() || 0,
                historialDeCambios: data.historialDeCambios || [],
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
  }, [user, authLoading]);

  const addPolitica = useCallback(async (data: Omit<PoliticaCreationData, 'estado'>): Promise<string | null> => {
    try {
        const codigo = `PO-${Date.now().toString().slice(-6)}`;
        const docRef = await addDoc(collection(db, POLITICAS_COLLECTION), {
          ...data,
          codigo,
          estado: 'Borrador', // Default state
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          historialDeCambios: [],
        });
        addLogEntry({ action: 'create', entityType: 'Política', entityName: data.titulo, details: `Se creó la política "${data.titulo}" (${codigo}).` });
        return docRef.id;
    } catch(e) {
        console.error("Error adding política:", e);
        toast({ title: "Error", description: "No se pudo agregar la política.", variant: "destructive"});
        return null;
    }
  }, [addLogEntry]);

  const updatePolitica = useCallback(async (id: string, data: Partial<Omit<PoliticaCreationData, 'estado'>>) => {
    const politicaDocRef = doc(db, POLITICAS_COLLECTION, id);
    const originalPolitica = politicas.find(p => p.id === id);
    if (!originalPolitica) return;
    
    // An approved policy should be moved back to draft or revision to be edited.
    if (originalPolitica.estado === 'Aprobada' || originalPolitica.estado === 'Archivada') {
        toast({ title: 'Acción no permitida', description: 'Las políticas aprobadas o archivadas no pueden ser editadas directamente. Cámbielas a estado "Borrador" primero.', variant: 'default', duration: 6000 });
        return;
    }

    const changes: CambioHistorial[] = [];
    const fieldsToCompare: (keyof typeof data)[] = [
      'titulo', 'descripcion', 'areaResponsable', 'departamentoResponsable',
      'clasificacion', 'nivelCompliance', 'fechaVigencia', 'fechaRevision',
      'consecuenciasIncumplimiento', 'referenciasLegales'
    ];

    fieldsToCompare.forEach(key => {
        const originalValue = originalPolitica[key as keyof Politica] ?? '';
        const newValue = data[key as keyof PoliticaCreationData] ?? '';
        if (String(originalValue) !== String(newValue)) {
            changes.push({
                timestamp: new Date().toISOString(),
                field: key,
                before: String(originalValue),
                after: String(newValue),
            });
        }
    });

    if (changes.length > 0) {
      try {
        await updateDoc(politicaDocRef, {
          ...data,
          updatedAt: serverTimestamp(),
          historialDeCambios: [...(originalPolitica.historialDeCambios || []), ...changes]
        });
        addLogEntry({ action: 'update', entityType: 'Política', entityName: data.titulo || originalPolitica.titulo, details: `Se actualizó la política "${originalPolitica.titulo}".` });
        toast({ title: "Política Actualizada", description: `${changes.length} campo(s) fueron modificados.` });
      } catch(e) {
        console.error("Error updating política: ", e);
        toast({ title: "Error", description: "No se pudo actualizar la política.", variant: "destructive" });
      }
    } else {
      toast({ title: "Sin Cambios", description: "No se detectaron modificaciones para guardar.", variant: "default" });
    }
  }, [politicas, addLogEntry]);
  
  const updatePoliticaStatus = useCallback(async (id: string, estado: PoliticaEstado) => {
    const politicaDocRef = doc(db, POLITICAS_COLLECTION, id);
    const originalPolitica = politicas.find(p => p.id === id);
    if (!originalPolitica) return;

    const change: CambioHistorial = {
      timestamp: new Date().toISOString(),
      field: 'estado',
      before: originalPolitica.estado,
      after: estado,
    };
    
    try {
      await updateDoc(politicaDocRef, { 
        estado, 
        updatedAt: serverTimestamp(),
        historialDeCambios: [...(originalPolitica.historialDeCambios || []), change]
      });
      addLogEntry({ action: 'status_change', entityType: 'Política', entityName: originalPolitica.titulo, details: `El estado de la política "${originalPolitica.titulo}" cambió a "${estado}".` });
      toast({ title: "Estado Actualizado", description: `La política ahora está en estado "${estado}".` });
    } catch (e) {
      console.error("Error updating política status: ", e);
      toast({ title: "Error", description: "No se pudo actualizar el estado de la política.", variant: "destructive"});
    }
  }, [politicas, addLogEntry]);


  const deletePolitica = useCallback(async (id: string) => {
    const politicaToDelete = politicas.find(p => p.id === id);
    if (!politicaToDelete) return;
    
    if (politicaToDelete.estado === 'Aprobada' || politicaToDelete.estado === 'Archivada') {
       toast({ title: "Eliminación Bloqueada", description: "No se pueden eliminar políticas aprobadas o archivadas.", variant: 'destructive'});
       return;
    }

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
      updatePoliticaStatus,
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
