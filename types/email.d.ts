import { Timestamp } from "firebase-admin/firestore";

declare global {
  interface Otp {
    id?: string;
    email: string;
    otpHash: string;
    expiresAt: Timestamp;
    attempts: number;
  }
}
export {};
