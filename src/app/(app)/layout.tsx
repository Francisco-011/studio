
import type { ReactNode } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { AreasProvider } from '@/contexts/AreasContext';
import { PuestosProvider } from '@/contexts/PuestosContext';
import { FuentesDestinosProvider } from '@/contexts/FuentesDestinosContext';
import { ProcesosProvider } from '@/contexts/ProcesosContext';

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
            <AppLayout>{children}</AppLayout>
          </ProcesosProvider>
        </FuentesDestinosProvider>
      </PuestosProvider>
    </AreasProvider>
  );
}
