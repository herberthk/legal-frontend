"use server";

import { db } from "@/firebase/admin";
import { COLLECTIONS } from "@/constants";
import { checkRootCollection } from "./utils";

/**
 * Gets paginated and filtered voice sessions for a user.
 * @param params - Search and filter parameters
 * @returns Array of voice sessions and pagination metadata
 */
export const getVoiceSessions = async (params: {
  userId: string;
  page?: number;
  limit?: number;
  filter?: UsageFilter;
  searchQuery?: string;
}): Promise<{
  success: boolean;
  sessions: VoiceSession[];
  totalCount: number;
  totalPages: number;
}> => {
  const { userId, page = 1, limit = 10, filter = "last_week", searchQuery = "" } = params;

  try {
    if (!userId) {
      return { success: false, sessions: [], totalCount: 0, totalPages: 0 };
    }

    const { start, end } = getDateRange(filter);
    
    // Check if collection exists
    const collectionExists = await checkRootCollection(COLLECTIONS.VOICE_SESSIONS);
    if (!collectionExists) {
      return { success: true, sessions: [], totalCount: 0, totalPages: 0 };
    }

    const query = db.collection(COLLECTIONS.VOICE_SESSIONS)
      .where("userId", "==", userId)
      .where("date", ">=", start)
      .where("date", "<=", end)
      .orderBy("date", "desc");

    // Fetch all matching for client-side search if searchQuery is provided
    // Firestore doesn't support full-text search without external tools
    // But for a reasonable number of sessions per user, we can filter in memory or fetch all and filter
    // For performance, let's fetch matching dates first.
    
    const snapshot = await query.get();
    let allSessions = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as VoiceSession[];

    // Apply search filter if present
    if (searchQuery) {
      const queryLower = searchQuery.toLowerCase();
      allSessions = allSessions.filter(s => 
        (s.title || "").toLowerCase().includes(queryLower) || 
        (s.summary || "").toLowerCase().includes(queryLower)
      );
    }

    const totalCount = allSessions.length;
    const totalPages = Math.ceil(totalCount / limit);
    const paginatedSessions = allSessions.slice((page - 1) * limit, page * limit);

    return {
      success: true,
      sessions: paginatedSessions,
      totalCount,
      totalPages,
    };
  } catch (error) {
    console.error("Error getting voice sessions:", error);
    return { success: false, sessions: [], totalCount: 0, totalPages: 0 };
  }
};

/**
 * Gets a single voice session by ID.
 */
export const getVoiceSessionById = async (sessionId: string): Promise<VoiceSession | null> => {
  try {
    const doc = await db.collection(COLLECTIONS.VOICE_SESSIONS).doc(sessionId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as VoiceSession;
  } catch (error) {
    console.error("Error getting voice session by id:", error);
    return null;
  }
};

/**
 * Helper to get date range similar to usage.ts
 */
function getDateRange(filter: UsageFilter): { start: string; end: string } {
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
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      return { start: monthStart.toISOString(), end: todayEnd.toISOString() };
    }

    case "custom": // Show all for "custom" in this context
      return { start: "1970-01-01T00:00:00.000Z", end: todayEnd.toISOString() };

    default:
      return { start: todayStart.toISOString(), end: todayEnd.toISOString() };
  }
}
