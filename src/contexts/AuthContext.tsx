
'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import type { UserRole, NivelAcceso } from '@/app/(app)/usuarios/page';
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
  // Health check fields
  claimsVersion?: number;
  lastSyncStatus?: 'sync' | 'mismatch' | 'unknown';
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  isSyncing: boolean;
  manualSync: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const functions = getFunctions();
const syncUserClaims = httpsCallable(functions, 'syncUserClaims');

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const checkClaimsHealth = useCallback(async (firebaseUser: FirebaseUser) => {
    setIsSyncing(true);
    try {
      const idTokenResult = await firebaseUser.getIdTokenResult(true); // Force refresh
      const claims = idTokenResult.claims;
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const dbProfile = userDocSnap.data();
        const claimsVersion = (claims.claimsVersion as number) || 0;
        const dbVersion = dbProfile.claimsVersion || 0;

        let needsSync = false;
        if (claimsVersion !== dbVersion) needsSync = true;
        if ((claims.rol as UserRole) !== dbProfile.rol) needsSync = true;
        if ((claims.nivelAcceso as NivelAcceso) !== dbProfile.nivelAcceso) needsSync = true;
        if ((claims.puestoId as string) !== dbProfile.puestoId) needsSync = true;
        
        if (needsSync) {
            toast({ title: "Sincronizando permisos...", description: "Detectamos una inconsistencia en tus permisos y la estamos corrigiendo automáticamente." });
            await syncUserClaims();
            // Re-fetch everything after sync
            const finalTokenResult = await firebaseUser.getIdTokenResult(true);
            const finalClaims = finalTokenResult.claims;
            const finalDbProfileSnap = await getDoc(userDocRef);
            const finalDbProfile = finalDbProfileSnap.data()!;
            
             setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              nombreCompleto: finalDbProfile.nombreCompleto || 'Usuario',
              rol: (finalClaims.rol as UserRole) || finalDbProfile.rol,
              nivelAcceso: (finalClaims.nivelAcceso as NivelAcceso) || finalDbProfile.nivelAcceso,
              puestoId: (finalClaims.puestoId as string) || finalDbProfile.puestoId,
              departamentoId: (finalClaims.departamentoId as string) || undefined,
              areaId: (finalClaims.areaId as string) || undefined,
              claimsVersion: (finalClaims.claimsVersion as number),
              lastSyncStatus: 'sync',
            });
        } else {
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
              lastSyncStatus: 'sync',
            });
        }

      } else {
        console.warn(`User profile not found in Firestore for UID: ${firebaseUser.uid}. Signing out.`);
        auth.signOut();
        setUser(null);
      }
    } catch (error) {
      console.error("Error checking claims health:", error);
      toast({ title: "Error de Sincronización", description: "No se pudieron verificar los permisos. Intente refrescar la página.", variant: "destructive" });
      auth.signOut();
      setUser(null);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      setLoading(true);
      if (firebaseUser) {
        await checkClaimsHealth(firebaseUser);
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    
    // Periodic check
    const interval = setInterval(() => {
        if (auth.currentUser) {
            checkClaimsHealth(auth.currentUser);
        }
    }, 5 * 60 * 1000); // Every 5 minutes

    return () => {
        unsubscribe();
        clearInterval(interval);
    };
  }, [checkClaimsHealth]);

  const manualSync = useCallback(async () => {
    if (auth.currentUser) {
        await checkClaimsHealth(auth.currentUser);
    }
  }, [checkClaimsHealth]);


  return (
    <AuthContext.Provider value={{ user, loading, isSyncing, manualSync }}>
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
