"use server";

import { db } from "@/firebase/admin";
import {
  COLLECTIONS,
  USD_TO_UGX_EXCHANGE_RATE,
  COST_PER_THOUSAND_TOKENS,
  COST_PER_VOICE_MINUTE,
} from "@/constants";
import { AggregateField, FieldValue } from "firebase-admin/firestore";
import { getAuthenticatedAdmin } from "./auth";

export type AdminUserSummaryStats = {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  bannedUsers: number;
  deletedUsers: number;
};

export const getAdminUserSummaryStats = async (): Promise<{
  success: boolean;
  stats?: AdminUserSummaryStats;
  error?: string;
}> => {
  try {
    const snapshot = await db.collection(COLLECTIONS.USERS).get();
    let totalUsers = 0;
    let activeUsers = 0;
    let suspendedUsers = 0;
    let bannedUsers = 0;
    let deletedUsers = 0;

    const currentAdmin = await getAuthenticatedAdmin();

    snapshot.forEach((doc) => {
      if (currentAdmin && doc.id === currentAdmin.id) return;
      const data = doc.data();
      totalUsers++;
      if (data.isDeleted) {
        deletedUsers++;
      } else if (data.status === "active") {
        activeUsers++;
      } else if (data.status === "suspended") {
        suspendedUsers++;
      } else if (data.status === "banned") {
        bannedUsers++;
      }
    });

    return {
      success: true,
      stats: { totalUsers, activeUsers, suspendedUsers, bannedUsers, deletedUsers },
    };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("getAdminUserSummaryStats error:", error);
    return { success: false, error: error.message };
  }
};

export type AdminOverviewStats = {
  totalUsers: number;
  totalTokens: number;
  totalVoiceSeconds: number;
  totalVoiceSessions: number;
  totalCostUsd: number;
  totalCostUgx: number;
  chatTokens: number;
  transcriptionTokens: number;
  chatCostUsd: number;
  transcriptionCostUsd: number;
  voiceCostUsd: number;
  googleChatCostUsd: number;
  googleTranscriptionCostUsd: number;
  googleVoiceCostUsd: number;
  googleTotalCostUsd: number;
  expectedChatRevenueUsd: number;
  expectedTranscriptionRevenueUsd: number;
  expectedVoiceRevenueUsd: number;
  expectedTotalRevenueUsd: number;
  realizedProfitUsd: number;
  realizedProfitUgx: number;
  profitMarginPercent: number;
  expectedProfitUsd: number;
  expectedProfitUgx: number;
  expectedProfitMarginPercent: number;
  timeSeriesData: {
    date: string;
    chatTokens: number;
    transcriptionTokens: number;
    voiceSeconds: number;
    cost: number;
    googleCost: number;
    expectedRevenue: number;
    profit: number;
  }[];
};

export type DemographicsEntry = { key: string; label: string; count: number };

export type AdminDemographicsStats = {
  totalSessions: number;
  devices: DemographicsEntry[];
  browsers: DemographicsEntry[];
  operatingSystems: DemographicsEntry[];
  countries: DemographicsEntry[];
  cities: DemographicsEntry[];
  updatedAt: string | null;
};

export const getAdminOverviewStats = async (): Promise<
  { success: boolean; stats?: AdminOverviewStats; error?: string }
