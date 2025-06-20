
import type { ReactNode } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { AreasProvider } from '@/contexts/AreasContext';
import { PuestosProvider } from '@/contexts/PuestosContext';
import { FuentesDestinosProvider } from '@/contexts/FuentesDestinosContext';
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
            <ActividadesProvider>
              <AccionesProvider>
                <AppLayout>{children}</AppLayout>
              </AccionesProvider>
            </ActividadesProvider>
        </FuentesDestinosProvider>
      </PuestosProvider>
    </AreasProvider>
  );
}
