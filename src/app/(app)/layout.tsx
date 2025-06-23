
import type { ReactNode } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { AreasProvider } from '@/contexts/AreasContext';
import { DepartamentosProvider } from '@/contexts/DepartamentosContext';
import { PuestosProvider } from '@/contexts/PuestosContext';
import { ActividadesProvider } from '@/contexts/ActividadesContext';
import { AccionesProvider } from '@/contexts/AccionesContext';
import { SistemasCostosProvider } from '@/contexts/SistemasCostosContext';
import { ActivityLogProvider } from '@/contexts/ActivityLogContext';

export default function AuthenticatedAppLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ActivityLogProvider>
      <AreasProvider>
        <DepartamentosProvider>
          <PuestosProvider>
            <SistemasCostosProvider>
              <ActividadesProvider>
                <AccionesProvider>
                  <AppLayout>{children}</AppLayout>
                </AccionesProvider>
              </ActividadesProvider>
            </SistemasCostosProvider>
          </PuestosProvider>
        </DepartamentosProvider>
      </AreasProvider>
    </ActivityLogProvider>
  );
}
