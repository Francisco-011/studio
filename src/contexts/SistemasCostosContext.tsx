
'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';
import { useActivityLog } from './ActivityLogContext';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, where, writeBatch, getDocs } from 'firebase/firestore';


// Types for Systems and Costs
export const formasDePagoOptions = ["Transferencia", "Efectivo", "Tarjeta", "Otros"] as const;
export type FormaPago = typeof formasDePagoOptions[number];

export const frecuenciasDePagoOptions = ["Mensual", "Anual", "Otro"] as const;
export type FrecuenciaPago = typeof frecuenciasDePagoOptions[number];

export const tiposDeMonedaOptions = ["MXN", "USD", "EUR", "CAD", "GBP"] as const;
export type TipoMoneda = typeof tiposDeMonedaOptions[number];

export type SistemaScope = "Empresa" | "Área" | "Departamento" | "Puesto";
export const sistemaScopeOptions: SistemaScope[] = ["Empresa", "Área", "Departamento", "Puesto"];


export interface Sistema {
  id: string;
  nombre: string;
  scope: SistemaScope;
  scopeId?: string; // ID of Area, Department or Puesto
}

export interface SistemaCosto {
  id: string;
  sistemaId: string;
  descripcion: string;
  montoUso?: number;
  numeroLicencias?: number;
  costoPorLicencia?: number;
  formaPago?: FormaPago;
  frecuencia?: FrecuenciaPago;
  moneda?: TipoMoneda;
}

export interface SistemaCreationData extends Omit<Sistema, 'id'> {}
export interface SistemaUpdateData extends Partial<Omit<Sistema, 'id'>> {}


interface SistemasCostosContextType {
  sistemas: Sistema[];
  costosSistemas: SistemaCosto[];
  addSistema: (data: SistemaCreationData) => Promise<void>;
  updateSistema: (id: string, data: SistemaUpdateData) => Promise<void>;
  deleteSistema: (id: string, checkUsage: (sistemaId: string, sistemaName: string) => { isUsed: boolean; message: string }) => Promise<void>;
  addCostoSistema: (costoData: Omit<SistemaCosto, 'id'>) => Promise<void>;
  updateCostoSistema: (id: string, costoData: Partial<Omit<SistemaCosto, 'id' | 'sistemaId'>>) => Promise<void>;
  deleteCostoSistema: (id: string) => Promise<void>;
  isLoadingSistemasCostos: boolean;
  getCostsForSystem: (sistemaId: string) => SistemaCosto[];
}

const SistemasCostosContext = createContext<SistemasCostosContextType | undefined>(undefined);

const SISTEMAS_COLLECTION = 'sistemas';
const COSTOS_SISTEMAS_COLLECTION = 'sistemas_costos';

