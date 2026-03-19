"use client";

import React, { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/firebase/client";
import { useAuthStore } from "@/store";
import { getCurrentUser } from "@/lib/actions/auth";
import {
  collection,
  limit,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { COLLECTIONS } from "@/constants";

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // const clearUser = useAuthStore((state) => state.clearUser);
  const setUser = useAuthStore((state) => state.setUser);
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    // 1. Initial hydration from server session to avoid flicker
    const hydrate = async () => {
      const user = await getCurrentUser();
      if (user) {
        setUser(user);
      }
    };
    hydrate();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, COLLECTIONS.USERS),
      where("id", "==", user.id),
      limit(1),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (snapshot.empty) {
          return;
        }
        const user = snapshot.docs[0].data() as User;
        console.log("Change detected", user);
        setUser(user);
      },
      (error) => {
        console.error("Firestore listener error:", error);
      },
    );

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return <>{children}</>;
}
