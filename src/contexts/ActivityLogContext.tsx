
'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, addDoc, query, orderBy, limit, serverTimestamp, Timestamp } from 'firebase/firestore';

export type LogAction =
  | "create" | "update" | "delete" | "status_change"
  | "restore" | "analysis" | "login" | "logout";

export interface ActivityLogEntry {
  id: string;
  timestamp: number;
  user?: string;
  action: LogAction;
  entityType: string;
  entityName: string;
  details: string;
}

interface ActivityLogContextType {
  logEntries: ActivityLogEntry[];
  addLogEntry: (log: Omit<ActivityLogEntry, 'id' | 'timestamp'>) => void;
  isLoadingLog: boolean;
}

const ActivityLogContext = createContext<ActivityLogContextType | undefined>(undefined);

const LOG_COLLECTION = 'activity_log';
const MAX_LOG_ENTRIES = 500;

export function ActivityLogProvider({ children }: { children: ReactNode }) {
  const [logEntries, setLogEntries] = useState<ActivityLogEntry[]>([]);
  const [isLoadingLog, setIsLoadingLog] = useState(true);

  useEffect(() => {
    const q = query(collection(db, LOG_COLLECTION), orderBy("timestamp", "desc"), limit(MAX_LOG_ENTRIES));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const logsData = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                timestamp: (data.timestamp as Timestamp)?.toMillis() || 0
            } as ActivityLogEntry;
        });
        setLogEntries(logsData);
        setIsLoadingLog(false);
    }, (error: any) => {
        console.error("Failed to load activity log from Firestore", error.message);
        setIsLoadingLog(false);
    });

    return () => unsubscribe();
  }, []);

  const addLogEntry = useCallback((log: Omit<ActivityLogEntry, 'id' | 'timestamp'>) => {
    const newEntry = {
      ...log,
      timestamp: serverTimestamp(),
      user: log.user || 'Sistema',
    };
    addDoc(collection(db, LOG_COLLECTION), newEntry).catch((error: any) => {
      console.error("Failed to save activity log to Firestore", error.message);
    });
  }, []);

  return (
    <ActivityLogContext.Provider value={{ logEntries, addLogEntry, isLoadingLog }}>
      {children}
    </ActivityLogContext.Provider>
  );
}

export function useActivityLog(): ActivityLogContextType {
  const context = useContext(ActivityLogContext);
  if (context === undefined) {
    throw new Error('useActivityLog must be used within an ActivityLogProvider');
  }
  return context;
}
