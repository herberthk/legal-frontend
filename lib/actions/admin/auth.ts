"use server";

import { db, auth } from "@/firebase/admin";
import { COLLECTIONS } from "@/constants";
import { cookies } from "next/headers";


/** Fetches the currently authenticated admin's user record for permission checks. */
export async function getAuthenticatedAdmin(): Promise<User | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;
    if (!sessionCookie) return null;
    const decoded = await auth.verifySessionCookie(sessionCookie, true);
    const snap = await db.collection(COLLECTIONS.USERS).doc(decoded.uid).get();
    if (!snap.exists) return null;
    const data = snap.data();
    if (!data) return null;
    
    return {
      ...data,
      id: snap.id,
      createdAt: data.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
      nextDailyReset: data.nextDailyReset?.toDate?.()?.toISOString() ?? new Date().toISOString(),
      deletedAt: data.deletedAt?.toDate?.()?.toISOString() ?? undefined,
    } as User;
  } catch {
    return null;
  }
}
