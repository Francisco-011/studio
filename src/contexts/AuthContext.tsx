
'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import type { UserRole, NivelAcceso } from '@/types/users';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { toast } from '@/hooks/use-toast';

interface UserProfile {
  uid: string;
  email: string | null;
  nombreCompleto: string;
  rol: UserRole;
  nivelAcceso: NivelAcceso;
  puestoId?: string;
  departamentoId?: string;
  areaId?: string;
  claimsVersion?: number;
  lastSyncStatus?: 'sync' | 'mismatch' | 'unknown';
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  isSyncing: boolean;
  lastSyncStatus: 'sync' | 'mismatch' | 'unknown';
  manualSync: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const functions = getFunctions();
const syncUserClaimsCallable = httpsCallable(functions, 'syncUserClaims');

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncStatus, setLastSyncStatus] = useState<'sync' | 'mismatch' | 'unknown'>('unknown');

  const fetchAndSetUserProfile = useCallback(async (firebaseUser: FirebaseUser, forceRefresh: boolean = false) => {
    try {
      const idTokenResult = await firebaseUser.getIdTokenResult(forceRefresh);
      const claims = idTokenResult.claims;
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      
      if (userDocSnap.exists()) {
        const dbProfile = userDocSnap.data();
        const claimsVersion = (claims.claimsVersion as number) || 0;
        const dbVersion = dbProfile.claimsVersion || 0;

        const needsSync = claimsVersion !== dbVersion ||
                          (claims.rol as UserRole) !== dbProfile.rol ||
                          (claims.nivelAcceso as NivelAcceso) !== dbProfile.nivelAcceso ||
                          (claims.puestoId as string) !== dbProfile.puestoId;
        
        setLastSyncStatus(needsSync ? 'mismatch' : 'sync');
        
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          nombreCompleto: dbProfile.nombreCompleto || 'Usuario',
          rol: (claims.rol as UserRole) || dbProfile.rol,
          nivelAcceso: (claims.nivelAcceso as NivelAcceso) || dbProfile.nivelAcceso,
          puestoId: (claims.puestoId as string) || dbProfile.puestoId,
          departamentoId: (claims.departamentoId as string) || undefined,
          areaId: (claims.areaId as string) || undefined,
          claimsVersion: claimsVersion,
          lastSyncStatus: needsSync ? 'mismatch' : 'sync',
        });
      } else {
        console.warn(`User profile not found in Firestore for UID: ${firebaseUser.uid}. Signing out.`);
        auth.signOut();
        setUser(null);
      }
    } catch (error) {
       console.error("Error fetching user profile:", error);
       toast({ title: "Error de Sesión", description: "No se pudo cargar la información del usuario.", variant: "destructive" });
       auth.signOut();
       setUser(null);
    }
  }, []);
  
  const manualSync = useCallback(async () => {
    if (!auth.currentUser || isSyncing) return;

    setIsSyncing(true);
    setLastSyncStatus('unknown'); // Set to unknown while syncing
    toast({ title: "Sincronizando Permisos...", description: "Verificando y corrigiendo sus permisos. Esto puede tardar un momento." });

    try {
        const result = await syncUserClaimsCallable();
        const { wasSynced, message } = result.data as { wasSynced: boolean; message: string };

        if (wasSynced) {
            // Force token refresh
            await auth.currentUser.getIdToken(true);

            toast({ title: "¡Sincronización Completa!", description: message });

            // Refresh user profile instead of reloading the entire page
            await fetchAndSetUserProfile(auth.currentUser, true);
        } else {
            toast({ title: "Permisos Verificados", description: message });
            // Still refresh the profile to ensure everything is in sync
            await fetchAndSetUserProfile(auth.currentUser, true);
        }

    } catch (error: any) {
        console.error("Error during manual sync:", error);
        toast({ title: "Error de Sincronización", description: error.message || "No se pudo completar la sincronización manual.", variant: "destructive" });
        setLastSyncStatus('mismatch');
    } finally {
        setIsSyncing(false);
    }
}, [isSyncing, fetchAndSetUserProfile]);

  useEffect(() => {
    let mounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (!mounted) return;

      setLoading(true);
      if (firebaseUser) {
        await fetchAndSetUserProfile(firebaseUser);
      } else {
        setUser(null);
        setLastSyncStatus('unknown');
      }
      setLoading(false);
    });

    // Periodic check every 5 minutes
    const FIVE_MINUTES = 5 * 60 * 1000;
    const interval = setInterval(() => {
        if (mounted && auth.currentUser) {
            fetchAndSetUserProfile(auth.currentUser);
        }
    }, FIVE_MINUTES);

    // Cleanup function to prevent memory leaks
    return () => {
        mounted = false;
        unsubscribe();
        clearInterval(interval);
    };
  }, [fetchAndSetUserProfile]);

  return (
    <AuthContext.Provider value={{ user, loading, isSyncing, lastSyncStatus, manualSync }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
