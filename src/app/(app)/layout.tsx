
import type { ReactNode } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { AreasProvider } from '@/contexts/AreasContext';
import { PuestosProvider } from '@/contexts/PuestosContext';
import { FuentesDestinosProvider } from '@/contexts/FuentesDestinosContext';
import { ProcesosProvider } from '@/contexts/ProcesosContext';
import { ActividadesProvider } from '@/contexts/ActividadesContext';
import { AccionesProvider } from '@/contexts/AccionesContext';

export default function AuthenticatedAppLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <AreasProvider>
      <PuestosProvider>
        <FuentesDestinosProvider>
          <ProcesosProvider> 
            <ActividadesProvider>
              <AccionesProvider>
                <AppLayout>{children}</AppLayout>
              </AccionesProvider>
            </ActividadesProvider>
          </ProcesosProvider>
        </FuentesDestinosProvider>
      </PuestosProvider>
    </AreasProvider>
  );
}
