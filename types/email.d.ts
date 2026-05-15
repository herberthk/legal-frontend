import { Timestamp } from "firebase-admin/firestore";

declare global {
  interface Otp {
    id?: string;
    email: string;
    otpHash: string;
    expiresAt: Timestamp;
    attempts: number;
  }

  type FreeCreditHistory = {
    id: string;
    userId: string;
    amount: number;
    type: "RENEWAL" | "WELCOME";
    createdAt: string;
  };
}
export {};
