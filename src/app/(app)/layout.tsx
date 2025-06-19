import type { ReactNode } from 'react';
import { AppLayout } from '@/components/layout/app-layout';

export default function AuthenticatedAppLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <AppLayout>{children}</AppLayout>;
}
