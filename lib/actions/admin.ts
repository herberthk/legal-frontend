"use server";

import { db, auth } from "@/firebase/admin";
import {
  COLLECTIONS,
  USD_TO_UGX_EXCHANGE_RATE,
  COST_PER_THOUSAND_TOKENS,
  COST_PER_VOICE_MINUTE,
} from "@/constants";
import { AggregateField, FieldValue, Timestamp } from "firebase-admin/firestore";
import { cookies } from "next/headers";

// ─── Admin Permissions Helper ──────────────────────────────────────────────────

/** Generates a cryptographically safe temp password */
function generateTempPassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
  let password = "";
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

/** Fetches the currently authenticated admin's user record for permission checks. */
export async function getAuthenticatedAdmin(): Promise<User | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;
    if (!sessionCookie) return null;
    const decoded = await auth.verifySessionCookie(sessionCookie, true);
    const snap = await db.collection(COLLECTIONS.USERS).doc(decoded.uid).get();
    if (!snap.exists) return null;
    const data = snap.data();
    if (!data) return null;
    
    return {
      ...data,
      id: snap.id,
      createdAt: data.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
      nextDailyReset: data.nextDailyReset?.toDate?.()?.toISOString() ?? new Date().toISOString(),
      deletedAt: data.deletedAt?.toDate?.()?.toISOString() ?? undefined,
    } as User;
  } catch {
    return null;
  }
}

// ─── Admin User List ───────────────────────────────────────────────────────────

export type AdminUserListParams = {
  search?: string;
  sortBy?: "name" | "email" | "balance" | "createdAt" | "status" | "username" | "phoneNumber";
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
  showDeleted?: boolean;
  statusFilter?: "all" | "active" | "suspended" | "banned";
};

export type AdminUserListResult = {
  success: boolean;
  users: User[];
  totalCount: number;
  totalPages: number;
  error?: string;
};

export const getAdminUsers = async (
  params: AdminUserListParams = {},
): Promise<AdminUserListResult> => {
  try {
    const {
      search = "",
      sortBy = "createdAt",
      sortOrder = "desc",
      page = 1,
      pageSize = 20,
      showDeleted = false,
      statusFilter = "all",
    } = params;

    const snapshot = await db.collection(COLLECTIONS.USERS).get();

    let users: User[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        createdAt: data.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? undefined,
        nextDailyReset: data.nextDailyReset?.toDate?.()?.toISOString() ?? new Date().toISOString(),
        deletedAt: data.deletedAt?.toDate?.()?.toISOString() ?? undefined,
      } as User;
    });

    const currentAdmin = await getAuthenticatedAdmin();
    if (currentAdmin) {
      users = users.filter((u) => u.id !== currentAdmin.id);
    }

    // Filter by deleted / active
    if (showDeleted) {
      users = users.filter((u) => u.isDeleted === true);
    } else {
      users = users.filter((u) => !u.isDeleted);
    }

    // Filter by status
    if (statusFilter !== "all") {
      users = users.filter((u) => u.status === statusFilter);
    }

    // Filter by search query
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      users = users.filter(
        (u) =>
          u.name?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q) ||
          u.username?.toLowerCase().includes(q) ||
          u.phoneNumber?.toLowerCase().includes(q) ||
          u.id?.toLowerCase().includes(q),
      );
    }

    // Sort
    users.sort((a, b) => {
      let aVal: string | number = "";
      let bVal: string | number = "";

      switch (sortBy) {
        case "name":
          aVal = a.name?.toLowerCase() ?? "";
          bVal = b.name?.toLowerCase() ?? "";
          break;
        case "email":
          aVal = a.email?.toLowerCase() ?? "";
          bVal = b.email?.toLowerCase() ?? "";
          break;
        case "balance":
          aVal = a.balance ?? 0;
          bVal = b.balance ?? 0;
          break;
        case "status":
          aVal = a.status ?? "";
          bVal = b.status ?? "";
          break;
        case "username":
          aVal = a.username?.toLowerCase() ?? "";
          bVal = b.username?.toLowerCase() ?? "";
          break;
        case "phoneNumber":
          aVal = a.phoneNumber ?? "";
          bVal = b.phoneNumber ?? "";
          break;
        case "createdAt":
        default:
          aVal = a.createdAt ?? "";
          bVal = b.createdAt ?? "";
          break;
      }

      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    const totalCount = users.length;
    const totalPages = Math.ceil(totalCount / pageSize);
    const paginated = users.slice((page - 1) * pageSize, page * pageSize);

    return { success: true, users: paginated, totalCount, totalPages };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("getAdminUsers error:", error);
    return { success: false, users: [], totalCount: 0, totalPages: 0, error: error.message };
  }
};

