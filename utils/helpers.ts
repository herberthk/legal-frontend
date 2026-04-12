import { USD_TO_UGX_EXCHANGE_RATE } from "@/constants";
import crypto from "crypto";
import {
  formatDistanceToNow,
  isToday,
  isYesterday,
  isSameWeek,
  isSameMonth,
  isSameYear,
  format,
} from "date-fns";

export const generateOTP = async (length = 6): Promise<string> =>
  Math.floor(Math.random() * 10 ** length)
    .toString()
    .padStart(length, "0");

export const hashOTP = async (otp: string): Promise<string> =>
  crypto.createHash("sha256").update(otp).digest("hex");

export const verifyOTP = async (
  inputOTP: string,
  storedHashedOTP: string,
): Promise<boolean> => {
  const hashedInput = crypto
    .createHash("sha256")
    .update(inputOTP)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(hashedInput),
    Buffer.from(storedHashedOTP),
  );
};

export const isOTPExpired = async (expiresAt: Date): Promise<boolean> =>
  new Date() > expiresAt;

export const generateToken = async (length = 64): Promise<string> =>
  crypto.randomBytes(length).toString("hex");

export const hashOTPWithSalt = async (
  otp: string,
  salt: string,
): Promise<string> =>
  crypto.createHmac("sha256", salt).update(otp).digest("hex");

export const verifyOTPWithSalt = async (
  inputOTP: string,
  storedHashedOTP: string,
  salt: string,
): Promise<boolean> => {
  const hashedInput = crypto
    .createHmac("sha256", salt)
    .update(inputOTP)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(hashedInput),
    Buffer.from(storedHashedOTP),
  );
};

//generate random transaction reference of 8 characters alphanumeric it should be prefixed with TX_
export const generateTransactionReference = (length = 8) =>
  crypto.randomBytes(length).toString("hex").toUpperCase();

export const generateTxRef = (length = 8) => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let bytes: Uint8Array;

  if (typeof window !== "undefined" && window.crypto) {
    bytes = window.crypto.getRandomValues(new Uint8Array(length));
  } else {
    // Standard Node.js crypto
    bytes = new Uint8Array(crypto.randomBytes(length));
  }

  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }

  return `TX_${result}`;
};

export const formatRelativeDate = (dateValue: string) => {
  if (!dateValue) {
    return new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const date = new Date(dateValue);
  if (isNaN(date.getTime())) {
    return new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return `Today, ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday, ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }

  return date.toLocaleDateString([], { month: "short", day: "numeric" });
};

/**
 * Returns a relative time string (e.g., "5 minutes ago") from various date formats.
 */
export const getRelativeTime = (dateValue: string) => {
  if (!dateValue) {
    return new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const date = new Date(dateValue);
  if (isNaN(date.getTime())) {
    return new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return formatDistanceToNow(date, { addSuffix: true });
};

export const formatCost = (costInCents: number) => {
  const costInDollars = costInCents / 100;
  const ugxCost = Math.round(costInDollars * USD_TO_UGX_EXCHANGE_RATE);
  return `$${costInDollars.toFixed(2)} (UGX ${ugxCost.toLocaleString()})`;
};

/**
 * Universal function that converts a date to the user's timezone
 * and formats it relatively.
 */
export const formatUniversalDate = (
  dateValue: string | number | Date | { toDate: () => Date } | null | undefined,
): string => {
  let date: Date;

  if (!dateValue) {
    date = new Date();
  } else if (dateValue instanceof Date) {
    date = dateValue;
  } else if (
    typeof dateValue === "object" &&
    "toDate" in dateValue &&
    typeof dateValue.toDate === "function"
  ) {
    // Handle Firebase Timestamp
    date = dateValue.toDate();
  } else {
    date = new Date(dateValue as string | number);
  }

  // Check if date is valid
  if (isNaN(date.getTime())) {
    date = new Date();
  }

  const now = new Date();

  // Today
  if (isToday(date)) {
    return `Today at ${format(date, "h:mm a")}`;
  }

  // Yesterday
  if (isYesterday(date)) {
    return `Yesterday at ${format(date, "hh:mm a")}`;
  }

  // Same week (weekStartsOn: 1 for Monday by default)
  if (isSameWeek(date, now, { weekStartsOn: 1 })) {
    return format(date, "EEEE, hh:mm a"); // e.g. "Monday, 06:43 PM"
  }

  // Same month
  if (isSameMonth(date, now)) {
    return format(date, "MMMM d, hh:mm a"); // e.g. "April 7, 06:43 PM"
  }

  // Same year but different month
  if (isSameYear(date, now)) {
    return format(date, "MMMM d, yyyy"); // e.g. "April 7, 2026"
  }

  // Previous years
  return format(date, "MMMM d, yyyy"); // e.g. "April 7, 2026"
};
