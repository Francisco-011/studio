
'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface FuenteDestino {
  id: string;
  nombre: string;
}

interface FuentesDestinosContextType {
  fuentesDestinos: FuenteDestino[];
  addFuenteDestino: (nombre: string) => void;
  updateFuenteDestino: (id: string, nombre: string) => void;
  deleteFuenteDestino: (id: string) => void;
  isLoadingFuentesDestinos: boolean;
}

const FuentesDestinosContext = createContext<FuentesDestinosContextType | undefined>(undefined);

const LOCAL_STORAGE_FUENTES_DESTINOS_KEY = 'proceza-fuentes-destinos';

export function FuentesDestinosProvider({ children }: { children: ReactNode }) {
  const [fuentesDestinos, setFuentesDestinos] = useState<FuenteDestino[]>([]);
  const [isLoadingFuentesDestinos, setIsLoadingFuentesDestinos] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedData = localStorage.getItem(LOCAL_STORAGE_FUENTES_DESTINOS_KEY);
        if (savedData) {
          setFuentesDestinos(JSON.parse(savedData));
        }
      } catch (error) {
        console.error("Failed to load fuentes/destinos from localStorage", error);
        setFuentesDestinos([]); 
      } finally {
        setIsLoadingFuentesDestinos(false);
      }
    } else {
      setIsLoadingFuentesDestinos(false); // No localStorage on server
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && !isLoadingFuentesDestinos) {
       try {
        localStorage.setItem(LOCAL_STORAGE_FUENTES_DESTINOS_KEY, JSON.stringify(fuentesDestinos));
      } catch (error) {
        console.error("Failed to save fuentes/destinos to localStorage", error);
      }
    }
  }, [fuentesDestinos, isLoadingFuentesDestinos]);

  const addFuenteDestino = useCallback((nombre: string) => {
    setFuentesDestinos((prev) => [...prev, { id: Date.now().toString(), nombre }]);
  }, []);

  const updateFuenteDestino = useCallback((id: string, nombre: string) => {
    setFuentesDestinos((prev) =>
      prev.map((fd) => (fd.id === id ? { ...fd, nombre } : fd))
    );
  }, []);

  const deleteFuenteDestino = useCallback((id: string) => {
    setFuentesDestinos((prev) => prev.filter((fd) => fd.id !== id));
  }, []);

  return (
    <FuentesDestinosContext.Provider value={{ fuentesDestinos, addFuenteDestino, updateFuenteDestino, deleteFuenteDestino, isLoadingFuentesDestinos }}>
      {children}
    </FuentesDestinosContext.Provider>
  );
}

export function useFuentesDestinos(): FuentesDestinosContextType {
  const context = useContext(FuentesDestinosContext);
  if (context === undefined) {
    throw new Error('useFuentesDestinos must be used within a FuentesDestinosProvider');
  }
  return context;
}
