
'use client';

import type { ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';

import { AppLayout } from '@/components/layout/app-layout';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { PermissionsProvider } from '@/contexts/PermissionsContext';
import { ActivityLogProvider } from '@/contexts/ActivityLogContext';
import { ExceptionsProvider } from '@/contexts/ExceptionsContext';

export default function AuthenticatedAppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.push(`/login?redirect=${pathname}`);
    }
  }, [user, loading, router, pathname]);

  if (loading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <ActivityLogProvider>
      <ExceptionsProvider>
        <PermissionsProvider>
          <AppLayout>{children}</AppLayout>
        </PermissionsProvider>
      </ExceptionsProvider>
    </ActivityLogProvider>
  );
}
