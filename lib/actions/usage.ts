"use server";

import { db } from "@/firebase/admin";
import {
  COLLECTIONS,
  COST_PER_THOUSAND_TOKENS,
  COST_PER_VOICE_MINUTE,
} from "@/constants";
import { checkRootCollection } from "./utils";

/**
 * Checks whether a user is allowed to send a message.
 * Validates free messages remaining, free tokens, welcome tokens, and paid balance.
 * @param userId - The authenticated user's ID
 * @returns Whether the user can send, and a reason if blocked
 */
export const checkUserCanSend = async (
  userId: string,
): Promise<{
  canSend: boolean;
  reason?: string;
  user?: User;
}> => {
  try {
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      return { canSend: false, reason: "User not found" };
    }

    const user = { id: userDoc.id, ...userDoc.data() } as User;

    // Check if user has any available resources
    const hasFreeTokens = user.freeTextTokens > 10;
    const hasPaidBalance = user.balance > COST_PER_THOUSAND_TOKENS;
    const hasWelcomeTokens = user.welcomeTextTokens > 10;

    if (hasFreeTokens || hasPaidBalance || hasWelcomeTokens) {
      return { canSend: true, user };
    }

    return {
      canSend: false,
      reason:
        "Insufficient funds or free tokens. Please add funds to continue.",
    };
  } catch (error) {
    console.error("Error checking user send permission:", error);
    return { canSend: false, reason: "An error occurred. Please try again." };
  }
};

/**
 * Records a usage entry and deducts from the correct billing tier.
 * Deduction order: Welcome Bonus → Daily Free → Paid Balance.
 * Uses a Firestore transaction for atomicity.
 *
 * @param params - Usage parameters
 * @returns Success status and the deducted cost
 */
export const recordUsageAndDeduct = async (params: {
  userId: string;
  type: "TEXT_RESPONSE" | "VOICE_SESSION";
  tokens?: number;
  sessionId: string;
  seconds?: number;
}) => {
  const { userId, type, tokens = 0, sessionId, seconds = 0 } = params;

  try {
    const result = await db.runTransaction(async (transaction) => {
      const userRef = db.collection(COLLECTIONS.USERS).doc(userId);
      const userDoc = await transaction.get(userRef);

      if (!userDoc.exists) {
        throw new Error("User not found");
      }

      const user = userDoc.data() as Omit<User, "id">;
      let source: UsageSource = "free";
      let totalCost = 0;
      let freeTokens = user.freeTextTokens;
      let balance = user.balance;
      let freeSeconds = user.freeVoiceSeconds;
      let welcomeTextTokens = user.welcomeTextTokens;

      if (type === "TEXT_RESPONSE") {
        if (welcomeTextTokens > 0) {
          // Deduct exclusively from free token quota first
          welcomeTextTokens = Math.max(0, welcomeTextTokens - tokens);
          source = "welcome";
        } else if (freeTokens > 0 && welcomeTextTokens === 0) {
          // Deduct exclusively from free token quota first
          freeTokens = Math.max(0, freeTokens - tokens);
          source = "free";
        } else {
          // No free tokens left — deduct from paid balance
          const tokensInThousand = tokens / 1000;
          const cost = tokensInThousand * COST_PER_THOUSAND_TOKENS;
          balance = Math.max(0, balance - cost);
          totalCost = cost;
          source = "paid";
        }
      }

      if (type === "VOICE_SESSION") {
        if (freeSeconds > 0) {
          // Deduct exclusively from free voice quota first
          freeSeconds = Math.max(0, freeSeconds - seconds);
          source = "free";
        } else {
          // No free seconds left — deduct from paid balance
          const minutes = seconds / 60;
          const cost = minutes * COST_PER_VOICE_MINUTE;
          balance = Math.max(0, balance - cost);
          totalCost = cost;
          source = "paid";
        }
      }

      // Update user document
      transaction.update(userRef, {
        freeTextTokens: freeTokens,
        balance,
        welcomeTextTokens,
        freeVoiceSeconds: freeSeconds,
        totalSpent: (user.totalSpent || 0) + totalCost,
      });

      // Create usage record
      const usageRef = db.collection(COLLECTIONS.USAGE).doc();
      transaction.set(usageRef, {
        userId,
        type,
        tokens,
        cost: totalCost,
        sessionId,
        seconds,
        source,
        createdAt: new Date().toISOString(),
      });

      // Record negative transaction if user paid for processing
      // if (totalCost > 0) {
      //   const txRef = db.collection(COLLECTIONS.TRANSACTIONS).doc();
      //   transaction.set(txRef, {
      //     id: txRef.id,
      //     userId,
      //     type: type === "TEXT_RESPONSE" ? "TEXT_CHAT" : "VOICE_SESSION",
      //     description: type === "TEXT_RESPONSE" ? "AI Text Chat Processing" : "Voice Consultation Session",
      //     amount: -totalCost,
      //     date: new Date().toISOString(),
      //     details: type === "TEXT_RESPONSE" ? `${tokens} Tokens` : `${Math.ceil(seconds / 60)} Mins`,
      //   });
      // }

      return { cost: totalCost };
    });

    return { success: true, ...result };
  } catch (error) {
    console.error("Error recording usage:", error);
    return { success: false, cost: 0 };
  }
};

