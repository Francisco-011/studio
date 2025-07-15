

'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import type { UserRole, NivelAcceso } from '@/app/(app)/usuarios/page';

interface UserProfile {
  uid: string;
  email: string | null;
  nombreCompleto: string;
  rol: UserRole;
  nivelAcceso: NivelAcceso;
  puestoId?: string;
  departamentoId?: string;
  areaId?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        try {
          // Force refresh the token to get the latest custom claims
          const idTokenResult = await firebaseUser.getIdTokenResult(true);
          const claims = idTokenResult.claims;

          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            const dbProfile = userDocSnap.data();
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              nombreCompleto: dbProfile.nombreCompleto || 'Usuario',
              // Prioritize claims, fallback to DB, then to default
              rol: (claims.rol as UserRole) || dbProfile.rol || 'Usuario Final',
              nivelAcceso: (claims.nivelAcceso as NivelAcceso) || dbProfile.nivelAcceso || 'Público',
              puestoId: (claims.puestoId as string) || dbProfile.puestoId,
              departamentoId: (claims.departamentoId as string) || undefined,
              areaId: (claims.areaId as string) || undefined,
            });
          } else {
            // This case is for first-time sign-ups that haven't had a profile created yet.
            // A separate signup flow should handle profile creation.
            // For now, we sign them out to enforce profile existence.
             console.warn(`User profile not found in Firestore for UID: ${firebaseUser.uid}. Signing out.`);
             auth.signOut();
             setUser(null);
          }
        } catch (error) {
           console.error("Error fetching user data or claims:", error);
           auth.signOut();
           setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
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