> => {
  try {
    const usersSnapshot = await db.collection(COLLECTIONS.USERS).count().get();
    const totalUsers = usersSnapshot.data().count;

    const usageRef = db.collection(COLLECTIONS.USAGE);
    const usageAggregate = await usageRef.aggregate({
      totalTokens: AggregateField.sum('tokens'),
      totalCost: AggregateField.sum('cost'),
      totalSeconds: AggregateField.sum('seconds'),
    }).get();

    const { totalTokens, totalCost: totalCostInCents, totalSeconds: totalVoiceSeconds } = usageAggregate.data();

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      voiceCountSnap,
      voiceAggSnap,
      chatAggSnap,
      transcriptionAggSnap,
      recentUsageSnapshot,
    ] = await Promise.all([
      usageRef.where("type", "==", "VOICE_SESSION").count().get(),
      usageRef.where("type", "==", "VOICE_SESSION").aggregate({ cost: AggregateField.sum('cost') }).get(),
      usageRef.where("type", "==", "TEXT_RESPONSE").aggregate({ tokens: AggregateField.sum('tokens'), cost: AggregateField.sum('cost') }).get(),
      usageRef.where("type", "==", "DOCUMENT_TRANSCRIPTION").aggregate({ tokens: AggregateField.sum('tokens'), cost: AggregateField.sum('cost') }).get(),
      usageRef.where("createdAt", ">=", thirtyDaysAgo).orderBy("createdAt", "asc").get(),
    ]);

    const totalVoiceSessions = voiceCountSnap.data().count;
    const voiceCostInCents   = voiceAggSnap.data().cost || 0;
    const chatTokens         = chatAggSnap.data().tokens || 0;
    const chatCostInCents    = chatAggSnap.data().cost || 0;
    const transcriptionTokens    = transcriptionAggSnap.data().tokens || 0;
    const transcriptionCostInCents = transcriptionAggSnap.data().cost || 0;

    const GOOGLE_TOKEN_COST_RATE = 0.0000035;
    const GOOGLE_VOICE_COST_RATE_PER_SECOND = 0.023 / 60;
    const OUR_TOKEN_BILLING_RATE = COST_PER_THOUSAND_TOKENS / 1000;
    const OUR_VOICE_BILLING_RATE_PER_SECOND = COST_PER_VOICE_MINUTE / 60;

    const googleChatCostUsd = chatTokens * GOOGLE_TOKEN_COST_RATE;
    const googleTranscriptionCostUsd = transcriptionTokens * GOOGLE_TOKEN_COST_RATE;
    const googleVoiceCostUsd = (totalVoiceSeconds || 0) * GOOGLE_VOICE_COST_RATE_PER_SECOND;
    const googleTotalCostUsd = googleChatCostUsd + googleTranscriptionCostUsd + googleVoiceCostUsd;

    const expectedChatRevenueUsd = chatTokens * OUR_TOKEN_BILLING_RATE;
    const expectedTranscriptionRevenueUsd = transcriptionTokens * OUR_TOKEN_BILLING_RATE;
    const expectedVoiceRevenueUsd = (totalVoiceSeconds || 0) * OUR_VOICE_BILLING_RATE_PER_SECOND;
    const expectedTotalRevenueUsd = expectedChatRevenueUsd + expectedTranscriptionRevenueUsd + expectedVoiceRevenueUsd;

    const totalCostUsd = (totalCostInCents || 0) / 100;
    const totalCostUgx = totalCostUsd * USD_TO_UGX_EXCHANGE_RATE;
    const realizedProfitUsd = totalCostUsd - googleTotalCostUsd;
    const realizedProfitUgx = realizedProfitUsd * USD_TO_UGX_EXCHANGE_RATE;
    const profitMarginPercent = totalCostUsd > 0 ? (realizedProfitUsd / totalCostUsd) * 100 : 0;
    const expectedProfitUsd = expectedTotalRevenueUsd - googleTotalCostUsd;
    const expectedProfitUgx = expectedProfitUsd * USD_TO_UGX_EXCHANGE_RATE;
    const expectedProfitMarginPercent = expectedTotalRevenueUsd > 0 ? (expectedProfitUsd / expectedTotalRevenueUsd) * 100 : 0;

    const dayMap: Record<string, { date: string; chatTokens: number; transcriptionTokens: number; voiceSeconds: number; cost: number; googleCost: number; expectedRevenue: number; profit: number; }> = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      const key = d.toISOString().split("T")[0];
      dayMap[key] = { date: key, chatTokens: 0, transcriptionTokens: 0, voiceSeconds: 0, cost: 0, googleCost: 0, expectedRevenue: 0, profit: 0 };
    }

    recentUsageSnapshot.forEach((doc) => {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate();
      if (!createdAt) return;
      const key = createdAt.toISOString().split("T")[0];
      if (dayMap[key]) {
        if (data.type === "TEXT_RESPONSE") dayMap[key].chatTokens += data.tokens || 0;
        else if (data.type === "DOCUMENT_TRANSCRIPTION") dayMap[key].transcriptionTokens += data.tokens || 0;
        else if (data.type === "VOICE_SESSION") dayMap[key].voiceSeconds += data.seconds || 0;
        dayMap[key].cost += (data.cost || 0) / 100;
      }
    });

    Object.keys(dayMap).forEach((key) => {
      const day = dayMap[key];
      day.googleCost = (day.chatTokens + day.transcriptionTokens) * GOOGLE_TOKEN_COST_RATE + day.voiceSeconds * GOOGLE_VOICE_COST_RATE_PER_SECOND;
      day.expectedRevenue = (day.chatTokens + day.transcriptionTokens) * OUR_TOKEN_BILLING_RATE + day.voiceSeconds * OUR_VOICE_BILLING_RATE_PER_SECOND;
      day.profit = day.cost - day.googleCost;
    });

    return {
      success: true,
      stats: {
        totalUsers,
        totalTokens: totalTokens || 0,
        totalVoiceSeconds: totalVoiceSeconds || 0,
        totalVoiceSessions,
        totalCostUsd,
        totalCostUgx,
        chatTokens: chatTokens || 0,
        transcriptionTokens: transcriptionTokens || 0,
        chatCostUsd: chatCostInCents / 100,
        transcriptionCostUsd: transcriptionCostInCents / 100,
        voiceCostUsd: voiceCostInCents / 100,
        googleChatCostUsd,
        googleTranscriptionCostUsd,
        googleVoiceCostUsd,
        googleTotalCostUsd,
        expectedChatRevenueUsd,
        expectedTranscriptionRevenueUsd,
        expectedVoiceRevenueUsd,
        expectedTotalRevenueUsd,
        realizedProfitUsd,
        realizedProfitUgx,
        profitMarginPercent,
        expectedProfitUsd,
        expectedProfitUgx,
        expectedProfitMarginPercent,
        timeSeriesData: Object.values(dayMap),
      },
    };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("Error fetching admin stats:", error);
    return { success: false, error: error.message };
  }
};

