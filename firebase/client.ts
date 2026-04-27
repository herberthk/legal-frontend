import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import {
  getAnalytics,
  isSupported,
  Analytics,
  logEvent,
} from "firebase/analytics";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
const app =
  getApps().find((app) => app.name === "[DEFAULT]") ||
  initializeApp(firebaseConfig, "[DEFAULT]");

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Safe Analytics initialization — only runs when a valid Measurement ID is
// configured. Without one, getAnalytics loads gtag.js with id=undefined which
// causes a CSP violation and sends malformed data to Google Analytics.
export const analyticsPromise: Promise<Analytics | null> =
  typeof window !== "undefined" &&
  process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
    ? isSupported().then((supported) => (supported ? getAnalytics(app) : null))
    : Promise.resolve(null);

export const logAnalyticsEvent = async (
  eventName: string,
  eventParams?: Record<string, string | number | boolean | undefined>,
) => {
  const analytics = await analyticsPromise;
  if (analytics) {
    logEvent(analytics, eventName, eventParams);
  }
};

export default app;
