"use server";

import { db } from "@/firebase/admin";
import { COLLECTIONS, USD_TO_UGX_EXCHANGE_RATE } from "@/constants";
import { AggregateField } from "firebase-admin/firestore";

export type AdminOverviewStats = {
  totalUsers: number;
  totalTokens: number;
  totalVoiceSeconds: number;
  totalVoiceSessions: number;
  totalCostUsd: number; // In dollars
  totalCostUgx: number; // In UGX
  chatTokens: number;
  transcriptionTokens: number;
  timeSeriesData: { date: string; tokens: number; cost: number; voiceSeconds: number }[];
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

    // 3. Aggregate specific types to get breakdowns and voice sessions count
    // Voice Sessions
    const voiceSessionsCountSnapshot = await usageRef.where("type", "==", "VOICE_SESSION").count().get();
    const totalVoiceSessions = voiceSessionsCountSnapshot.data().count;

    // Chat Tokens
    const chatTokensAggregate = await usageRef.where("type", "==", "TEXT_RESPONSE").aggregate({
      tokens: AggregateField.sum('tokens'),
    }).get();
    const chatTokens = chatTokensAggregate.data().tokens;

    // Transcription Tokens
    const transcriptionAggregate = await usageRef.where("type", "==", "DOCUMENT_TRANSCRIPTION").aggregate({
      tokens: AggregateField.sum('tokens'),
    }).get();
    const transcriptionTokens = transcriptionAggregate.data().tokens;

    // 4. Time series data for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // We fetch the actual documents for the last 30 days to build the chart,
    // or if there are too many, we could use aggregation grouped by day, but Firestore 
    // doesn't support GROUP BY natively in the SDK yet. We will fetch them.
    // If the collection is too huge, this could be slow, so we limit or optimise.
    // For now, we will fetch last 30 days and reduce in-memory.
    const recentUsageSnapshot = await usageRef
      .where("createdAt", ">=", thirtyDaysAgo)
      .orderBy("createdAt", "asc")
      .get();

    const dayMap: Record<string, { date: string; tokens: number; cost: number; voiceSeconds: number }> = {};
    
    // Initialize last 30 days with 0
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      const key = d.toISOString().split("T")[0];
      dayMap[key] = { date: key, tokens: 0, cost: 0, voiceSeconds: 0 };
    }

    recentUsageSnapshot.forEach((doc) => {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate();
      if (!createdAt) return;

      const key = createdAt.toISOString().split("T")[0];
      if (dayMap[key]) {
        dayMap[key].tokens += data.tokens || 0;
        dayMap[key].cost += (data.cost || 0) / 100; // convert cents to dollars
        dayMap[key].voiceSeconds += data.seconds || 0;
      }
    });

    const timeSeriesData = Object.values(dayMap);

    const totalCostUsd = (totalCostInCents || 0) / 100;
    const totalCostUgx = totalCostUsd * USD_TO_UGX_EXCHANGE_RATE;

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
        timeSeriesData,
      },
    };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("Error fetching admin stats:", error);
    return { success: false, error: error.message };
  }
};
