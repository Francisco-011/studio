
'use client';

import type { ReactNode } from 'react';
import { AreasProvider } from '@/contexts/AreasContext';
import { DepartamentosProvider } from '@/contexts/DepartamentosContext';
import { PuestosProvider } from '@/contexts/PuestosContext';
import { SistemasCostosProvider } from '@/contexts/SistemasCostosContext';
import { PoliticasProvider } from '@/contexts/PoliticasContext';
import { ActividadesProvider } from '@/contexts/ActividadesContext';
import { ProcesosProvider } from '@/contexts/ProcesosContext';
import { ProcedimientosProvider } from '@/contexts/ProcedimientosContext';
import { AccionesProvider } from '@/contexts/AccionesContext';
import { AuditsProvider } from '@/contexts/AuditsContext';

export function AppProviders({ children }: { children: ReactNode }) {
    return (
        <AreasProvider>
            <DepartamentosProvider>
                <PuestosProvider>
                    <SistemasCostosProvider>
                        <PoliticasProvider>
                            <ActividadesProvider>
                                <ProcedimientosProvider>
                                    <ProcesosProvider>
                                        <AccionesProvider>
                                            <AuditsProvider>
                                                {children}
                                            </AuditsProvider>
                                        </AccionesProvider>
                                    </ProcesosProvider>
                                </ProcedimientosProvider>
                            </ActividadesProvider>
                        </PoliticasProvider>
                    </SistemasCostosProvider>
                </PuestosProvider>
            </DepartamentosProvider>
        </AreasProvider>
    );
}
