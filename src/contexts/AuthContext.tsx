
'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
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
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        let userDocSnap = await getDoc(userDocRef);

        // If the user document doesn't exist, create a default one.
        // This handles cases where signup might have been interrupted
        // or for users created before the profile collection was standard.
        if (!userDocSnap.exists()) {
          const newProfile = {
            nombreCompleto: firebaseUser.displayName || firebaseUser.email || 'Usuario Nuevo',
            email: firebaseUser.email,
            rol: 'Usuario Final' as UserRole,
            nivelAcceso: 'Público' as NivelAcceso,
            activo: true,
            createdAt: serverTimestamp(),
          };
          try {
            await setDoc(userDocRef, newProfile);
            // Re-fetch the document to get the server-generated timestamp and confirm creation
            userDocSnap = await getDoc(userDocRef);
          } catch (error) {
            console.error("Failed to create user profile in Firestore:", error);
            auth.signOut();
            setUser(null);
            setLoading(false);
            return;
          }
        }
        
        if (userDocSnap.exists()) {
          const userProfileData = userDocSnap.data();
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            nombreCompleto: userProfileData.nombreCompleto,
            rol: userProfileData.rol,
            nivelAcceso: userProfileData.nivelAcceso || 'Público', // Default to 'Público' if not set
            puestoId: userProfileData.puestoId,
          });
        } else {
          // This should now be a very rare case, but as a fallback, sign out.
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
