import { COLLECTIONS, COST_PER_THOUSAND_TOKENS } from "@/constants";
import { db } from "@/firebase/client";
import { clsx, type ClassValue } from "clsx";
import { doc, getDoc } from "firebase/firestore";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

export const formatNumber = (num: number) => {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
};

export const formatPercentage = (value: number, total: number) => {
  if (total === 0) return "0%";
  const percentage = ((value / total) * 100).toFixed(0);
  return `${percentage}%`;
};

// Supports HH:MM:SS for long durations
export const formatTime = (seconds: number) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  return `${hrs.toString().padStart(2, "0")}:${mins
    .toString()
    .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

/**
 * Checks whether a user is allowed to send a message.
 * Validates free messages remaining, free tokens, welcome tokens, and paid balance.
 * @param userId - The authenticated user's ID
 * @returns Whether the user can send, and a reason if blocked
 */
export const checkCanSend = async (
  userId: string,
): Promise<{
  canSend: boolean;
  reason?: string;
  user?: User;
}> => {
  try {
    const userRef = doc(db, COLLECTIONS.USERS, userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      return { canSend: false, reason: "User not found" };
    }

    const user = { id: userDoc.id, ...userDoc.data() } as User;

    // Check if user has any available resources
    const hasFreeTokens = (user.freeTextTokens ?? 0) > 10;
    const hasPaidBalance = (user.balance ?? 0) > COST_PER_THOUSAND_TOKENS;
    const hasWelcomeTokens = (user.welcomeTextTokens ?? 0) > 10;

    if (hasFreeTokens || hasPaidBalance || hasWelcomeTokens) {
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
};
