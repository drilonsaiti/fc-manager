import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  getAuth,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { initializeApp, deleteApp } from "firebase/app";
import { auth, db } from "./config";
import { createTeam } from "./firestore";
import type { UserRole } from "@/types";

export async function signIn(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

/**
 * Creates a club: the auth account first (so every following write is
 * authenticated), then the team owned by that uid, then the owner's profile.
 */
export async function registerClub(email: string, password: string, name: string, teamName: string) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(credential.user, { displayName: name });
  const uid = credential.user.uid;

  const teamId = await createTeam(teamName, uid);

  await setDoc(doc(db, "users", uid), {
    id: uid,
    name,
    email,
    role: "owner" as UserRole,
    teamId,
    position: null,
    jerseyNumber: null,
    photoURL: null,
    createdAt: serverTimestamp(),
  });

  return credential;
}

export async function updateUserTeam(uid: string, teamId: string) {
  await updateDoc(doc(db, "users", uid), { teamId });
}

// Creates a new user account without disturbing the current manager session
export async function createManagedUser(
  email: string,
  password: string,
  name: string,
  teamId: string,
  role: UserRole,
  extra?: { position?: string; jerseyNumber?: number }
): Promise<{ uid: string }> {
  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  const secondaryApp = initializeApp(firebaseConfig, `secondary-${Date.now()}`);
  const secondaryAuth = getAuth(secondaryApp);

  try {
    // Step 1: create Auth account in secondary app (manager stays logged in)
    const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    await updateProfile(credential.user, { displayName: name });
    const uid = credential.user.uid;

    // Step 2: write Firestore doc using the main db (manager is authenticated)
    await setDoc(doc(db, "users", uid), {
      id: uid,
      name,
      email,
      role,
      teamId,
      position: extra?.position ?? null,
      jerseyNumber: extra?.jerseyNumber ?? null,
      photoURL: null,
      createdAt: serverTimestamp(),
    });

    await signOut(secondaryAuth);
    return { uid };
  } finally {
    await deleteApp(secondaryApp);
  }
}

export async function logOut() {
  return signOut(auth);
}

export async function resetPassword(email: string) {
  return sendPasswordResetEmail(auth, email);
}

export async function getUserData(uid: string) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}
