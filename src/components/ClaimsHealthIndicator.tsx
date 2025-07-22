
'use client';

import { useAuth } from '@/contexts/AuthContext';
import { SyncClaimsButton } from '@/components/SyncClaimsButton';

export function ClaimsHealthIndicator() {
  const { user } = useAuth();
  
  if (!user) return null;

  return (
    <div className="flex items-center">
      <SyncClaimsButton />
    </div>
  );
}
