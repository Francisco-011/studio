
'use client';

import type { ReactNode } from 'react';
import { AppProviders } from '@/contexts/AppProviders';

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <AppProviders>
      {children}
    </AppProviders>
  );
}
