
'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';

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

const LOCAL_STORAGE_LOG_KEY = 'proceza-activity-log';
const MAX_LOG_ENTRIES = 500; // Limit the log size

export function ActivityLogProvider({ children }: { children: ReactNode }) {
  const [logEntries, setLogEntries] = useState<ActivityLogEntry[]>([]);
  const [isLoadingLog, setIsLoadingLog] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedLog = localStorage.getItem(LOCAL_STORAGE_LOG_KEY);
        if (savedLog) {
          setLogEntries(JSON.parse(savedLog));
        }
      } catch (error) {
        console.error("Failed to load activity log from localStorage", error);
        setLogEntries([]);
      } finally {
        setIsLoadingLog(false);
      }
    } else {
        setIsLoadingLog(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && !isLoadingLog) {
      try {
        localStorage.setItem(LOCAL_STORAGE_LOG_KEY, JSON.stringify(logEntries));
      } catch (error) {
        console.error("Failed to save activity log to localStorage", error);
      }
    }
  }, [logEntries, isLoadingLog]);

  const addLogEntry = useCallback((log: Omit<ActivityLogEntry, 'id' | 'timestamp'>) => {
    const newEntry: ActivityLogEntry = {
      ...log,
      id: Date.now().toString() + Math.random().toString(16).substring(2),
      timestamp: Date.now(),
      user: log.user || 'Sistema',
    };
    setLogEntries((prev) => [newEntry, ...prev].slice(0, MAX_LOG_ENTRIES));
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