function toSortedEntries(
  counts: Record<string, number>,
  labels: Record<string, string>,
  limit = 10,
): DemographicsEntry[] {
  return Object.entries(counts)
    .map(([key, count]) => ({ key, label: labels?.[key] ?? key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// ─── Date-range-scoped overview stats ────────────────────────────────────────

export type DateRangeInput = {
  startDate: string; // ISO date string e.g. "2025-01-01"
  endDate: string;   // ISO date string e.g. "2025-01-31"
};

export const getAdminOverviewStatsByRange = async (
  range: DateRangeInput,
): Promise<{ success: boolean; stats?: AdminOverviewStats; error?: string }> => {
  try {
    const start = new Date(range.startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(range.endDate);
    end.setHours(23, 59, 59, 999);

    const usersSnapshot = await db.collection(COLLECTIONS.USERS).count().get();
    const totalUsers = usersSnapshot.data().count;

    const usageRef = db.collection(COLLECTIONS.USAGE);
    const rangeRef = usageRef.where("createdAt", ">=", start).where("createdAt", "<=", end);

    const [
      rangeAggregate,
      voiceCountSnap,
      voiceAggSnap,
      chatAggSnap,
      transcriptionAggSnap,
      rangeUsageSnapshot,
    ] = await Promise.all([
      rangeRef.aggregate({
        totalTokens: AggregateField.sum("tokens"),
        totalCost: AggregateField.sum("cost"),
        totalSeconds: AggregateField.sum("seconds"),
      }).get(),
      rangeRef.where("type", "==", "VOICE_SESSION").count().get(),
      rangeRef.where("type", "==", "VOICE_SESSION").aggregate({ cost: AggregateField.sum("cost") }).get(),
      rangeRef.where("type", "==", "TEXT_RESPONSE").aggregate({ tokens: AggregateField.sum("tokens"), cost: AggregateField.sum("cost") }).get(),
      rangeRef.where("type", "==", "DOCUMENT_TRANSCRIPTION").aggregate({ tokens: AggregateField.sum("tokens"), cost: AggregateField.sum("cost") }).get(),
      rangeRef.orderBy("createdAt", "asc").get(),
    ]);

    const { totalTokens, totalCost: totalCostInCents, totalSeconds: totalVoiceSeconds } = rangeAggregate.data();

    const totalVoiceSessions        = voiceCountSnap.data().count;
    const voiceCostInCents          = voiceAggSnap.data().cost || 0;
    const chatTokens                = chatAggSnap.data().tokens || 0;
    const chatCostInCents           = chatAggSnap.data().cost || 0;
    const transcriptionTokens       = transcriptionAggSnap.data().tokens || 0;
    const transcriptionCostInCents  = transcriptionAggSnap.data().cost || 0;

    const GOOGLE_TOKEN_COST_RATE             = 0.0000035;
    const GOOGLE_VOICE_COST_RATE_PER_SECOND  = 0.023 / 60;
    const OUR_TOKEN_BILLING_RATE             = COST_PER_THOUSAND_TOKENS / 1000;
    const OUR_VOICE_BILLING_RATE_PER_SECOND  = COST_PER_VOICE_MINUTE / 60;

    const googleChatCostUsd              = chatTokens * GOOGLE_TOKEN_COST_RATE;
    const googleTranscriptionCostUsd     = transcriptionTokens * GOOGLE_TOKEN_COST_RATE;
    const googleVoiceCostUsd             = (totalVoiceSeconds || 0) * GOOGLE_VOICE_COST_RATE_PER_SECOND;
    const googleTotalCostUsd             = googleChatCostUsd + googleTranscriptionCostUsd + googleVoiceCostUsd;

    const expectedChatRevenueUsd         = chatTokens * OUR_TOKEN_BILLING_RATE;
    const expectedTranscriptionRevenueUsd = transcriptionTokens * OUR_TOKEN_BILLING_RATE;
    const expectedVoiceRevenueUsd        = (totalVoiceSeconds || 0) * OUR_VOICE_BILLING_RATE_PER_SECOND;
    const expectedTotalRevenueUsd        = expectedChatRevenueUsd + expectedTranscriptionRevenueUsd + expectedVoiceRevenueUsd;

    const totalCostUsd              = (totalCostInCents || 0) / 100;
    const totalCostUgx              = totalCostUsd * USD_TO_UGX_EXCHANGE_RATE;
    const realizedProfitUsd         = totalCostUsd - googleTotalCostUsd;
    const realizedProfitUgx         = realizedProfitUsd * USD_TO_UGX_EXCHANGE_RATE;
    const profitMarginPercent       = totalCostUsd > 0 ? (realizedProfitUsd / totalCostUsd) * 100 : 0;
    const expectedProfitUsd         = expectedTotalRevenueUsd - googleTotalCostUsd;
    const expectedProfitUgx         = expectedProfitUsd * USD_TO_UGX_EXCHANGE_RATE;
    const expectedProfitMarginPercent = expectedTotalRevenueUsd > 0 ? (expectedProfitUsd / expectedTotalRevenueUsd) * 100 : 0;

    // Build an adaptive time-series: daily ≤90 days, weekly ≤365 days, monthly otherwise
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    type BucketEntry = { date: string; chatTokens: number; transcriptionTokens: number; voiceSeconds: number; cost: number; googleCost: number; expectedRevenue: number; profit: number };
    const bucketMap: Record<string, BucketEntry> = {};

    const getBucketKey = (d: Date): string => {
      if (diffDays <= 90) {
        return d.toISOString().split("T")[0]; // daily
      } else if (diffDays <= 365) {
        // ISO week: Monday of that week
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d);
        monday.setDate(diff);
        return monday.toISOString().split("T")[0];
      } else {
        // Monthly
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
      }
    };

    // Pre-fill all buckets in the range
    const cur = new Date(start);
    while (cur <= end) {
      const key = getBucketKey(cur);
      if (!bucketMap[key]) {
        bucketMap[key] = { date: key, chatTokens: 0, transcriptionTokens: 0, voiceSeconds: 0, cost: 0, googleCost: 0, expectedRevenue: 0, profit: 0 };
      }
      if (diffDays <= 90) {
        cur.setDate(cur.getDate() + 1);
      } else if (diffDays <= 365) {
        cur.setDate(cur.getDate() + 7);
      } else {
        cur.setMonth(cur.getMonth() + 1);
      }
    }

    rangeUsageSnapshot.forEach((doc) => {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate();
      if (!createdAt) return;
      const key = getBucketKey(createdAt);
      if (bucketMap[key]) {
        if (data.type === "TEXT_RESPONSE") bucketMap[key].chatTokens += data.tokens || 0;
        else if (data.type === "DOCUMENT_TRANSCRIPTION") bucketMap[key].transcriptionTokens += data.tokens || 0;
        else if (data.type === "VOICE_SESSION") bucketMap[key].voiceSeconds += data.seconds || 0;
        bucketMap[key].cost += (data.cost || 0) / 100;
      }
    });

    Object.keys(bucketMap).forEach((key) => {
      const b = bucketMap[key];
      b.googleCost = (b.chatTokens + b.transcriptionTokens) * GOOGLE_TOKEN_COST_RATE + b.voiceSeconds * GOOGLE_VOICE_COST_RATE_PER_SECOND;
      b.expectedRevenue = (b.chatTokens + b.transcriptionTokens) * OUR_TOKEN_BILLING_RATE + b.voiceSeconds * OUR_VOICE_BILLING_RATE_PER_SECOND;
      b.profit = b.cost - b.googleCost;
    });

    return {
      success: true,
      stats: {
        totalUsers,
        totalTokens: totalTokens || 0,
        totalVoiceSeconds: totalVoiceSeconds || 0,
        totalVoiceSessions,
        totalCostUsd,
        totalCostUgx,
        chatTokens: chatTokens || 0,
        transcriptionTokens: transcriptionTokens || 0,
        chatCostUsd: chatCostInCents / 100,
        transcriptionCostUsd: transcriptionCostInCents / 100,
        voiceCostUsd: voiceCostInCents / 100,
        googleChatCostUsd,
        googleTranscriptionCostUsd,
        googleVoiceCostUsd,
        googleTotalCostUsd,
        expectedChatRevenueUsd,
        expectedTranscriptionRevenueUsd,
        expectedVoiceRevenueUsd,
        expectedTotalRevenueUsd,
        realizedProfitUsd,
        realizedProfitUgx,
        profitMarginPercent,
        expectedProfitUsd,
        expectedProfitUgx,
        expectedProfitMarginPercent,
        timeSeriesData: Object.values(bucketMap).sort((a, b) => a.date.localeCompare(b.date)),
      },
    };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("Error fetching admin stats by range:", error);
    return { success: false, error: error.message };
  }
};

// ─── Demographics ─────────────────────────────────────────────────────────────

export const getAdminDemographicsStats = async (): Promise<
  { success: boolean; stats?: AdminDemographicsStats; error?: string }
> => {
  try {
    const analyticsRef = db.collection(COLLECTIONS.ANALYTICS).doc("demographics");
    const snap = await analyticsRef.get();

    if (!snap.exists) {
      const rawSnap = await db.collection(COLLECTIONS.USER_STATS).get();
      const browsers: Record<string, number> = {};
      const browserLabels: Record<string, string> = {};
      const operatingSystems: Record<string, number> = {};
      const osLabels: Record<string, string> = {};
      const devices: Record<string, number> = {};
      const deviceLabels: Record<string, string> = {};
      const countries: Record<string, number> = {};
      const countryLabels: Record<string, string> = {};
      const cities: Record<string, number> = {};
      const cityLabels: Record<string, string> = {};
      let totalSessions = 0;

      rawSnap.forEach((doc) => {
        const d = doc.data();
        totalSessions++;
        const norm = (v: string) => (v || "Unknown").toLowerCase().replace(/[^a-z0-9]/g, "_");
        const bKey = norm(d.browser); browsers[bKey] = (browsers[bKey] || 0) + 1; browserLabels[bKey] = d.browser || "Unknown";
        const oKey = norm(d.os); operatingSystems[oKey] = (operatingSystems[oKey] || 0) + 1; osLabels[oKey] = d.os || "Unknown";
        const dKey = norm(d.device); devices[dKey] = (devices[dKey] || 0) + 1; deviceLabels[dKey] = d.device || "Desktop";
        const cKey = norm(d.country); countries[cKey] = (countries[cKey] || 0) + 1; countryLabels[cKey] = d.country || "Unknown";
        const cityKey = norm(d.city); cities[cityKey] = (cities[cityKey] || 0) + 1; cityLabels[cityKey] = d.city || "Unknown";
      });

      const compiledData = {
        totalSessions, browsers, browserLabels, operatingSystems, osLabels,
        devices, deviceLabels, countries, countryLabels, cities, cityLabels,
        updatedAt: FieldValue.serverTimestamp(),
      };
      await analyticsRef.set(compiledData);

      return {
        success: true,
        stats: {
          totalSessions,
          devices: toSortedEntries(devices, deviceLabels),
          browsers: toSortedEntries(browsers, browserLabels),
          operatingSystems: toSortedEntries(operatingSystems, osLabels),
          countries: toSortedEntries(countries, countryLabels),
          cities: toSortedEntries(cities, cityLabels),
          updatedAt: new Date().toISOString(),
        },
      };
    }

    const data = snap.data()!;
    return {
      success: true,
      stats: {
        totalSessions: data.totalSessions || 0,
        devices: toSortedEntries(data.devices || {}, data.deviceLabels || {}),
        browsers: toSortedEntries(data.browsers || {}, data.browserLabels || {}),
        operatingSystems: toSortedEntries(data.operatingSystems || {}, data.osLabels || {}),
        countries: toSortedEntries(data.countries || {}, data.countryLabels || {}),
        cities: toSortedEntries(data.cities || {}, data.cityLabels || {}),
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? null,
      },
    };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("Error fetching admin demographics:", error);
    return { success: false, error: error.message };
  }
};
