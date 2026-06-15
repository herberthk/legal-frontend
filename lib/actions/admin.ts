"use server";

import { db } from "@/firebase/admin";
import {
  COLLECTIONS,
  USD_TO_UGX_EXCHANGE_RATE,
  COST_PER_THOUSAND_TOKENS,
  COST_PER_VOICE_MINUTE,
} from "@/constants";
import { AggregateField, FieldValue } from "firebase-admin/firestore";

export type AdminOverviewStats = {
  totalUsers: number;
  totalTokens: number;
  totalVoiceSeconds: number;
  totalVoiceSessions: number;
  totalCostUsd: number; // Realized Revenue (USD)
  totalCostUgx: number; // Realized Revenue (UGX)
  chatTokens: number;
  transcriptionTokens: number;
  chatCostUsd: number; // Realized Chat Revenue
  transcriptionCostUsd: number; // Realized Transcription Revenue
  voiceCostUsd: number; // Realized Voice Revenue
  
  // Google API Costs
  googleChatCostUsd: number;
  googleTranscriptionCostUsd: number;
  googleVoiceCostUsd: number;
  googleTotalCostUsd: number;

  // Expected Revenue (gross value based on our rates)
  expectedChatRevenueUsd: number;
  expectedTranscriptionRevenueUsd: number;
  expectedVoiceRevenueUsd: number;
  expectedTotalRevenueUsd: number;

  // Net Profit (Realized - Google Cost)
  realizedProfitUsd: number;
  realizedProfitUgx: number;
  profitMarginPercent: number;

  // Expected Profit (Expected - Google Cost)
  expectedProfitUsd: number;
  expectedProfitUgx: number;
  expectedProfitMarginPercent: number;

  timeSeriesData: {
    date: string;
    chatTokens: number;
    transcriptionTokens: number;
    voiceSeconds: number;
    cost: number; // Realized Revenue
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
    // 1. Total Users
    const usersSnapshot = await db.collection(COLLECTIONS.USERS).count().get();
    const totalUsers = usersSnapshot.data().count;

    // 2. Aggregate all usage
    const usageRef = db.collection(COLLECTIONS.USAGE);
    const usageAggregate = await usageRef.aggregate({
      totalTokens: AggregateField.sum('tokens'),
      totalCost: AggregateField.sum('cost'), // cost is stored in cents
      totalSeconds: AggregateField.sum('seconds'),
    }).get();

    const { totalTokens, totalCost: totalCostInCents, totalSeconds: totalVoiceSeconds } = usageAggregate.data();

    // 3. Run all per-type aggregates in parallel — saves ~4 round-trips
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
      // 4. Time-series: last 30 days fetched in the same round-trip batch
      usageRef.where("createdAt", ">=", thirtyDaysAgo).orderBy("createdAt", "asc").get(),
    ]);

    const totalVoiceSessions = voiceCountSnap.data().count;
    const voiceCostInCents   = voiceAggSnap.data().cost || 0;
    const chatTokens         = chatAggSnap.data().tokens || 0;
    const chatCostInCents    = chatAggSnap.data().cost || 0;
    const transcriptionTokens    = transcriptionAggSnap.data().tokens || 0;
    const transcriptionCostInCents = transcriptionAggSnap.data().cost || 0;

    // Billing rates and Google cost rates
    const GOOGLE_TOKEN_COST_RATE = 0.0000035; // $3.5 per 1M tokens
    const GOOGLE_VOICE_COST_RATE_PER_SECOND = 0.023 / 60; // $0.023 per minute

    const OUR_TOKEN_BILLING_RATE = COST_PER_THOUSAND_TOKENS / 1000; // $0.027 per 1k tokens = $0.000027 per token
    const OUR_VOICE_BILLING_RATE_PER_SECOND = COST_PER_VOICE_MINUTE / 60; // $0.08 per minute

    // Compute Google Cost Totals
    const googleChatCostUsd = chatTokens * GOOGLE_TOKEN_COST_RATE;
    const googleTranscriptionCostUsd = transcriptionTokens * GOOGLE_TOKEN_COST_RATE;
    const googleVoiceCostUsd = (totalVoiceSeconds || 0) * GOOGLE_VOICE_COST_RATE_PER_SECOND;
    const googleTotalCostUsd = googleChatCostUsd + googleTranscriptionCostUsd + googleVoiceCostUsd;

    // Compute Expected Revenue Totals (if all usage was paid)
    const expectedChatRevenueUsd = chatTokens * OUR_TOKEN_BILLING_RATE;
    const expectedTranscriptionRevenueUsd = transcriptionTokens * OUR_TOKEN_BILLING_RATE;
    const expectedVoiceRevenueUsd = (totalVoiceSeconds || 0) * OUR_VOICE_BILLING_RATE_PER_SECOND;
    const expectedTotalRevenueUsd = expectedChatRevenueUsd + expectedTranscriptionRevenueUsd + expectedVoiceRevenueUsd;

    // Realized Revenue and Profits
    const totalCostUsd = (totalCostInCents || 0) / 100;
    const totalCostUgx = totalCostUsd * USD_TO_UGX_EXCHANGE_RATE;
    
    const realizedProfitUsd = totalCostUsd - googleTotalCostUsd;
    const realizedProfitUgx = realizedProfitUsd * USD_TO_UGX_EXCHANGE_RATE;
    const profitMarginPercent = totalCostUsd > 0 ? (realizedProfitUsd / totalCostUsd) * 100 : 0;

    // Expected Profits
    const expectedProfitUsd = expectedTotalRevenueUsd - googleTotalCostUsd;
    const expectedProfitUgx = expectedProfitUsd * USD_TO_UGX_EXCHANGE_RATE;
    const expectedProfitMarginPercent = expectedTotalRevenueUsd > 0 ? (expectedProfitUsd / expectedTotalRevenueUsd) * 100 : 0;

    const dayMap: Record<
      string,
      {
        date: string;
        chatTokens: number;
        transcriptionTokens: number;
        voiceSeconds: number;
        cost: number;
        googleCost: number;
        expectedRevenue: number;
        profit: number;
      }
    > = {};
    
    // Initialize last 30 days with 0
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      const key = d.toISOString().split("T")[0];
      dayMap[key] = {
        date: key,
        chatTokens: 0,
        transcriptionTokens: 0,
        voiceSeconds: 0,
        cost: 0,
        googleCost: 0,
        expectedRevenue: 0,
        profit: 0,
      };
    }

    recentUsageSnapshot.forEach((doc) => {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate();
      if (!createdAt) return;

      const key = createdAt.toISOString().split("T")[0];
      if (dayMap[key]) {
        if (data.type === "TEXT_RESPONSE") {
          dayMap[key].chatTokens += data.tokens || 0;
        } else if (data.type === "DOCUMENT_TRANSCRIPTION") {
          dayMap[key].transcriptionTokens += data.tokens || 0;
        } else if (data.type === "VOICE_SESSION") {
          dayMap[key].voiceSeconds += data.seconds || 0;
        }
        dayMap[key].cost += (data.cost || 0) / 100; // convert cents to dollars
      }
    });

    // Populate day-by-day calculations
    Object.keys(dayMap).forEach((key) => {
      const day = dayMap[key];
      const gChat = day.chatTokens * GOOGLE_TOKEN_COST_RATE;
      const gTrans = day.transcriptionTokens * GOOGLE_TOKEN_COST_RATE;
      const gVoice = day.voiceSeconds * GOOGLE_VOICE_COST_RATE_PER_SECOND;
      day.googleCost = gChat + gTrans + gVoice;

      const eChat = day.chatTokens * OUR_TOKEN_BILLING_RATE;
      const eTrans = day.transcriptionTokens * OUR_TOKEN_BILLING_RATE;
      const eVoice = day.voiceSeconds * OUR_VOICE_BILLING_RATE_PER_SECOND;
      day.expectedRevenue = eChat + eTrans + eVoice;

      day.profit = day.cost - day.googleCost;
    });

    const timeSeriesData = Object.values(dayMap);

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
        timeSeriesData,
      },
    };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("Error fetching admin stats:", error);
    return { success: false, error: error.message };
  }
};

