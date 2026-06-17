"use server";

import { db, auth } from "@/firebase/admin";
import { COLLECTIONS } from "@/constants";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAuthenticatedAdmin } from "./auth";

/** Generates a cryptographically safe temp password */
function generateTempPassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
  let password = "";
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

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

    if (showDeleted) {
      users = users.filter((u) => u.isDeleted === true);
    } else {
      users = users.filter((u) => !u.isDeleted);
    }

    if (statusFilter !== "all") {
      users = users.filter((u) => u.status === statusFilter);
    }

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
    if (!admin || (admin.role !== "ADMIN" && admin.role !== "SUPER_ADMIN")) return { success: false, error: "Unauthorized" };

    if (userId === admin.id && data.role && data.role !== admin.role) {
      return { success: false, error: "You cannot change your own role." };
    }

    const firestoreUpdate: Record<string, unknown> = {
      ...data,
      updatedAt: FieldValue.serverTimestamp(),
    };

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

export const updateAdminPassword = async (
  newPassword: string,
): Promise<{ success: boolean; error?: string }> => {
  try {
    const admin = await getAuthenticatedAdmin();
    if (!admin || (admin.role !== "ADMIN" && admin.role !== "SUPER_ADMIN")) return { success: false, error: "Unauthorized" };

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
