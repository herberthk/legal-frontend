"use server";

import { db } from "@/firebase/admin";
import { COLLECTIONS } from "@/constants";
import { checkRootCollection } from "./utils";

const MAX_SEARCH_SCAN = 250;

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
  tzOffsetMinutes?: number;
  customRange?: { start?: string; end?: string };
}): Promise<{
  success: boolean;
  sessions: VoiceSession[];
  totalCount: number;
  totalPages: number;
}> => {
  const {
    userId,
    page = 1,
    limit = 10,
    filter = "last_week",
    searchQuery = "",
    tzOffsetMinutes = 0,
    customRange,
  } = params;

  try {
    if (!userId) {
      return { success: false, sessions: [], totalCount: 0, totalPages: 0 };
    }

    const { start, end } = getDateRange(filter, tzOffsetMinutes, customRange);

    // Check if collection exists
    const collectionExists = await checkRootCollection(
      COLLECTIONS.VOICE_SESSIONS,
    );
    if (!collectionExists) {
      return { success: true, sessions: [], totalCount: 0, totalPages: 0 };
    }

    const { Timestamp } = await import("firebase-admin/firestore");
    const startTimestamp = Timestamp.fromDate(new Date(start));
    const endTimestamp = Timestamp.fromDate(new Date(end));

    const query = db
      .collection(COLLECTIONS.VOICE_SESSIONS)
      .where("userId", "==", userId)
      .where("createdAt", ">=", startTimestamp)
      .where("createdAt", "<=", endTimestamp)
      .orderBy("createdAt", "desc");

    // If no search query, we can use Firestore pagination efficiently
    // But since we are doing in-memory search filtering, we need to fetch all matching dates
    // ONLY if searchQuery is present. Otherwise, we limit here.

    let allSessions: VoiceSession[] = [];
    let totalCount = 0;
    const trimmedQuery = searchQuery.trim();

    if (trimmedQuery) {
      const snapshot = await query.limit(MAX_SEARCH_SCAN).get();
      allSessions = snapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
        createdAt:
          doc.data().createdAt?.toDate().toISOString() ||
          new Date().toISOString(),
      })) as VoiceSession[];

      const terms = normalizeSearchText(trimmedQuery)
        .split(/\s+/)
        .filter(Boolean);
      allSessions = allSessions.filter((s) => matchesSearchTerms(s, terms));

      totalCount = allSessions.length;
      allSessions = allSessions.slice((page - 1) * limit, page * limit);
    } else {
      // Get total count for pagination
      const countSnapshot = await query.count().get();
      totalCount = countSnapshot.data().count;

      // Fetch only the needed page
      const snapshot = await query
        .limit(limit)
        .offset((page - 1) * limit)
        .get();

      allSessions = snapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
        createdAt:
          doc.data().createdAt?.toDate().toISOString() ||
          new Date().toISOString(),
      })) as VoiceSession[];
    }

    const totalPages = Math.ceil(totalCount / limit);

    return {
      success: true,
      sessions: allSessions,
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
export const getVoiceSessionById = async (
  sessionId: string,
): Promise<VoiceSession | null> => {
  try {
    const doc = await db
      .collection(COLLECTIONS.VOICE_SESSIONS)
      .doc(sessionId)
      .get();
    if (!doc.exists) return null;
    return {
      ...doc.data(),
      id: doc.id,
      createdAt:
        doc.data()?.createdAt?.toDate().toISOString() ||
        new Date().toISOString(),
    } as VoiceSession;
  } catch (error) {
    console.error("Error getting voice session by id:", error);
    return null;
  }
};

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function matchesSearchTerms(session: VoiceSession, terms: string[]): boolean {
  if (terms.length === 0) return true;
  const transcriptText = Array.isArray(session.transcripts)
    ? session.transcripts.map((entry) => entry?.content || "").join(" ")
    : "";
  const haystack = normalizeSearchText(
    [
      session.title || "",
      session.summary || "",
      session.id || "",
      session.sessionId || "",
      transcriptText,
    ].join(" "),
  );
  return terms.every((term) => haystack.includes(term));
}

function parseCalendarDateUtcMs(ymd: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!match) return null;
  const year = Number(match[1]);
  if (year < 1970 || year > 2100) return null;
  const month = Number(match[2]);
  const day = Number(match[3]);
  const ms = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  const probe = new Date(ms);
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  return ms;
}

/**
 * Helper to get date range in the caller's timezone offset (`Date.getTimezoneOffset` minutes).
 */
function getDateRange(
  filter: UsageFilter,
  tzOffsetMinutes = 0,
  customRange?: { start?: string; end?: string },
): { start: string; end: string } {
  const clampedOffset = Number.isFinite(tzOffsetMinutes)
    ? Math.max(-840, Math.min(840, Math.trunc(tzOffsetMinutes)))
    : 0;
  const offsetMs = clampedOffset * 60_000;
  const nowMs = Date.now();
  const shifted = new Date(nowMs - offsetMs);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth();
  const day = shifted.getUTCDate();

  const todayStartMs = Date.UTC(year, month, day, 0, 0, 0, 0) + offsetMs;
  const todayEndMs = Date.UTC(year, month, day, 23, 59, 59, 999) + offsetMs;

  switch (filter) {
    case "today":
      return {
        start: new Date(todayStartMs).toISOString(),
        end: new Date(todayEndMs).toISOString(),
      };

    case "yesterday":
      return {
        start: new Date(todayStartMs - 86_400_000).toISOString(),
        end: new Date(todayStartMs - 1).toISOString(),
      };

    case "last_week":
      return {
        start: new Date(todayStartMs - 7 * 86_400_000).toISOString(),
        end: new Date(todayEndMs).toISOString(),
      };

    case "month":
      return {
        start: new Date(Date.UTC(year, month, 1, 0, 0, 0, 0) + offsetMs).toISOString(),
        end: new Date(todayEndMs).toISOString(),
      };

    case "custom": {
      const startBase = customRange?.start
        ? parseCalendarDateUtcMs(customRange.start)
        : null;
      const endBase = customRange?.end
        ? parseCalendarDateUtcMs(customRange.end)
        : null;

      if (startBase !== null && endBase !== null) {
        const loBase = Math.min(startBase, endBase);
        const hiBase = Math.max(startBase, endBase);
        return {
          start: new Date(loBase + offsetMs).toISOString(),
          end: new Date(hiBase + offsetMs + 86_400_000 - 1).toISOString(),
        };
      }
      if (startBase !== null) {
        const startMs = startBase + offsetMs;
        return {
          start: new Date(startMs).toISOString(),
          end: new Date(
            Math.max(todayEndMs, startMs + 86_400_000 - 1, nowMs + 60_000),
          ).toISOString(),
        };
      }
      if (endBase !== null) {
        return {
          start: "1970-01-01T00:00:00.000Z",
          end: new Date(endBase + offsetMs + 86_400_000 - 1).toISOString(),
        };
      }
      return {
        start: "1970-01-01T00:00:00.000Z",
        end: new Date(Math.max(todayEndMs, nowMs + 60_000)).toISOString(),
      };
    }

    default:
      return {
        start: new Date(todayStartMs).toISOString(),
        end: new Date(todayEndMs).toISOString(),
      };
  }
}
