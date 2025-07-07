
'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, Timestamp } from 'firebase/firestore';
import { toast } from '@/hooks/use-toast';
import { useActivityLog } from './ActivityLogContext';

// Re-using types from the audit page
const findingTypes = ["Conforme", "No Conforme", "Oportunidad de Mejora"] as const;
export type FindingType = typeof findingTypes[number];

const auditStatuses = ["En Progreso", "Completada", "Cancelada"] as const;
export type AuditStatus = typeof auditStatuses[number];

const auditTypes = ["proceso", "puesto", "sistema", "politica", "procedimiento"] as const;
export type AuditType = typeof auditTypes[number];

export interface AuditFinding {
  id: string;
  type: FindingType;
  description: string;
  proposedAction?: string;
  isActionCreated: boolean;
}

export interface Audit {
  id: string;
  auditType: AuditType;
  targetId: string;
  targetName: string;
  processIdsToAudit?: string[];
  auditorName: string;
  auditDate: string; // ISO string
  status: AuditStatus;
  findings: AuditFinding[];
  createdAt: number;
}

export type AuditCreationData = Omit<Audit, 'id' | 'createdAt'>;

interface AuditsContextType {
  audits: Audit[];
  addAudit: (data: AuditCreationData) => Promise<string | null>;
  updateAudit: (id: string, data: Partial<AuditCreationData>) => Promise<void>;
  deleteAudit: (id: string) => Promise<void>;
  isLoadingAudits: boolean;
}

const AuditsContext = createContext<AuditsContextType | undefined>(undefined);

const AUDITS_COLLECTION = 'audits';

export function AuditsProvider({ children }: { children: ReactNode }) {
  const [audits, setAudits] = useState<Audit[]>([]);
  const [isLoadingAudits, setIsLoadingAudits] = useState(true);
  const { addLogEntry } = useActivityLog();

  useEffect(() => {
    const q = query(collection(db, AUDITS_COLLECTION), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const auditsData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: (data.createdAt as Timestamp)?.toMillis() || 0,
        } as Audit;
      });
      setAudits(auditsData);
      setIsLoadingAudits(false);
    }, (error) => {
      console.error("Error fetching audits: ", error);
      toast({ title: "Error", description: "No se pudieron cargar las auditorías.", variant: "destructive" });
      setIsLoadingAudits(false);
    });

    return () => unsubscribe();
  }, []);

  const addAudit = useCallback(async (data: AuditCreationData): Promise<string | null> => {
    try {
      const payload = { ...data, createdAt: serverTimestamp() };
      const docRef = await addDoc(collection(db, AUDITS_COLLECTION), payload);
      addLogEntry({ action: 'create', entityType: 'Auditoría', entityName: data.targetName, details: `Se inició una nueva auditoría para ${data.auditType}: "${data.targetName}".` });
      return docRef.id;
    } catch (e) {
      console.error("Error adding audit:", e);
      toast({ title: "Error", description: "No se pudo iniciar la auditoría.", variant: "destructive" });
      return null;
    }
  }, [addLogEntry]);

  const updateAudit = useCallback(async (id: string, data: Partial<AuditCreationData>) => {
    const auditDocRef = doc(db, AUDITS_COLLECTION, id);
    try {
      await updateDoc(auditDocRef, data);
    } catch (e) {
      console.error("Error updating audit:", e);
      toast({ title: "Error", description: "No se pudo actualizar la auditoría.", variant: "destructive" });
    }
  }, []);

  const deleteAudit = useCallback(async (id: string) => {
    const auditToDelete = audits.find(a => a.id === id);
    if (!auditToDelete) return;
    try {
      await deleteDoc(doc(db, AUDITS_COLLECTION, id));
      addLogEntry({ action: 'delete', entityType: 'Auditoría', entityName: auditToDelete.targetName, details: `Se eliminó la auditoría para "${auditToDelete.targetName}".` });
      toast({ title: "Auditoría Eliminada", variant: "destructive" });
    } catch (e) {
      console.error("Error deleting audit:", e);
      toast({ title: "Error", description: "No se pudo eliminar la auditoría.", variant: "destructive" });
    }
  }, [audits, addLogEntry]);

  return (
    <AuditsContext.Provider value={{ audits, addAudit, updateAudit, deleteAudit, isLoadingAudits }}>
      {children}
    </AuditsContext.Provider>
  );
}

export function useAudits(): AuditsContextType {
  const context = useContext(AuditsContext);
  if (context === undefined) {
    throw new Error('useAudits must be used within an AuditsProvider');
  }
  return context;
}
