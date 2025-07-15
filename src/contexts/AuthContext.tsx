

'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, collection, getDocs, query, where } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import type { UserRole, NivelAcceso } from '@/app/(app)/usuarios/page';
import type { Puesto } from './PuestosContext';
import type { Departamento } from './DepartamentosContext';

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
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        let userDocSnap = await getDoc(userDocRef);

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
          
          let nivelAcceso = userProfileData.nivelAcceso;
          if (userProfileData.rol === 'Administrador' && !nivelAcceso) {
            nivelAcceso = 'Confidencial';
          } else if (!nivelAcceso) {
            nivelAcceso = 'Público';
          }
          
          let areaId, departamentoId;
          if (userProfileData.puestoId) {
             const puestoQuery = query(collection(db, 'puestos'), where('__name__', '==', userProfileData.puestoId));
             const puestoSnap = await getDocs(puestoQuery);
             if (!puestoSnap.empty) {
                const puestoData = puestoSnap.docs[0].data() as Puesto;
                areaId = puestoData.areaId;
                departamentoId = puestoData.departamentoId;
             }
          }
          
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            nombreCompleto: userProfileData.nombreCompleto,
            rol: userProfileData.rol,
            nivelAcceso: nivelAcceso,
            puestoId: userProfileData.puestoId,
            areaId: areaId,
            departamentoId: departamentoId,
          });

        } else {
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