/** Convert a flat object of {key: count} + labels object into sorted DemographicsEntry[] */
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

/**
 * Returns aggregated demographics from analytics/demographics.
 * On first call, migrates existing userStats documents into the aggregated document.
 */
export const getAdminDemographicsStats = async (): Promise<
  { success: boolean; stats?: AdminDemographicsStats; error?: string }
> => {
  try {
    const analyticsRef = db.collection(COLLECTIONS.ANALYTICS).doc("demographics");
    const snap = await analyticsRef.get();

    // --- First-time migration: compile from raw userStats ---
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

        const bKey = norm(d.browser);
        browsers[bKey] = (browsers[bKey] || 0) + 1;
        browserLabels[bKey] = d.browser || "Unknown";

        const oKey = norm(d.os);
        operatingSystems[oKey] = (operatingSystems[oKey] || 0) + 1;
        osLabels[oKey] = d.os || "Unknown";

        const dKey = norm(d.device);
        devices[dKey] = (devices[dKey] || 0) + 1;
        deviceLabels[dKey] = d.device || "Desktop";

        const cKey = norm(d.country);
        countries[cKey] = (countries[cKey] || 0) + 1;
        countryLabels[cKey] = d.country || "Unknown";

        const cityKey = norm(d.city);
        cities[cityKey] = (cities[cityKey] || 0) + 1;
        cityLabels[cityKey] = d.city || "Unknown";
      });

      const compiledData = {
        totalSessions,
        browsers,
        browserLabels,
        operatingSystems,
        osLabels,
        devices,
        deviceLabels,
        countries,
        countryLabels,
        cities,
        cityLabels,
        updatedAt: FieldValue.serverTimestamp(),
      };

      // Save so future reads are O(1)
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

    // --- Normal read path ---
    const data = snap.data()!;
    const updatedAtRaw = data.updatedAt?.toDate?.()?.toISOString() ?? null;

    return {
      success: true,
      stats: {
        totalSessions: data.totalSessions || 0,
        devices: toSortedEntries(data.devices || {}, data.deviceLabels || {}),
        browsers: toSortedEntries(data.browsers || {}, data.browserLabels || {}),
        operatingSystems: toSortedEntries(data.operatingSystems || {}, data.osLabels || {}),
        countries: toSortedEntries(data.countries || {}, data.countryLabels || {}),
        cities: toSortedEntries(data.cities || {}, data.cityLabels || {}),
        updatedAt: updatedAtRaw,
      },
    };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("Error fetching admin demographics:", error);
    return { success: false, error: error.message };
  }
};