/**
 * Gets usage records for a user, filtered by date range.
 * @param userId - The authenticated user's ID
 * @param filter - The date filter preset
 * @param customRange - Optional custom date range (for "custom" filter)
 * @returns Array of usage records
 */
export const getUserUsage = async (
  userId: string,
  filter: UsageFilter = "today",
  customRange?: { start: string; end: string },
): Promise<{
  success: boolean;
  records: UsageRecord[];
  totalTokens: number;
  totalCost: number;
  totalSeconds: number;
}> => {
  try {
    if (!userId) {
      return {
        success: false,
        records: [],
        totalTokens: 0,
        totalCost: 0,
        totalSeconds: 0,
      };
    }
    // console.log("userId", userId);
    const { start, end } = getDateRange(filter, customRange);
    // Check if collection exists
    const usageExists = await checkRootCollection(COLLECTIONS.USAGE);
    if (!usageExists) {
      return {
        success: true,
        records: [],
        totalTokens: 0,
        totalCost: 0,
        totalSeconds: 0,
      };
    }
    const snapshot = await db
      .collection(COLLECTIONS.USAGE)
      .where("userId", "==", userId)
      .where("createdAt", ">=", start)
      .where("createdAt", "<=", end)
      .orderBy("createdAt", "desc")
      .limit(20)
      .get();

    const records: UsageRecord[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as UsageRecord[];

    const totalTokens = records.reduce((sum, r) => sum + r.tokens, 0);
    const totalCost = records.reduce((sum, r) => sum + r.cost, 0);
    const totalSeconds = records.reduce((sum, r) => sum + r.seconds, 0);

    return { success: true, records, totalTokens, totalCost, totalSeconds };
  } catch (error) {
    console.error("Error getting user usage:", error);
    return {
      success: true,
      records: [],
      totalTokens: 0,
      totalCost: 0,
      totalSeconds: 0,
    };
  }
};

/**
 * Converts a UsageFilter preset into a { start, end } date range.
 */
function getDateRange(
  filter: UsageFilter,
  customRange?: { start: string; end: string },
): { start: string; end: string } {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  switch (filter) {
    case "today":
      return { start: todayStart.toISOString(), end: todayEnd.toISOString() };

    case "yesterday": {
      const yesterdayStart = new Date(todayStart);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      const yesterdayEnd = new Date(todayStart);
      yesterdayEnd.setMilliseconds(-1);
      return {
        start: yesterdayStart.toISOString(),
        end: yesterdayEnd.toISOString(),
      };
    }

    case "last_week": {
      const weekStart = new Date(todayStart);
      weekStart.setDate(weekStart.getDate() - 7);
      return { start: weekStart.toISOString(), end: todayEnd.toISOString() };
    }

    case "month": {
      const monthStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        1,
        0,
        0,
        0,
        0,
      );
      return { start: monthStart.toISOString(), end: todayEnd.toISOString() };
    }

    case "custom": {
      if (customRange) {
        return {
          start: new Date(customRange.start).toISOString(),
          end: new Date(customRange.end + "T23:59:59.999Z").toISOString(),
        };
      }
      // Fallback to today
      return { start: todayStart.toISOString(), end: todayEnd.toISOString() };
    }

    default:
      return { start: todayStart.toISOString(), end: todayEnd.toISOString() };
  }
}
