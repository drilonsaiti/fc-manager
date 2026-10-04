"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { doc, onSnapshot, Timestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/config";
import type { User } from "@/types";

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  user: User | null;
  loading: boolean;
  isOwner: boolean;
  isCoach: boolean;
  isStaff: boolean;
  canManage: boolean;
}

const AuthContext = createContext<AuthContextType>({
  firebaseUser: null, user: null, loading: true,
  isOwner: false, isCoach: false, isStaff: false, canManage: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
      if (!fbUser) { setUser(null); setLoading(false); return; }

      const unsubUser = onSnapshot(doc(db, "users", fbUser.uid), (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setUser({ ...data, id: snap.id, createdAt: (data.createdAt as Timestamp)?.toDate() ?? new Date() } as User);
        }
        setLoading(false);
      });

      return () => unsubUser();
    });
    return () => unsubAuth();
  }, []);

  const isOwner = user?.role === "owner";
  const isCoach = user?.role === "coach";
  const isStaff = user?.role === "staff";
  const canManage = isOwner || isCoach || isStaff;

  return (
    <AuthContext.Provider value={{ firebaseUser, user, loading, isOwner, isCoach, isStaff, canManage }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
