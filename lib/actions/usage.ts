"use server";

import { createHash } from "node:crypto";
import { db } from "@/firebase/admin";
import { COLLECTIONS, COST_PER_THOUSAND_TOKENS_IN_CENTS } from "@/constants";
import { checkRootCollection } from "./utils";
import { FieldValue } from "firebase-admin/firestore";

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
  user?: Omit<User, "createdAt" | "nextDailyReset">;
}> => {
  try {
    const userDoc = await db.collection(COLLECTIONS.USERS).doc(userId).get();
    if (!userDoc.exists) {
      return { canSend: false, reason: "User not found" };
    }

    // check if user is active
    if (userDoc.data()?.status !== "active") {
      return { canSend: false, reason: "User is not active" };
    }
    const user = { id: userDoc.id, ...userDoc.data() } as User;

    // Check if user has any available resources
    const hasFreeTokens = (user.freeTextTokens ?? 0) > 10;
    const hasPaidBalance = (user.balance ?? 0) > COST_PER_THOUSAND_TOKENS_IN_CENTS;
    const hasWelcomeTokens = (user.welcomeTextTokens ?? 0) > 10;

    if (hasFreeTokens || hasPaidBalance || hasWelcomeTokens) {
      const { createdAt, nextDailyReset, ...rest } = user;
      return { canSend: true, user: rest };
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

export const checkUserInfo = async (
  userId: string,
): Promise<{
  user: User | null;
}> => {
  try {
    const userDoc = await db.collection(COLLECTIONS.USERS).doc(userId).get();
    if (!userDoc.exists) {
      return { user: null };
    }

    const user = {
      ...userDoc.data(),
      id: userDoc.id,
      createdAt: userDoc.data()?.createdAt?.toDate().toISOString(),
      nextDailyReset: userDoc.data()?.nextDailyReset?.toDate().toISOString(),
    } as User;

    return { user };
  } catch (error) {
    console.error("Error checking user send permission:", error);
    return { user: null };
  }
};

/**
 * A collision-resistant usage identity scoped to the user and session.
 * Legacy entries are consulted only when their stored session also matches.
 */
function usageDocumentId(userId: string, sessionId: string, idempotencyKey: string): string {
  return createHash("sha256").update(JSON.stringify([userId, sessionId, idempotencyKey])).digest("hex");
}

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
  type: "TEXT_RESPONSE" | "VOICE_SESSION" | "DOCUMENT_TRANSCRIPTION";
  tokens?: number;
  sessionId: string;
  seconds?: number;
  /**
   * Makes the write safe to retry. When the usage document with this id already
   * exists the deduction is skipped and `alreadyCharged` is returned, so a turn
   * that is replayed after a crash is still billed exactly once.
   */
  idempotencyKey?: string;
}) => {
  const {
    userId,
    type = "TEXT_RESPONSE",
    tokens = 0,
    sessionId,
    seconds = 0,
    idempotencyKey,
  } = params;

  try {
    const result = await db.runTransaction(async (transaction) => {
      const userRef = db.collection(COLLECTIONS.USERS).doc(userId);
      const userDoc = await transaction.get(userRef);

      if (!userDoc.exists) {
        throw new Error("User not found");
      }

      if (idempotencyKey) {
        const existing = await transaction.get(
          db
            .collection(COLLECTIONS.USAGE)
            .doc(usageDocumentId(userId, sessionId, idempotencyKey)),
        );
        // Preserve deduplication for usage written before session-scoped IDs.
        const legacy = await transaction.get(db.collection(COLLECTIONS.USAGE).doc(`${userId}_${idempotencyKey}`));
        if (existing.exists || (legacy.exists && legacy.data()?.sessionId === sessionId)) {
          return { cost: 0, alreadyCharged: true };
        }
      }

      const user = userDoc.data() as Omit<User, "id">;
      let source: UsageSource = "free";
      let totalCost = 0;
      let freeTokens = user.freeTextTokens ?? 0;
      let balance = user.balance ?? 0;
      let welcomeTextTokens = user.welcomeTextTokens ?? 0;

      if (welcomeTextTokens > 0) {
        // Deduct exclusively from welcome token quota first
        welcomeTextTokens = Math.max(0, welcomeTextTokens - tokens);
        source = "welcome";
      } else if (freeTokens > 0) {
        // Deduct exclusively from daily free token quota
        freeTokens = Math.max(0, freeTokens - tokens);
        source = "free";
      } else {
        // No free tokens left — deduct from paid balance
        const tokensInThousand = tokens / 1000;
        const cost = tokensInThousand * COST_PER_THOUSAND_TOKENS_IN_CENTS;
        balance = Math.max(0, balance - cost);
        totalCost = cost;
        source = "paid";
      }

      // Update user document
      transaction.update(userRef, {
        freeTextTokens: freeTokens,
        balance,
        welcomeTextTokens,
        totalSpent: (user.totalSpent ?? 0) + totalCost,
      });

      // Create usage record
      const usageRef = idempotencyKey
        ? db
            .collection(COLLECTIONS.USAGE)
            .doc(usageDocumentId(userId, sessionId, idempotencyKey))
        : db.collection(COLLECTIONS.USAGE).doc();
      transaction.set(usageRef, {
        userId,
        type,
        tokens,
        cost: totalCost,
        sessionId,
        seconds,
        source,
        createdAt: FieldValue.serverTimestamp(),
      });

      return { cost: totalCost, alreadyCharged: false };
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

    const { Timestamp } = await import("firebase-admin/firestore");
    const startTimestamp = Timestamp.fromDate(new Date(start));
    const endTimestamp = Timestamp.fromDate(new Date(end));

    const snapshot = await db
      .collection(COLLECTIONS.USAGE)
      .where("userId", "==", userId)
      .where("createdAt", ">=", startTimestamp)
      .where("createdAt", "<=", endTimestamp)
      .orderBy("createdAt", "desc")
      .limit(20)
      .get();

    const records: UsageRecord[] = snapshot.docs.map((doc) => ({
      ...doc.data(),
      id: doc.id,
      createdAt:
        doc.data().createdAt?.toDate().toISOString() ||
        new Date().toISOString(),
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
 * Gets aggregated usage data specifically for the Usage Flow chart.
 */
export const getUsageChartData = async (
  userId: string,
  filter: UsageFilter = "last_week",
  customRange?: { start: string; end: string },
  timezoneOffset: number = 0,
): Promise<{
  success: boolean;
  chartData: {
    name: string;
    text: number;
    voice: number;
    document: number;
    cost: number;
  }[];
  totalPeriodCost: number;
}> => {
  try {
    if (!userId) {
      return { success: false, chartData: [], totalPeriodCost: 0 };
    }

    const { start: startStr, end: endStr } = getDateRange(
      filter,
      customRange,
      timezoneOffset,
    );
    const start = new Date(startStr);
    const end = new Date(endStr);
    const isHourly = filter === "today" || filter === "yesterday";

    const { Timestamp } = await import("firebase-admin/firestore");
    const startTimestamp = Timestamp.fromDate(start);
    const endTimestamp = Timestamp.fromDate(end);

    const snapshot = await db
      .collection(COLLECTIONS.USAGE)
      .where("userId", "==", userId)
      .where("createdAt", ">=", startTimestamp)
      .where("createdAt", "<=", endTimestamp)
      .orderBy("createdAt", "asc")
      .get();

    const dayMap: Record<
      string,
      {
        name: string;
        text: number;
        voice: number;
        document: number;
        cost: number;
        sortKey: number;
      }
    > = {};

    if (isHourly) {
      // Initialize 24 hours
      for (let i = 0; i < 24; i++) {
        const hour = i.toString().padStart(2, "0") + ":00";
        dayMap[hour] = {
          name: hour,
          text: 0,
          voice: 0,
          document: 0,
          cost: 0,
          sortKey: i,
        };
      }
    } else {
      // Initialize days using the user's LOCAL calendar dates
      const daysDiff = Math.ceil(
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
      );
      const iterations = Math.min(daysDiff + 1, 31);

      for (let i = 0; i < iterations; i++) {
        const utcInstant = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
        const localInstant = new Date(
          utcInstant.getTime() - timezoneOffset * 60 * 1000,
        );
        const key = localInstant.toISOString().split("T")[0];
        const labelDate = new Date(key + "T00:00:00Z");
        const label = labelDate.toLocaleDateString("en-US", {
          month: iterations > 10 ? "numeric" : undefined,
          day: "numeric",
          weekday: iterations <= 10 ? "short" : undefined,
          timeZone: "UTC",
        });
        dayMap[key] = {
          name: label,
          text: 0,
          voice: 0,
          document: 0,
          cost: 0,
          sortKey: utcInstant.getTime(),
        };
      }
    }

    snapshot.docs.forEach((doc) => {
      const rawData = doc.data();
      const createdAt = rawData.createdAt?.toDate() || new Date();
      const localCreatedAt = new Date(
        createdAt.getTime() - timezoneOffset * 60 * 1000,
      );

      const key = isHourly
        ? localCreatedAt.getUTCHours().toString().padStart(2, "0") + ":00"
        : localCreatedAt.toISOString().split("T")[0];

      if (dayMap[key]) {
        const cost = rawData.cost || 0;
        dayMap[key].cost += cost;

        const type = rawData.type as UsageType;
        if (type === "TEXT_RESPONSE") {
          dayMap[key].text += rawData.tokens || 0;
        } else if (type === "DOCUMENT_TRANSCRIPTION") {
          dayMap[key].document += rawData.tokens || 0;
        } else if (type === "VOICE_SESSION") {
          dayMap[key].voice += (rawData.seconds || 0) / 60;
        }
      }
    });

    const chartData = Object.values(dayMap)
      .sort((a, b) => a.sortKey - b.sortKey)
      .map(({ name, text, voice, document, cost }) => ({
        name,
        text,
        voice: parseFloat(voice.toFixed(2)),
        document,
        cost: parseFloat((cost / 100).toFixed(2)),
      }));

    const totalPeriodCost = chartData.reduce((sum, item) => sum + item.cost, 0);

    return { success: true, chartData, totalPeriodCost };
  } catch (error) {
    console.error("Error getting usage chart data:", error);
    return { success: false, chartData: [], totalPeriodCost: 0 };
  }
};

/**
 * Converts a UsageFilter preset into a { start, end } date range.
 *
 * All boundaries are anchored to the **user's local midnight**, not UTC.
 * The client passes timezoneOffset = new Date().getTimezoneOffset():
 *   - EAT (UTC+3)  → −180
 *   - EST (UTC−5)  → +300
 *
 * Without this, a Vercel/UTC server would treat "yesterday" as
 * UTC March 27, missing all records the user created on their local
 * March 28 (which are stored as UTC timestamps ≥ 00:00 UTC March 28).
 */
function getDateRange(
  filter: UsageFilter,
  customRange?: { start: string; end: string },
  timezoneOffset: number = 0,
): { start: string; end: string } {
  const now = new Date();

  // Step 1: Express "now" in the user's local wall-clock time, represented
  // as if it were UTC. E.g. 21:55 UTC for EAT user → 00:55 "UTC" (Mar 29).
  // timezoneOffset = UTC − local  ⟹  local = UTC − offset
  const localNow = new Date(now.getTime() - timezoneOffset * 60 * 1000);

  // Step 2: Truncate to local midnight (in the shifted representation)
  const localMidnightRep = new Date(localNow);
  localMidnightRep.setUTCHours(0, 0, 0, 0);

  // Step 3: Shift back to a real UTC instant that equals local midnight
  const localTodayStart = new Date(
    localMidnightRep.getTime() + timezoneOffset * 60 * 1000,
  );
  const localTodayEnd = new Date(
    localTodayStart.getTime() + 24 * 60 * 60 * 1000 - 1,
  );

  switch (filter) {
    case "today":
      return {
        start: localTodayStart.toISOString(),
        end: localTodayEnd.toISOString(),
      };

    case "yesterday": {
      const yStart = new Date(localTodayStart.getTime() - 24 * 60 * 60 * 1000);
      const yEnd = new Date(localTodayStart.getTime() - 1);
      return { start: yStart.toISOString(), end: yEnd.toISOString() };
    }

    case "last_week": {
      const wStart = new Date(
        localTodayStart.getTime() - 7 * 24 * 60 * 60 * 1000,
      );
      return { start: wStart.toISOString(), end: localTodayEnd.toISOString() };
    }

    case "month": {
      // 1st of the current local month at local midnight
      const localMonthStartRep = new Date(
        Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), 1),
      );
      const mStart = new Date(
        localMonthStartRep.getTime() + timezoneOffset * 60 * 1000,
      );
      return { start: mStart.toISOString(), end: localTodayEnd.toISOString() };
    }

    case "custom": {
      if (customRange?.start && customRange?.end) {
        // Date inputs are local YYYY-MM-DD strings; anchor them to local
        // midnight and end-of-day in the user's timezone.
        const csUTC = new Date(
          new Date(customRange.start + "T00:00:00Z").getTime() +
            timezoneOffset * 60 * 1000,
        );
        const ceUTC = new Date(
          new Date(customRange.end + "T00:00:00Z").getTime() +
            timezoneOffset * 60 * 1000 +
            24 * 60 * 60 * 1000 -
            1,
        );
        return { start: csUTC.toISOString(), end: ceUTC.toISOString() };
      }
      return {
        start: localTodayStart.toISOString(),
        end: localTodayEnd.toISOString(),
      };
    }

    default:
      return {
        start: localTodayStart.toISOString(),
        end: localTodayEnd.toISOString(),
      };
  }
}

/**
 * Gets the free credit history for a user with pagination.
 * @param userId - The authenticated user's ID
 * @param page - The current page number (1-indexed)
 * @param pageSize - The number of records per page
 * @returns Array of FreeCreditHistory records and metadata
 */
export const getFreeCreditHistory = async (
  userId: string,
  page: number = 1,
  pageSize: number = 10,
): Promise<{
  success: boolean;
  records: FreeCreditHistory[];
  totalCount: number;
  totalPages: number;
}> => {
  try {
    if (!userId) {
      return { success: false, records: [], totalCount: 0, totalPages: 0 };
    }

    const query = db
      .collection(COLLECTIONS.FREE_CREDIT_HISTORY)
      .where("userId", "==", userId);

    // Get total count for pagination metadata
    const countSnapshot = await query.count().get();
    const totalCount = countSnapshot.data().count;

    const snapshot = await query
      .orderBy("createdAt", "desc")
      .offset((page - 1) * pageSize)
      .limit(pageSize)
      .get();

    const records: FreeCreditHistory[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        createdAt:
          data.createdAt?.toDate().toISOString() || new Date().toISOString(),
      } as FreeCreditHistory;
    });

    return {
      success: true,
      records,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
    };
  } catch (error) {
    console.error("Error getting free credit history:", error);
    return { success: false, records: [], totalCount: 0, totalPages: 0 };
  }
};

