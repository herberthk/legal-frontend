"use server";

import { db } from "@/firebase/admin";
import { PRICE_PER_TOKEN } from "@/constants";
import { checkRootCollection } from "./utils";

/**
 * Checks whether a user is allowed to send a message.
 * Validates free messages remaining, free tokens, welcome tokens, and paid balance.
 * @param userId - The authenticated user's ID
 * @returns Whether the user can send, and a reason if blocked
 */
export async function checkUserCanSend(userId: string): Promise<{
  canSend: boolean;
  reason?: string;
  user?: User;
}> {
  try {
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      return { canSend: false, reason: "User not found" };
    }

    const user = { id: userDoc.id, ...userDoc.data() } as User;

    // Admin bypass
    if (user.role === "ADMIN") {
      return { canSend: true, user };
    }

    // Check if user has any available resources
    const hasFreeMessages = user.freeMessagesRemaining > 0;
    const hasFreeTokens = user.freeTextTokens > 0;
    const hasWelcomeTokens = (user.welcomeTextTokens || 0) > 0;
    const hasPaidBalance = user.balance > 0.01;

    if (hasFreeMessages && (hasFreeTokens || hasWelcomeTokens)) {
      return { canSend: true, user };
    }

    if (hasPaidBalance) {
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
}

/**
 * Records a usage entry and deducts from the correct billing tier.
 * Deduction order: Welcome Bonus → Daily Free → Paid Balance.
 * Uses a Firestore transaction for atomicity.
 *
 * @param params - Usage parameters
 * @returns Success status and the deducted cost
 */
export async function recordUsageAndDeduct(params: {
  userId: string;
  type: "TEXT_PROMPT" | "TEXT_RESPONSE" | "VOICE_SESSION";
  tokens: number;
  sessionId: string;
}) {
  const { userId, type, tokens, sessionId } = params;

  try {
    const result = await db.runTransaction(async (transaction) => {
      const userRef = db.collection("users").doc(userId);
      const userDoc = await transaction.get(userRef);

      if (!userDoc.exists) {
        throw new Error("User not found");
      }

      const user = userDoc.data() as Omit<User, "id">;

      // Admin bypass — record usage but don't deduct
      if (user.role === "ADMIN") {
        const usageRef = db.collection("usage").doc();
        transaction.set(usageRef, {
          userId,
          type,
          tokens,
          cost: 0,
          source: "free",
          sessionId,
          createdAt: new Date().toISOString(),
        });
        return { cost: 0, source: "free" as const };
      }

      let remaining = tokens;
      let totalCost = 0;
      let source: "free" | "welcome" | "paid" = "free";

      let newWelcomeTokens = user.welcomeTextTokens || 0;
      let newFreeTokens = user.freeTextTokens;
      let newBalance = user.balance;
      let newFreeMessages = user.freeMessagesRemaining ?? 0;

      // 1. Deduct from Welcome Bonus FIRST
      if (newWelcomeTokens > 0 && remaining > 0) {
        const deduction = Math.min(newWelcomeTokens, remaining);
        newWelcomeTokens -= deduction;
        remaining -= deduction;
        source = "welcome";
      }

      // 2. Deduct from Daily Free SECOND
      if (newFreeTokens > 0 && remaining > 0) {
        const deduction = Math.min(newFreeTokens, remaining);
        newFreeTokens -= deduction;
        remaining -= deduction;
        source = "free";
      }

      // 3. Deduct from Paid Balance LAST
      if (remaining > 0) {
        const cost = remaining * PRICE_PER_TOKEN;
        newBalance -= cost;
        totalCost = cost;
        source = "paid";
      }

      // Decrement free messages for user-initiated messages (prompts)
      if (type === "TEXT_PROMPT" && newFreeMessages > 0 && totalCost === 0) {
        newFreeMessages -= 1;
      }

      // Prevent negative balance
      newBalance = Math.max(0, newBalance);

      // Update user document
      transaction.update(userRef, {
        welcomeTextTokens: newWelcomeTokens,
        freeTextTokens: newFreeTokens,
        freeMessagesRemaining: newFreeMessages,
        balance: newBalance,
        totalSpent: (user.totalSpent || 0) + totalCost,
      });

      // Create usage record
      const usageRef = db.collection("usage").doc();
      transaction.set(usageRef, {
        userId,
        type,
        tokens,
        cost: totalCost,
        source,
        sessionId,
        createdAt: new Date().toISOString(),
      });

      return { cost: totalCost, source };
    });

    return { success: true, ...result };
  } catch (error) {
    console.error("Error recording usage:", error);
    return { success: false, cost: 0, source: "free" as const };
  }
}

/**
 * Gets usage records for a user, filtered by date range.
 * @param userId - The authenticated user's ID
 * @param filter - The date filter preset
 * @param customRange - Optional custom date range (for "custom" filter)
 * @returns Array of usage records
 */
export async function getUserUsage(
  userId: string,
  filter: UsageFilter = "today",
  customRange?: { start: string; end: string },
): Promise<{
  success: boolean;
  records: UsageRecord[];
  totalTokens: number;
  totalCost: number;
}> {
  try {
    if (!userId) {
      return { success: false, records: [], totalTokens: 0, totalCost: 0 };
    }
    console.log("userId", userId);
    const { start, end } = getDateRange(filter, customRange);
    // Check if collection exists
    const usageExists = await checkRootCollection("usage");
    if (!usageExists) {
      return { success: true, records: [], totalTokens: 0, totalCost: 0 };
    }
    const snapshot = await db
      .collection("usage")
      .where("userId", "==", userId)
      .where("createdAt", ">=", start)
      .where("createdAt", "<=", end)
      .orderBy("createdAt", "desc")
      .limit(200)
      .get();

    const records: UsageRecord[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as UsageRecord[];

    const totalTokens = records.reduce((sum, r) => sum + r.tokens, 0);
    const totalCost = records.reduce((sum, r) => sum + r.cost, 0);

    return { success: true, records, totalTokens, totalCost };
  } catch (error) {
    console.error("Error getting user usage:", error);
    return { success: true, records: [], totalTokens: 0, totalCost: 0 };
  }
}

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
