
'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';

// Types for Systems and Costs
export const tiposDeCostoOptions = ["Por Uso del Sistema", "Por Licencias"] as const;
export type TipoCosto = typeof tiposDeCostoOptions[number];

export const formasDePagoOptions = ["Transferencia", "Efectivo", "Tarjeta", "Otros"] as const;
export type FormaPago = typeof formasDePagoOptions[number];

export const frecuenciasDePagoOptions = ["Mensual", "Anual", "Otro"] as const;
export type FrecuenciaPago = typeof frecuenciasDePagoOptions[number];

export const tiposDeMonedaOptions = ["MXN", "USD", "EUR", "CAD", "GBP"] as const;
export type TipoMoneda = typeof tiposDeMonedaOptions[number];

export interface Sistema {
  id: string;
  nombre: string;
}

export interface SistemaCosto {
  id: string;
  sistemaId: string;
  tipoCosto: TipoCosto[];
  montoUso?: number;
  numeroLicencias?: number;
  costoPorLicencia?: number;
  formaPago: FormaPago;
  frecuencia: FrecuenciaPago;
  moneda: TipoMoneda;
  descripcion?: string;
}

interface SistemasCostosContextType {
  sistemas: Sistema[];
  costosSistemas: SistemaCosto[];
  addSistema: (nombre: string) => Sistema;
  updateSistema: (id: string, nombre: string) => void;
  deleteSistema: (id: string) => void;
  addCostoSistema: (costoData: Omit<SistemaCosto, 'id'>) => void;
  updateCostoSistema: (id: string, costoData: Partial<Omit<SistemaCosto, 'id' | 'sistemaId'>>) => void;
  deleteCostoSistema: (id: string) => void;
  isLoadingSistemasCostos: boolean;
  getCostsForSystem: (sistemaId: string) => SistemaCosto[];
}

const SistemasCostosContext = createContext<SistemasCostosContextType | undefined>(undefined);

const LOCAL_STORAGE_SISTEMAS_KEY = 'proceza-sistemas';
const LOCAL_STORAGE_COSTOS_SISTEMAS_KEY = 'proceza-costos-sistemas';

export function SistemasCostosProvider({ children }: { children: ReactNode }) {
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [costosSistemas, setCostosSistemas] = useState<SistemaCosto[]>([]);
  const [isLoadingSistemasCostos, setIsLoadingSistemasCostos] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsLoadingSistemasCostos(true);
      try {
        const savedSistemas = localStorage.getItem(LOCAL_STORAGE_SISTEMAS_KEY);
        if (savedSistemas) {
          setSistemas(JSON.parse(savedSistemas));
        }
        const savedCostosSistemas = localStorage.getItem(LOCAL_STORAGE_COSTOS_SISTEMAS_KEY);
        if (savedCostosSistemas) {
          setCostosSistemas(JSON.parse(savedCostosSistemas));
        }
      } catch (error) {
        console.error("Failed to load sistemas/costos from localStorage", error);
        toast({ title: "Error al cargar datos de sistemas", description: "No se pudieron cargar los datos de sistemas y costos.", variant: "destructive" });
        setSistemas([]);
        setCostosSistemas([]);
      } finally {
        setIsLoadingSistemasCostos(false);
      }
    } else {
      setIsLoadingSistemasCostos(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && !isLoadingSistemasCostos) {
      try {
        localStorage.setItem(LOCAL_STORAGE_SISTEMAS_KEY, JSON.stringify(sistemas));
      } catch (error) {
        console.error("Failed to save sistemas to localStorage", error);
      }
    }
  }, [sistemas, isLoadingSistemasCostos]);

  useEffect(() => {
    if (typeof window !== 'undefined' && !isLoadingSistemasCostos) {
      try {
        localStorage.setItem(LOCAL_STORAGE_COSTOS_SISTEMAS_KEY, JSON.stringify(costosSistemas));
      } catch (error) {
        console.error("Failed to save costosSistemas to localStorage", error);
      }
    }
  }, [costosSistemas, isLoadingSistemasCostos]);

  const addSistema = useCallback((nombre: string): Sistema => {
    const newSistema: Sistema = { id: Date.now().toString(), nombre };
    setSistemas((prev) => [...prev, newSistema]);
    return newSistema;
  }, []);

  const updateSistema = useCallback((id: string, nombre: string) => {
    setSistemas((prev) =>
      prev.map((sistema) => (sistema.id === id ? { ...sistema, nombre } : sistema))
    );
  }, []);

  const deleteSistema = useCallback((id: string) => {
    setCostosSistemas((prevCostos) => prevCostos.filter(costo => costo.sistemaId !== id));
    setSistemas((prevSistemas) => prevSistemas.filter((sistema) => sistema.id !== id));
  }, []);

  const addCostoSistema = useCallback((costoData: Omit<SistemaCosto, 'id'>) => {
    const newCosto: SistemaCosto = { ...costoData, id: Date.now().toString() };
    setCostosSistemas((prev) => [...prev, newCosto]);
  }, []);

  const updateCostoSistema = useCallback((id: string, costoData: Partial<Omit<SistemaCosto, 'id' | 'sistemaId'>>) => {
    setCostosSistemas((prev) =>
      prev.map((costo) => (costo.id === id ? { ...costo, ...costoData } : costo))
    );
  }, []);

  const deleteCostoSistema = useCallback((id: string) => {
    setCostosSistemas((prev) => prev.filter((costo) => costo.id !== id));
  }, []);

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
    throw new Error('useSistemasCostos must be used within a SistemasCostosProvider');
  }
  return context;
}
