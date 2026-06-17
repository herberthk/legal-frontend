"use server";

import { db } from "@/firebase/admin";
import { COLLECTIONS } from "@/constants";
import { FieldValue } from "firebase-admin/firestore";
import { getAuthenticatedAdmin } from "./auth";

const CONFIG_DOC_ID = "default";

const DEFAULT_CONFIG: SystemConfig = {
  id: CONFIG_DOC_ID,
  exchangeRateUGXtoUSD: 3800,
  pricing: {
    voiceSessionPerMinute: 0.5,
    textSessionPer1kTokens: 0.01,
    documentReviewPerPage: 0.1,
  },
  freeTier: {
    welcomeTextTokens: 4000,
    freeDailyTextTokens: 1000,
    welcomeVoiceSeconds: 300,
  },
  maintenanceMode: false,
  supportEmail: "support@legal-adviser.com",
  supportPhone: "+256000000000",
  updatedAt: new Date().toISOString(),
  updatedBy: "system",
};

export const getSystemConfig = async (): Promise<{ success: boolean; config?: SystemConfig; error?: string }> => {
  try {
    const admin = await getAuthenticatedAdmin();
    if (!admin || !["ADMIN", "SUPER_ADMIN"].includes(admin.role)) {
      return { success: false, error: "Unauthorized" };
    }

    const docRef = db.collection(COLLECTIONS.SYSTEM_CONFIG).doc(CONFIG_DOC_ID);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      // Create with defaults if it doesn't exist
      const configWithTimestamps = {
        ...DEFAULT_CONFIG,
        updatedAt: FieldValue.serverTimestamp(),
      };
      await docRef.set(configWithTimestamps);
      return { success: true, config: DEFAULT_CONFIG };
    }

    const data = docSnap.data();
    return {
      success: true,
      config: {
        ...DEFAULT_CONFIG,
        ...data,
        id: docSnap.id,
        updatedAt: data?.updatedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
      } as SystemConfig,
    };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("getSystemConfig error:", error);
    return { success: false, error: error.message || "Failed to fetch config" };
  }
};

export const updateSystemConfig = async (
  newData: Partial<SystemConfig>,
  currentData: SystemConfig
): Promise<{ success: boolean; error?: string }> => {
  try {
    const admin = await getAuthenticatedAdmin();
    // Only SUPER_ADMIN can update settings
    if (!admin || admin.role !== "SUPER_ADMIN") {
      return { success: false, error: "Unauthorized: Only SUPER_ADMIN can modify configuration." };
    }

    const docRef = db.collection(COLLECTIONS.SYSTEM_CONFIG).doc(CONFIG_DOC_ID);
    
    // Find what changed for the audit log
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const changes: Record<string, { old: any; new: any }> = {};
    for (const [key, newValue] of Object.entries(newData)) {
      const oldValue = currentData[key as keyof SystemConfig];
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes[key] = { old: oldValue, new: newValue };
      }
    }

    // If nothing changed, return early
    if (Object.keys(changes).length === 0) {
      return { success: true };
    }

    // Perform the update
    const batch = db.batch();
    
    const updatePayload = {
      ...newData,
      updatedBy: admin.id,
      updatedAt: FieldValue.serverTimestamp(),
    };
    
    batch.update(docRef, updatePayload);

    // Create Audit Log
    const auditRef = db.collection(COLLECTIONS.SYSTEM_CONFIG_AUDITS).doc();
    const auditLog = {
      configId: CONFIG_DOC_ID,
      updatedBy: admin.id,
      updatedByName: admin.name || "Unknown Admin",
      changes,
      updatedAt: FieldValue.serverTimestamp(),
    };
    batch.set(auditRef, auditLog);

    await batch.commit();

    return { success: true };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("updateSystemConfig error:", error);
    return { success: false, error: error.message || "Failed to update config" };
  }
};
