"use client";

import React, { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/firebase/client";
import { useAuthStore } from "@/store";
import { getCurrentUser } from "@/lib/actions/auth";

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { setUser, clearUser } = useAuthStore();

  useEffect(() => {
    // 1. Initial hydration from server session to avoid flicker
    const hydrate = async () => {
      const user = await getCurrentUser();
      if (user) {
        setUser(user);
      } else {
        clearUser();
      }
    };
    hydrate();

    // 2. Listen for Firebase Auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // If we have a firebase user, ensure the server session is also in sync
        // Note: The actual cookie setting happens during login/signup actions
        const user = await getCurrentUser();
        if (user) {
          setUser(user);
        }
      } else {
        // Clear local store if signed out of Firebase
        clearUser();
      }
    });

    return () => unsubscribe();
  }, [setUser, clearUser]);

  return <>{children}</>;
}
