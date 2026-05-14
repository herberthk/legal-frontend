import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

const firebaseAdminConfig = {
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
};

// Initialize Firebase Admin
const adminApp =
  getApps().find((app) => app.name === "admin") ||
  initializeApp(firebaseAdminConfig, "admin");

export const auth = getAuth(adminApp);
export const db = getFirestore(adminApp);
export const messaging = getMessaging(adminApp);
// Ensure the region matches your deployed cloud function setup (e.g., us-central1)
// export const functions = getFunctions(adminApp, "us-central1");

export default adminApp;
