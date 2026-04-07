"use client";

import { useEffect } from "react";
import { analyticsPromise } from "@/firebase/client";

export default function FirebaseAnalytics() {
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

  return null;
}
