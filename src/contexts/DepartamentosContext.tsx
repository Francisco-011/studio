
'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useActivityLog } from './ActivityLogContext';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, where, getDocs } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { usePuestos } from './PuestosContext';


export interface Departamento {
  id: string;
  nombre: string;
  areaId: string;
  createdAt?: any;
}

interface DepartamentosContextType {
  departamentos: Departamento[];
  addDepartamento: (nombre: string, areaId: string) => Promise<void>;
  updateDepartamento: (id: string, nombre: string, areaId: string) => Promise<void>;
  deleteDepartamento: (id: string, checkUsage: (deptoId: string) => { isUsed: boolean; message: string }) => Promise<void>;
  isLoading: boolean;
}

const DepartamentosContext = createContext<DepartamentosContextType | undefined>(undefined);

const DEPARTAMENTOS_COLLECTION = 'departamentos';

export function DepartamentosProvider({ children }: { children: ReactNode }) {
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { addLogEntry } = useActivityLog();

  useEffect(() => {
    const q = query(collection(db, DEPARTAMENTOS_COLLECTION), orderBy("nombre", "asc"));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const deparamentosData: Departamento[] = [];
      querySnapshot.forEach((doc) => {
        deparamentosData.push({ id: doc.id, ...doc.data() } as Departamento);
      });
      setDepartamentos(deparamentosData);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching departamentos from Firestore: ", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);
  
  const addDepartamento = useCallback(async (nombre: string, areaId: string) => {
    try {
      await addDoc(collection(db, DEPARTAMENTOS_COLLECTION), {
        nombre,
        areaId,
        createdAt: serverTimestamp(),
      });
      addLogEntry({ action: 'create', entityType: 'Departamento', entityName: nombre, details: `Se creó el departamento "${nombre}".` });
    } catch(e) {
      console.error("Error adding departamento: ", e);
      toast({ title: "Error", description: "No se pudo agregar el departamento.", variant: "destructive"});
    }
  }, [addLogEntry]);

  const updateDepartamento = useCallback(async (id: string, nombre: string, areaId: string) => {
    const deptoDocRef = doc(db, DEPARTAMENTOS_COLLECTION, id);
    const originalDepto = departamentos.find(d => d.id === id);
    try {
      await updateDoc(deptoDocRef, { nombre, areaId });
      if (originalDepto && originalDepto.nombre !== nombre) {
       addLogEntry({ action: 'update', entityType: 'Departamento', entityName: nombre, details: `El departamento "${originalDepto.nombre}" fue renombrado a "${nombre}".` });
      }
    } catch(e) {
      console.error("Error updating departamento: ", e);
      toast({ title: "Error", description: "No se pudo actualizar el departamento.", variant: "destructive"});
    }
  }, [departamentos, addLogEntry]);

  const deleteDepartamento = useCallback(async (id: string, checkUsage: (deptoId: string) => { isUsed: boolean; message: string }) => {
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

    const deptoToDelete = departamentos.find(d => d.id === id);
    if(deptoToDelete){
      try {
        await deleteDoc(doc(db, DEPARTAMENTOS_COLLECTION, id));
        addLogEntry({ action: 'delete', entityType: 'Departamento', entityName: deptoToDelete.nombre, details: `Se eliminó el departamento "${deptoToDelete.nombre}".` });
        toast({ title: "Departamento Eliminado", variant: "destructive"});
      } catch(e) {
        console.error("Error deleting departamento: ", e);
        toast({ title: "Error", description: "No se pudo eliminar el departamento.", variant: "destructive"});
      }
    }
  }, [departamentos, addLogEntry]);

  return (
    <DepartamentosContext.Provider value={{ departamentos, addDepartamento, updateDepartamento, deleteDepartamento, isLoading }}>
      {children}
    </DepartamentosContext.Provider>
  );
}

export function useDepartamentos(): DepartamentosContextType {
  const context = useContext(DepartamentosContext);
  if (context === undefined) {
    throw new Error('useDepartamentos must be used within a DepartamentosProvider');
  }
  return context;
}
