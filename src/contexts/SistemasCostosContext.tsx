
'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';
import { useActivityLog } from './ActivityLogContext';

// Types for Systems and Costs
export const tiposDeCostoOptions = ["Por Uso del Sistema", "Por Licencias"] as const;
export type TipoCosto = typeof tiposDeCostoOptions[number];

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
  tipoCosto: TipoCosto[];
  montoUso?: number;
  numeroLicencias?: number;
  costoPorLicencia?: number;
  formaPago: FormaPago;
  frecuencia: FrecuenciaPago;
  moneda: TipoMoneda;
  descripcion?: string;
}

export interface SistemaCreationData extends Omit<Sistema, 'id'> {}
export interface SistemaUpdateData extends Partial<Omit<Sistema, 'id'>> {}


interface SistemasCostosContextType {
  sistemas: Sistema[];
  costosSistemas: SistemaCosto[];
  addSistema: (data: SistemaCreationData) => Sistema;
  updateSistema: (id: string, data: SistemaUpdateData) => void;
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
  const { addLogEntry } = useActivityLog();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsLoadingSistemasCostos(true);
      try {
        const savedSistemas = localStorage.getItem(LOCAL_STORAGE_SISTEMAS_KEY);
        if (savedSistemas) {
          // Migrate existing data: old systems won't have scope, default to "Empresa"
          const parsedSistemas: Sistema[] = JSON.parse(savedSistemas).map((s: any) => ({
            ...s,
            scope: s.scope || "Empresa",
          }));
          setSistemas(parsedSistemas);
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

  const addSistema = useCallback((data: SistemaCreationData): Sistema => {
    const newSistema: Sistema = { 
        id: Date.now().toString(), 
        nombre: data.nombre,
        scope: data.scope || "Empresa",
        scopeId: data.scope === "Empresa" ? undefined : data.scopeId,
    };
    setSistemas((prev) => [...prev, newSistema]);
    addLogEntry({ action: 'create', entityType: 'Sistema', entityName: data.nombre, details: `Se creó el sistema "${data.nombre}".` });
    return newSistema;
  }, [addLogEntry]);

  const updateSistema = useCallback((id: string, data: SistemaUpdateData) => {
    const originalSistema = sistemas.find(s => s.id === id);
    setSistemas((prev) =>
      prev.map((sistema) => (sistema.id === id ? { 
        ...sistema, 
        ...data,
        scopeId: data.scope === "Empresa" ? undefined : (data.scopeId !== undefined ? data.scopeId : sistema.scopeId)
      } : sistema))
    );
    if(originalSistema) {
       addLogEntry({ action: 'update', entityType: 'Sistema', entityName: data.nombre || originalSistema.nombre, details: `Se actualizó el sistema "${originalSistema.nombre}".` });
    }
  }, [addLogEntry, sistemas]);

  const deleteSistema = useCallback((id: string) => {
    const sistemaToDelete = sistemas.find(s => s.id === id);
    setCostosSistemas((prevCostos) => prevCostos.filter(costo => costo.sistemaId !== id));
    setSistemas((prevSistemas) => prevSistemas.filter((sistema) => sistema.id !== id));
    if(sistemaToDelete){
        addLogEntry({ action: 'delete', entityType: 'Sistema', entityName: sistemaToDelete.nombre, details: `Se eliminó el sistema "${sistemaToDelete.nombre}" y sus costos asociados.` });
    }
  }, [addLogEntry, sistemas]);

  const addCostoSistema = useCallback((costoData: Omit<SistemaCosto, 'id'>) => {
    const newCosto: SistemaCosto = { ...costoData, id: Date.now().toString() };
    const sistema = sistemas.find(s => s.id === costoData.sistemaId);
    setCostosSistemas((prev) => [...prev, newCosto]);
    if(sistema) {
      addLogEntry({ action: 'create', entityType: 'Costo de Sistema', entityName: sistema.nombre, details: `Se agregó un costo al sistema "${sistema.nombre}".` });
    }
  }, [addLogEntry, sistemas]);

  const updateCostoSistema = useCallback((id: string, costoData: Partial<Omit<SistemaCosto, 'id' | 'sistemaId'>>) => {
    const originalCosto = costosSistemas.find(c => c.id === id);
    setCostosSistemas((prev) =>
      prev.map((costo) => (costo.id === id ? { ...costo, ...costoData } : costo))
    );
     if(originalCosto) {
        const sistema = sistemas.find(s => s.id === originalCosto.sistemaId);
        if(sistema) {
          addLogEntry({ action: 'update', entityType: 'Costo de Sistema', entityName: sistema.nombre, details: `Se actualizó un costo del sistema "${sistema.nombre}".` });
        }
    }
  }, [addLogEntry, costosSistemas, sistemas]);

  const deleteCostoSistema = useCallback((id: string) => {
    const costoToDelete = costosSistemas.find(c => c.id === id);
    setCostosSistemas((prev) => prev.filter((costo) => costo.id !== id));
    if(costoToDelete){
       const sistema = sistemas.find(s => s.id === costoToDelete.sistemaId);
       if(sistema){
           addLogEntry({ action: 'delete', entityType: 'Costo de Sistema', entityName: sistema.nombre, details: `Se eliminó un costo del sistema "${sistema.nombre}".` });
       }
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
    throw new Error('useSistemasCostos must be used within a SistemasCostosProvider');
  }
  return context;
}