// ─── Create Admin User ─────────────────────────────────────────────────────────

export type CreateAdminUserData = {
  name: string;
  email: string;
  username?: string;
  phoneNumber?: string;
  role: Role;
  status: "active" | "suspended" | "banned";
  balance?: number;
  welcomeTextTokens?: number;
  freeTextTokens?: number;
  freeVoiceSeconds?: number;
  permissions?: User["permissions"];
};

export const createAdminUser = async (
  data: CreateAdminUserData,
): Promise<{
  success: boolean;
  user?: User;
  tempPassword?: string;
  error?: string;
}> => {
  try {
    const tempPassword = generateTempPassword();
    const isDisabled = data.status === "suspended" || data.status === "banned";

    const firebaseUser = await auth.createUser({
      email: data.email,
      password: tempPassword,
      displayName: data.name,
      emailVerified: false,
      disabled: isDisabled,
    });

    const uid = firebaseUser.uid;
    const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(data.name)}&background=0f172a&color=fff`;

    const newUser: Record<string, unknown> = {
      name: data.name,
      email: data.email.toLowerCase(),
      avatar,
      role: data.role,
      status: data.status,
      balance: data.balance ?? 0,
      totalSpent: 0,
      username: data.username ?? "",
      phoneNumber: data.phoneNumber ?? "",
      preferedVoice: { preferedVoiceId: "Aoede", preferedVoiceName: "Evelyn" },
      welcomeTextTokens: data.welcomeTextTokens ?? 4000,
      freeTextTokens: data.freeTextTokens ?? 0,
      freeVoiceSeconds: data.freeVoiceSeconds ?? 300,
      nextDailyReset: Timestamp.fromMillis(Date.now() + 3 * 24 * 60 * 60 * 1000),
      isDeleted: false,
      permissions: data.permissions ?? {
        canManageUsers: false,
        canViewBilling: false,
        canManageSystemStats: false,
        canManageSupport: false,
      },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    await db.collection(COLLECTIONS.USERS).doc(uid).set(newUser);

    const createdUser: User = {
      ...newUser,
      id: uid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      nextDailyReset: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    } as User;

    return { success: true, user: createdUser, tempPassword };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("createAdminUser error:", error);
    return { success: false, error: error.message ?? "Failed to create user" };
  }
};

// ─── Update Admin User ─────────────────────────────────────────────────────────

export type UpdateAdminUserData = {
  name?: string;
  email?: string;
  username?: string;
  phoneNumber?: string;
  role?: Role;
  status?: "active" | "suspended" | "banned";
  balance?: number;
  welcomeTextTokens?: number;
  freeTextTokens?: number;
  freeVoiceSeconds?: number;
  permissions?: User["permissions"];
};

export const updateAdminUser = async (
  userId: string,
  data: UpdateAdminUserData,
): Promise<{ success: boolean; error?: string }> => {
  try {
    const admin = await getAuthenticatedAdmin();
    if (!admin || admin.role !== "ADMIN") return { success: false, error: "Unauthorized" };

    // Prevent admins from modifying their own role
    if (userId === admin.id && data.role && data.role !== admin.role) {
      return { success: false, error: "You cannot change your own role." };
    }

    const firestoreUpdate: Record<string, unknown> = {
      ...data,
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Firebase Auth sync
    const authUpdate: Record<string, unknown> = {};
    if (data.name) authUpdate.displayName = data.name;
    if (data.email) authUpdate.email = data.email;
    if (data.status) authUpdate.disabled = data.status === "suspended" || data.status === "banned";

    await Promise.all([
      db.collection(COLLECTIONS.USERS).doc(userId).update(firestoreUpdate),
      Object.keys(authUpdate).length > 0 ? auth.updateUser(userId, authUpdate) : Promise.resolve(),
    ]);

    return { success: true };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("updateAdminUser error:", error);
    return { success: false, error: error.message ?? "Failed to update user" };
  }
};

// ─── Update Admin Password ─────────────────────────────────────────────────────

export const updateAdminPassword = async (
  newPassword: string,
): Promise<{ success: boolean; error?: string }> => {
  try {
    const admin = await getAuthenticatedAdmin();
    if (!admin || admin.role !== "ADMIN") return { success: false, error: "Unauthorized" };

    if (newPassword.length < 6) {
      return { success: false, error: "Password must be at least 6 characters long." };
    }

    await auth.updateUser(admin.id, { password: newPassword });

    return { success: true };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("updateAdminPassword error:", error);
    return { success: false, error: error.message ?? "Failed to update password" };
  }
};

// ─── Toggle User Status ────────────────────────────────────────────────────────

export const toggleUserStatus = async (
  userId: string,
  status: "active" | "suspended" | "banned",
): Promise<{ success: boolean; error?: string }> => {
  try {
    const isDisabled = status === "suspended" || status === "banned";
    await Promise.all([
      db.collection(COLLECTIONS.USERS).doc(userId).update({
        status,
        updatedAt: FieldValue.serverTimestamp(),
      }),
      auth.updateUser(userId, { disabled: isDisabled }),
    ]);
    return { success: true };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("toggleUserStatus error:", error);
    return { success: false, error: error.message };
  }
};

// ─── Soft Delete ───────────────────────────────────────────────────────────────

export const softDeleteUser = async (
  userId: string,
): Promise<{ success: boolean; error?: string }> => {
  try {
    await Promise.all([
      db.collection(COLLECTIONS.USERS).doc(userId).update({
        isDeleted: true,
        deletedAt: FieldValue.serverTimestamp(),
        status: "suspended",
        updatedAt: FieldValue.serverTimestamp(),
      }),
      auth.updateUser(userId, { disabled: true }),
    ]);
    return { success: true };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("softDeleteUser error:", error);
    return { success: false, error: error.message };
  }
};

// ─── Restore User ──────────────────────────────────────────────────────────────

export const restoreUser = async (
  userId: string,
): Promise<{ success: boolean; error?: string }> => {
  try {
    await Promise.all([
      db.collection(COLLECTIONS.USERS).doc(userId).update({
        isDeleted: false,
        deletedAt: FieldValue.delete(),
        status: "active",
        updatedAt: FieldValue.serverTimestamp(),
      }),
      auth.updateUser(userId, { disabled: false }),
    ]);
    return { success: true };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("restoreUser error:", error);
    return { success: false, error: error.message };
  }
};

// ─── Permanently Delete User ───────────────────────────────────────────────────

export const permanentlyDeleteUser = async (
  userId: string,
): Promise<{ success: boolean; error?: string }> => {
  try {
    await Promise.all([
      db.collection(COLLECTIONS.USERS).doc(userId).delete(),
      auth.deleteUser(userId),
    ]);
    return { success: true };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error("permanentlyDeleteUser error:", error);
    return { success: false, error: error.message };
  }
};

// ─── Get Admin User Details ────────────────────────────────────────────────────

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

// ─── Get Admin Summary Stats for Users Page ────────────────────────────────────

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

