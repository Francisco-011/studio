
import type { ReactNode } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { AreasProvider } from '@/contexts/AreasContext';
import { PuestosProvider } from '@/contexts/PuestosContext';
// Removed: import { FuentesDestinosProvider } from '@/contexts/FuentesDestinosContext';
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
        <PuestosProvider>
          {/* <FuentesDestinosProvider> */}
          <SistemasCostosProvider>
            <ActividadesProvider>
              <AccionesProvider>
                <AppLayout>{children}</AppLayout>
              </AccionesProvider>
            </ActividadesProvider>
          </SistemasCostosProvider>
          {/* </FuentesDestinosProvider> */}
        </PuestosProvider>
      </AreasProvider>
    </ActivityLogProvider>
  );
}
