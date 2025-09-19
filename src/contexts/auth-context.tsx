"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { User, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Collections } from "@/types/collections";
import type { UserProfile } from "@/types/user-profile";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  userUid: string | null;
  ownerUid: string | null;
  workspaceUid: string | null;
  showOnlyMyAccounts: boolean;
  profile: UserProfile | null;
  profileLoading: boolean;
  updateProfile: (patch: Partial<UserProfile>) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    const profileDoc = doc(db, Collections.UserProfiles, user.uid);

    let attemptedInit = false;
    setProfileLoading(true);
    const unsub = onSnapshot(
      profileDoc,
      (snap) => {
        if (!snap.exists() && !attemptedInit) {
          attemptedInit = true;
          void setDoc(
            profileDoc,
            {
              workspaceUid: user.uid,
              showOnlyMyAccounts: false,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
          setProfile({ workspaceUid: user.uid, showOnlyMyAccounts: false });
          setProfileLoading(false);
          return;
        }
        const data = snap.data() as UserProfile | undefined;

        if (!data) {
          setProfile(null);
        } else {
          setProfile(data);
        }
        setProfileLoading(false);
      },
      () => {
        setProfile(null);
        setProfileLoading(false);
      }
    );
    return () => unsub();
  }, [user]);

  const workspaceUid = profile?.workspaceUid ?? user?.uid ?? null;
  const showOnlyMyAccounts = profile?.showOnlyMyAccounts ?? false;

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    userUid: user?.uid ?? null,
    ownerUid: workspaceUid,
    workspaceUid,
    showOnlyMyAccounts,
    profile,
    profileLoading,
    async updateProfile(patch) {
      if (!user) return;
      const ref = doc(db, Collections.UserProfiles, user.uid);
      await setDoc(
        ref,
        {
          ...patch,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    },
    async signIn(email: string, password: string) {
      await signInWithEmailAndPassword(auth, email, password);
    },
    async signOut() {
      await signOut(auth);
    },
  }), [user, loading, workspaceUid, showOnlyMyAccounts, profile, profileLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