export function SistemasCostosProvider({ children }: { children: ReactNode }) {
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [costosSistemas, setCostosSistemas] = useState<SistemaCosto[]>([]);
  const [isLoadingSistemasCostos, setIsLoadingSistemasCostos] = useState(true);
  const { addLogEntry } = useActivityLog();

  useEffect(() => {
    setIsLoadingSistemasCostos(true);
    const qSistemas = query(collection(db, SISTEMAS_COLLECTION), orderBy("nombre", "asc"));
    const qCostos = query(collection(db, COSTOS_SISTEMAS_COLLECTION));

    const unsubSistemas = onSnapshot(qSistemas, (snapshot) => {
        setSistemas(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sistema)));
    }, (error) => console.error("Error fetching sistemas: ", error));

    const unsubCostos = onSnapshot(qCostos, (snapshot) => {
        setCostosSistemas(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SistemaCosto)));
    }, (error) => console.error("Error fetching costos: ", error));
    
    const timer = setTimeout(() => setIsLoadingSistemasCostos(false), 1500);

    return () => {
        unsubSistemas();
        unsubCostos();
        clearTimeout(timer);
    };
  }, []);

  const addSistema = useCallback(async (data: SistemaCreationData) => {
    try {
       await addDoc(collection(db, SISTEMAS_COLLECTION), {
          nombre: data.nombre,
          scope: data.scope || "Empresa",
          scopeId: data.scope === "Empresa" ? null : data.scopeId,
          createdAt: serverTimestamp(),
      });
      addLogEntry({ action: 'create', entityType: 'Sistema', entityName: data.nombre, details: `Se creó el sistema "${data.nombre}".` });
    } catch (e) {
      console.error("Error adding sistema: ", e);
      toast({ title: "Error", description: "No se pudo agregar el sistema.", variant: "destructive" });
    }
  }, [addLogEntry]);

  const updateSistema = useCallback(async (id: string, data: SistemaUpdateData) => {
    const sistemaDocRef = doc(db, SISTEMAS_COLLECTION, id);
    const originalSistema = sistemas.find(s => s.id === id);
    try {
        const updateData = { ...data };
        if (data.scope === 'Empresa') {
            updateData.scopeId = undefined;
        }
        await updateDoc(sistemaDocRef, updateData);
        if(originalSistema) {
          addLogEntry({ action: 'update', entityType: 'Sistema', entityName: data.nombre || originalSistema.nombre, details: `Se actualizó el sistema "${originalSistema.nombre}".` });
        }
    } catch (e) {
      console.error("Error updating sistema: ", e);
      toast({ title: "Error", description: "No se pudo actualizar el sistema.", variant: "destructive" });
    }
  }, [sistemas, addLogEntry]);

  const deleteSistema = useCallback(async (id: string, checkUsage: (sistemaId: string, sistemaName: string) => { isUsed: boolean; message: string }) => {
    const sistemaToDelete = sistemas.find(s => s.id === id);
    if (!sistemaToDelete) return;

    const { isUsed, message } = checkUsage(id, sistemaToDelete.nombre);
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
      const batch = writeBatch(db);
      const sistemaDocRef = doc(db, SISTEMAS_COLLECTION, id);
      batch.delete(sistemaDocRef);
      
      const costosQuery = query(collection(db, COSTOS_SISTEMAS_COLLECTION), where("sistemaId", "==", id));
      const costosSnapshot = await getDocs(costosQuery);
      costosSnapshot.forEach((costDoc) => {
          batch.delete(costDoc.ref);
      });
      
      await batch.commit();

      addLogEntry({ action: 'delete', entityType: 'Sistema', entityName: sistemaToDelete.nombre, details: `Se eliminó el sistema "${sistemaToDelete.nombre}" y sus costos asociados.` });
      toast({ title: "Sistema Eliminado", description: `El sistema "${sistemaToDelete.nombre}" y todos sus costos han sido eliminados.`, variant: "destructive"});
    } catch(e) {
       console.error("Error deleting sistema and its costs: ", e);
       toast({ title: "Error", description: "No se pudo eliminar el sistema.", variant: "destructive" });
    }
  }, [sistemas, addLogEntry]);

  const addCostoSistema = useCallback(async (costoData: Omit<SistemaCosto, 'id'>) => {
    const sistema = sistemas.find(s => s.id === costoData.sistemaId);
    try {
      await addDoc(collection(db, COSTOS_SISTEMAS_COLLECTION), {
        ...costoData,
        createdAt: serverTimestamp(),
      });
      if(sistema) {
        addLogEntry({ action: 'create', entityType: 'Costo de Sistema', entityName: sistema.nombre, details: `Se agregó un costo al sistema "${sistema.nombre}".` });
      }
    } catch (e) {
       console.error("Error adding costo: ", e);
       toast({ title: "Error", description: "No se pudo agregar el costo.", variant: "destructive" });
    }
  }, [addLogEntry, sistemas]);

  const updateCostoSistema = useCallback(async (id: string, costoData: Partial<Omit<SistemaCosto, 'id' | 'sistemaId'>>) => {
     const costoDocRef = doc(db, COSTOS_SISTEMAS_COLLECTION, id);
     const originalCosto = costosSistemas.find(c => c.id === id);
     try {
       await updateDoc(costoDocRef, costoData);
       if(originalCosto) {
          const sistema = sistemas.find(s => s.id === originalCosto.sistemaId);
          if(sistema) {
            addLogEntry({ action: 'update', entityType: 'Costo de Sistema', entityName: sistema.nombre, details: `Se actualizó un costo del sistema "${sistema.nombre}".` });
          }
       }
     } catch (e) {
       console.error("Error updating costo: ", e);
       toast({ title: "Error", description: "No se pudo actualizar el costo.", variant: "destructive" });
     }
  }, [addLogEntry, costosSistemas, sistemas]);

  const deleteCostoSistema = useCallback(async (id: string) => {
    const costoToDelete = costosSistemas.find(c => c.id === id);
    if (!costoToDelete) return;
    try {
      await deleteDoc(doc(db, COSTOS_SISTEMAS_COLLECTION, id));
      const sistema = sistemas.find(s => s.id === costoToDelete.sistemaId);
       if(sistema){
           addLogEntry({ action: 'delete', entityType: 'Costo de Sistema', entityName: sistema.nombre, details: `Se eliminó un costo del sistema "${sistema.nombre}".` });
       }
       toast({ title: "Costo Eliminado", variant: "destructive"});
    } catch (e) {
       console.error("Error deleting costo: ", e);
       toast({ title: "Error", description: "No se pudo eliminar el costo.", variant: "destructive" });
    }
  }, [addLogEntry, costosSistemas, sistemas]);

  const getCostsForSystem = useCallback((sistemaId: string) => {
    return costosSistemas.filter(costo => costo.sistemaId === sistemaId);
  }, [costosSistemas]);

  return (
    <SistemasCostosContext.Provider value={{
      sistemas,
      costosSistemas,
      addSistema,
      updateSistema,
      deleteSistema,
      addCostoSistema,
      updateCostoSistema,
      deleteCostoSistema,
      isLoadingSistemasCostos,
      getCostsForSystem,
    }}>
      {children}
    </SistemasCostosContext.Provider>
  );
}

export function useSistemasCostos(): SistemasCostosContextType {
  const context = useContext(SistemasCostosContext);
  if (context === undefined) {
    throw new Error('useSistemasCostos must be used within a SistemasCostosContext.tsx');
  }
  return context;
}
