import { USD_TO_UGX_EXCHANGE_RATE } from "@/constants";
import crypto from "crypto";

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

export const formatDate = (dateString: string) => {
  const date = new Date(dateString);
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

export const formatCost = (cost: number) => {
  const ugxCost = Math.round(cost * USD_TO_UGX_EXCHANGE_RATE);
  return `$${cost.toFixed(2)} (UGX ${ugxCost.toLocaleString()})`;
};
