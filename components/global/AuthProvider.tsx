"use client";

import React, { useEffect, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db, logAnalyticsEvent } from "@/firebase/client";
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
  const setUser = useAuthStore((state) => state.setUser);
  const user = useAuthStore((state) => state.user);
  const hasLoggedAnalytics = useRef(false);

  useEffect(() => {
    // 1. Initial hydration from server session to avoid flicker
    const hydrate = async () => {
      const user = await getCurrentUser();
      if (user) {
        setUser(user);
        if (!hasLoggedAnalytics.current) {
          logAnalyticsEvent("login", { method: "session_hydration" });
          hasLoggedAnalytics.current = true;
        }
      }
    };
    hydrate();
  }, [setUser]);

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
        const userData = snapshot.docs[0].data() as User;
        console.log("Change detected", userData);
        setUser(userData);
      },
      (error) => {
        console.error("Firestore listener error:", error);
      },
    );

    return () => unsubscribe();
  }, [user, setUser]);

  return <>{children}</>;
}
