// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="voices.d.ts" />
import "./email.d.ts";
declare global {
  // type User = {
  //   name: string;
  //   email: string;
  //   id: string;
  // };

  type SignInParams = {
    email: string;
    idToken: string;
  };

  type SignUpParams = {
    name: string;
    email: string;
    password?: string; // Optinal as it might be handled client-side
  };

  type Notifications = {
    id: number;
    text: string;
    time: string;
    unread: boolean;
    type?: "info" | "alert" | "success";
  };

  type Role = "ADMIN" | "USER";

  type User = {
    id: string; // Firebase UID
    name: string;
    email: string;
    avatar: string;
    role: Role;
    balance: number; // In USD
    totalSpent: number;
    status: "active" | "suspended";
    voicePreference?: string;
    // Tier Tracking
    freeTextTokens: number; // Daily Recurring Limit (1000)
    welcomeTextTokens: number; // One-time Sign up bonus (4000)
    freeVoiceSeconds: number; // One-time welcome bonus (300s = 5mins)
    lastDailyReset: string; // ISO Date string
    createdAt: string; // ISO Date string
  };

  type PaymentMethod = {
    id: string;
    type: "visa" | "mastercard" | "mobile_money";
    last4: string; // or phone number for mobile money
    expiry?: string;
    isDefault: boolean;
    holderName: string;
  };

  type Message = {
    id: string;
    role: "user" | "model";
    text: string;
    timestamp: Date;
    isStreaming?: boolean;
    attachment?: {
      name: string;
      type: string;
      data: string;
    };
  };

  type ChartData = {
    name: string;
    value: number;
    revenue?: number;
    cost?: number;
  };

  type Transaction = {
    id: string;
    type: "TEXT_CHAT" | "VOICE_SESSION" | "DEPOSIT";
    description: string;
    amount: number; // Cost (negative) or Deposit (positive)
    date: string;
    details: string; // e.g., "1.5k tokens" or "4m 20s"
  };

  type ConnectionState = "disconnected" | "connecting" | "connected" | "error";

  // --- Complaint System Types ---
  type ComplaintStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "REJECTED";
  type ComplaintCategory =
    | "REFUND"
    | "OVERCHARGE"
    | "DOUBLE_CHARGE"
    | "TECHNICAL"
    | "OTHER";

  type Complaint = {
    id: string;
    userId: string;
    userName: string;
    email: string;
    transactionId?: string;
    category: ComplaintCategory;
    subject: string;
    description: string;
    status: ComplaintStatus;
    priority: "LOW" | "MEDIUM" | "HIGH";
    createdAt: string;
    updatedAt: string;
    resolutionNote?: string;
  };

  type Notification = {
    id: number;
    text: string;
    time: string;
    unread: boolean;
    type?: "info" | "alert" | "success";
  };

  type TokenUsageRecord = {
    id: string;
    timestamp: number; // Unix timestamp
    amount: number; // Quantity (Tokens or Seconds)
    unit: "TOKENS" | "SECONDS";
    type: "TEXT_PROMPT" | "TEXT_RESPONSE" | "VOICE_SESSION";
  };

  type VoiceSession = {
    id: string;
    userId: string;
    // unit: "SECONDS" | "MINUTES";
    // amount: number;
    date: string; // ISO string
    duration: number; // seconds
    audioUrl?: string; // Blob URL
    previewText: string; // Summary or first user message
  };

  type Theme = "light" | "dark";

  type ThemeState = {
    theme: Theme;
    toggleTheme: () => void;
    setTheme: (theme: Theme) => void;
  };
  type ConnectionStatus = "connected" | "reconnecting" | "offline";
}
export {};
