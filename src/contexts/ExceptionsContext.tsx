
'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, query, orderBy, Timestamp } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { useActivityLog } from './ActivityLogContext';
import { useAuth } from './AuthContext';

export type ExceptionType = 'INCLUDE' | 'EXCLUDE';
export type DocumentType = 'politica' | 'proceso';

export interface AccessException {
  id: string;
  userId: string;
  documentId: string;
  documentType: DocumentType;
  exceptionType: ExceptionType;
  expiresAt?: string; // ISO string
  justification: string;
  createdAt: number;
  createdBy: string;
}

export type AccessExceptionCreationData = Omit<AccessException, 'id' | 'createdAt' | 'createdBy'>;

interface ExceptionsContextType {
  exceptions: AccessException[];
  addException: (data: AccessExceptionCreationData) => Promise<void>;
  deleteException: (id: string) => Promise<void>;
  isLoadingExceptions: boolean;
}

const ExceptionsContext = createContext<ExceptionsContextType | undefined>(undefined);

const EXCEPTIONS_COLLECTION = 'access_exceptions';

export function ExceptionsProvider({ children }: { children: ReactNode }) {
  const [exceptions, setExceptions] = useState<AccessException[]>([]);
  const [isLoadingExceptions, setIsLoadingExceptions] = useState(true);
  const { addLogEntry } = useActivityLog();
  const { user } = useAuth();

  useEffect(() => {
    const q = query(collection(db, EXCEPTIONS_COLLECTION), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const exceptionsData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: (data.createdAt as Timestamp)?.toMillis() || 0,
        } as AccessException;
      });
      setExceptions(exceptionsData);
      setIsLoadingExceptions(false);
    }, (error) => {
      console.error("Error fetching exceptions:", error);
      toast({ title: "Error", description: "No se pudieron cargar las excepciones de acceso.", variant: "destructive" });
      setIsLoadingExceptions(false);
    });

    return () => unsubscribe();
  }, []);

  const addException = useCallback(async (data: AccessExceptionCreationData) => {
    if (!user) {
      toast({ title: "Error de autenticación", variant: "destructive" });
      return;
    }
    try {
      const payload: { [key: string]: any } = {
        ...data,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
      };
      Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);
      
      await addDoc(collection(db, EXCEPTIONS_COLLECTION), payload);
      toast({ title: "Excepción Creada", description: "La regla de excepción ha sido registrada." });
      addLogEntry({ action: 'create', entityType: 'Excepción de Acceso', entityName: `${data.exceptionType}: ${data.documentType} ${data.documentId}`, details: `Se creó una excepción para el usuario ID ${data.userId}.` });
    } catch (e) {
      console.error("Error adding exception:", e);
      toast({ title: "Error", description: "No se pudo crear la excepción.", variant: "destructive" });
    }
  }, [user, addLogEntry]);

  const deleteException = useCallback(async (id: string) => {
    const exceptionToDelete = exceptions.find(ex => ex.id === id);
    if (!exceptionToDelete) return;
    try {
      await deleteDoc(doc(db, EXCEPTIONS_COLLECTION, id));
      toast({ title: "Excepción Eliminada", variant: "destructive" });
      addLogEntry({ action: 'delete', entityType: 'Excepción de Acceso', entityName: `${exceptionToDelete.exceptionType}: ${exceptionToDelete.documentType} ${exceptionToDelete.documentId}`, details: `Se eliminó una excepción para el usuario ID ${exceptionToDelete.userId}.` });
    } catch (e) {
      console.error("Error deleting exception:", e);
      toast({ title: "Error", description: "No se pudo eliminar la excepción.", variant: "destructive" });
    }
  }, [exceptions, addLogEntry]);

  return (
    <ExceptionsContext.Provider value={{ exceptions, addException, deleteException, isLoadingExceptions }}>
      {children}
    </ExceptionsContext.Provider>
  );
}

export function useExceptions(): ExceptionsContextType {
  const context = useContext(ExceptionsContext);
  if (context === undefined) {
    throw new Error('useExceptions must be used within an ExceptionsProvider');
  }
  return context;
}
