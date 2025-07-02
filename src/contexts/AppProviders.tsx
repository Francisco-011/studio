'use client';

import type { ReactNode } from 'react';
import { ActivityLogProvider } from '@/contexts/ActivityLogContext';
import { ExceptionsProvider } from '@/contexts/ExceptionsContext';
import { PermissionsProvider } from '@/contexts/PermissionsContext';
import { AreasProvider } from '@/contexts/AreasContext';
import { DepartamentosProvider } from '@/contexts/DepartamentosContext';
import { PuestosProvider } from '@/contexts/PuestosContext';
import { SistemasCostosProvider } from '@/contexts/SistemasCostosContext';
import { PoliticasProvider } from '@/contexts/PoliticasContext';
import { ActividadesProvider } from '@/contexts/ActividadesContext';
import { ProcesosProvider } from '@/contexts/ProcesosContext';
import { ProcedimientosProvider } from '@/contexts/ProcedimientosContext';
import { AccionesProvider } from '@/contexts/AccionesContext';

export function AppProviders({ children }: { children: ReactNode }) {
    return (
        <ActivityLogProvider>
            <ExceptionsProvider>
                <PermissionsProvider>
                    <AreasProvider>
                        <DepartamentosProvider>
                            <PuestosProvider>
                                <SistemasCostosProvider>
                                    <PoliticasProvider>
                                        <ActividadesProvider>
                                            <ProcedimientosProvider>
                                                <ProcesosProvider>
                                                    <AccionesProvider>
                                                        {children}
                                                    </AccionesProvider>
                                                </ProcesosProvider>
                                            </ProcedimientosProvider>
                                        </ActividadesProvider>
                                    </PoliticasProvider>
                                </SistemasCostosProvider>
                            </PuestosProvider>
                        </DepartamentosProvider>
                    </AreasProvider>
                </PermissionsProvider>
            </ExceptionsProvider>
        </ActivityLogProvider>
    );
}
