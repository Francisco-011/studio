
import type { ReactNode } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { AreasProvider } from '@/contexts/AreasContext';
import { PuestosProvider } from '@/contexts/PuestosContext';
import { FuentesDestinosProvider } from '@/contexts/FuentesDestinosContext';

export default function AuthenticatedAppLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <AreasProvider>
      <PuestosProvider>
        <FuentesDestinosProvider>
          <AppLayout>{children}</AppLayout>
        </FuentesDestinosProvider>
      </PuestosProvider>
    </AreasProvider>
  );
}
