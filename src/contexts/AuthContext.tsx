
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
            toast({ title: "¡Sincronización Completa!", description: message });
        } else {
            toast({ title: "Permisos Verificados", description: message });
        }
        // Force a full refresh of user profile and token after sync
        await fetchAndSetUserProfile(auth.currentUser, true);

    } catch (error: any) {
        console.error("Error during manual sync:", error);
        toast({ title: "Error de Sincronización", description: error.message || "No se pudo completar la sincronización manual.", variant: "destructive" });
        setLastSyncStatus('mismatch');
    } finally {
        setIsSyncing(false);
    }
  }, [isSyncing, fetchAndSetUserProfile]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      setLoading(true);
      if (firebaseUser) {
        await fetchAndSetUserProfile(firebaseUser);
      } else {
        setUser(null);
        setLastSyncStatus('unknown');
      }
      setLoading(false);
    });
    
    // Periodic check
    const interval = setInterval(() => {
        if (auth.currentUser) {
            fetchAndSetUserProfile(auth.currentUser);
        }
    }, 5 * 60 * 1000); // Every 5 minutes

    return () => {
        unsubscribe();
        clearInterval(interval);
    };
  }, []);

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
