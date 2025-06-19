
import type { ReactNode } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { AreasProvider } from '@/contexts/AreasContext';
import { PuestosProvider } from '@/contexts/PuestosContext';

export default function AuthenticatedAppLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <AreasProvider>
      <PuestosProvider>
        <AppLayout>{children}</AppLayout>
      </PuestosProvider>
    </AreasProvider>
  );
}
