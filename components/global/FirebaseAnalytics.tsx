"use client";

import { useEffect, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import posthog from "posthog-js";
import { analyticsPromise, auth } from "@/firebase/client";

const posthogConfigured = Boolean(
  process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN &&
    process.env.NEXT_PUBLIC_POSTHOG_HOST,
);

export default function FirebaseAnalytics() {
  const distinctId = useRef<string | null>(null);

  useEffect(() => {
    // Initializing analytics on the client side
    analyticsPromise.then((analytics) => {
      if (analytics) {
        // You can log an initial app_open event if you want, 
        // though Firebase usually handles this automatically.
        console.log("Firebase Analytics initialized");
      }
    });
  }, []);

  useEffect(() => {
    if (!posthogConfigured) return;

    return onAuthStateChanged(auth, (user) => {
      if (user) {
        if (distinctId.current && distinctId.current !== user.uid) {
          posthog.reset();
        }

        posthog.identify(user.uid, {
          email: user.email ?? undefined,
          name: user.displayName ?? undefined,
        });
        distinctId.current = user.uid;
        return;
      }

      if (distinctId.current) {
        posthog.reset();
        distinctId.current = null;
      }
    });
  }, []);

  return null;
}
