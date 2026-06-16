"use server";

import { db } from "@/firebase/admin";
import { COLLECTIONS } from "@/constants";
import { AggregateField, Timestamp } from "firebase-admin/firestore";

export type AdminUserDetails = {
  user: User;
  stats: {
    totalChatSessions: number;
    totalVoiceMinutes: number;
    totalTranscriptions: number;
    totalDocumentReviews: number;
    totalTokensUsed: number;
    totalAmountSpentCents: number;
  };
  recentTransactions: Transaction[];
  supportTickets: Complaint[];
  usageTimeSeries: {
    date: string;
    chatTokens: number;
    voiceSeconds: number;
    transcriptionTokens: number;
    cost: number;
  }[];
};

export const getAdminUserDetails = async (
  userId: string,
): Promise<{ success: boolean; data?: AdminUserDetails; error?: string }> => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      userSnap,
      usageAggregate,
      chatCountSnap,
      voiceAggSnap,
      transcriptionCountSnap,
      reviewCountSnap,
      recentUsageSnap,
      transactionsSnap,
      ticketsSnap,
    ] = await Promise.all([
      db.collection(COLLECTIONS.USERS).doc(userId).get(),
      db.collection(COLLECTIONS.USAGE).where("userId", "==", userId).aggregate({
        totalTokens: AggregateField.sum("tokens"),
        totalCost: AggregateField.sum("cost"),
      }).get(),
      db.collection(COLLECTIONS.CHAT_SESSIONS).where("userId", "==", userId).count().get(),
      db.collection(COLLECTIONS.USAGE).where("userId", "==", userId).where("type", "==", "VOICE_SESSION").aggregate({
        totalSeconds: AggregateField.sum("seconds"),
      }).get(),
      db.collection(COLLECTIONS.TRANSCRIPTIONS).where("userId", "==", userId).count().get(),
      db.collection(COLLECTIONS.DOCUMENT_REVIEWS).where("userId", "==", userId).count().get(),
      db.collection(COLLECTIONS.USAGE).where("userId", "==", userId).where("createdAt", ">=", Timestamp.fromDate(thirtyDaysAgo)).orderBy("createdAt", "asc").get(),
      db.collection(COLLECTIONS.TRANSACTIONS).where("userId", "==", userId).orderBy("createdAt", "desc").limit(20).get(),
      db.collection(COLLECTIONS.SUPPORT_TICKETS).where("userId", "==", userId).orderBy("createdAt", "desc").limit(15).get(),
    ]);

    if (!userSnap.exists) return { success: false, error: "User not found" };

    const userData = userSnap.data()!;
    const user: User = {
      ...userData,
      id: userSnap.id,
      createdAt: userData.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
      updatedAt: userData.updatedAt?.toDate?.()?.toISOString() ?? undefined,
      nextDailyReset: userData.nextDailyReset?.toDate?.()?.toISOString() ?? new Date().toISOString(),
      deletedAt: userData.deletedAt?.toDate?.()?.toISOString() ?? undefined,
    } as User;

    const stats = {
      totalChatSessions: chatCountSnap.data().count,
      totalVoiceMinutes: Math.round((voiceAggSnap.data().totalSeconds ?? 0) / 60),
      totalTranscriptions: transcriptionCountSnap.data().count,
      totalDocumentReviews: reviewCountSnap.data().count,
      totalTokensUsed: usageAggregate.data().totalTokens ?? 0,
      totalAmountSpentCents: usageAggregate.data().totalCost ?? 0,
    };

    // Build 30-day time-series
    const dayMap: Record<string, { date: string; chatTokens: number; voiceSeconds: number; transcriptionTokens: number; cost: number }> = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      const key = d.toISOString().split("T")[0];
      dayMap[key] = { date: key, chatTokens: 0, voiceSeconds: 0, transcriptionTokens: 0, cost: 0 };
    }
    recentUsageSnap.forEach((doc) => {
      const d = doc.data();
      const key = d.createdAt?.toDate?.()?.toISOString().split("T")[0];
      if (key && dayMap[key]) {
        if (d.type === "TEXT_RESPONSE") dayMap[key].chatTokens += d.tokens ?? 0;
        else if (d.type === "VOICE_SESSION") dayMap[key].voiceSeconds += d.seconds ?? 0;
        else if (d.type === "DOCUMENT_TRANSCRIPTION") dayMap[key].transcriptionTokens += d.tokens ?? 0;
        dayMap[key].cost += (d.cost ?? 0) / 100;
      }
    });

    const recentTransactions: Transaction[] = transactionsSnap.docs.map((doc) => ({
      ...doc.data(),
      id: doc.id,
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
    })) as Transaction[];

    const supportTickets: Complaint[] = ticketsSnap.docs.map((doc) => ({
      ...doc.data(),
      id: doc.id,
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
    })) as Complaint[];

    return {
      success: true,
      data: {
        user,
        stats,
        recentTransactions,
        supportTickets,
        usageTimeSeries: Object.values(dayMap),
      },
    };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("getAdminUserDetails error:", error);
    return { success: false, error: error.message };
  }
};
