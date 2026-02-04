declare global {
  interface User {
    name: string;
    email: string;
    id: string;
  }

  interface SignInParams {
    email: string;
    idToken: string;
  }

  interface SignUpParams {
    uid: string;
    name: string;
    email: string;
    password: string;
  }

  export enum View {
    LANDING = "LANDING",
    AUTH = "AUTH",
    DASHBOARD = "DASHBOARD",
    CHAT = "CHAT",
    VOICE = "VOICE",
    BILLING = "BILLING",
    SUPPORT = "SUPPORT", // User view
    USERS = "USERS", // Admin only
    CONFIGURATION = "CONFIGURATION", // Admin only
    ADMIN_COMPLAINTS = "ADMIN_COMPLAINTS", // Admin only
    NOTIFICATIONS = "NOTIFICATIONS",
    // Legal Pages
    TERMS = "TERMS",
    PRIVACY = "PRIVACY",
    DISCLAIMER = "DISCLAIMER",
    COOKIE_POLICY = "COOKIE_POLICY",
  }

  type Role = "ADMIN" | "USER";

  interface User {
    id: string;
    name: string;
    email: string;
    avatar: string;
    role: Role;
    balance: number; // In USD
    totalSpent: number;
    status: "active" | "suspended";
    voicePreference?: string;
    // Free Tier Tracking
    freeTextTokens: number; // Daily Recurring Limit (1000)
    welcomeTextTokens: number; // One-time Sign up bonus (4000)
    freeVoiceSeconds: number; // One-time welcome bonus (300s = 5mins)
    lastDailyReset: string; // ISO Date string
  }

  interface PaymentMethod {
    id: string;
    type: "visa" | "mastercard" | "mobile_money";
    last4: string; // or phone number for mobile money
    expiry?: string;
    isDefault: boolean;
    holderName: string;
  }

  interface Message {
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
  }

  interface ChartData {
    name: string;
    value: number;
    revenue?: number;
    cost?: number;
  }

  interface Transaction {
    id: string;
    type: "TEXT_CHAT" | "VOICE_SESSION" | "DEPOSIT";
    description: string;
    amount: number; // Cost (negative) or Deposit (positive)
    date: string;
    details: string; // e.g., "1.5k tokens" or "4m 20s"
  }

  type ConnectionState = "disconnected" | "connecting" | "connected" | "error";

  // --- Complaint System Types ---
  type ComplaintStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "REJECTED";
  type ComplaintCategory =
    | "REFUND"
    | "OVERCHARGE"
    | "DOUBLE_CHARGE"
    | "TECHNICAL"
    | "OTHER";

  interface Complaint {
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
  }

  interface Notification {
    id: number;
    text: string;
    time: string;
    unread: boolean;
    type?: "info" | "alert" | "success";
  }

  interface TokenUsageRecord {
    id: string;
    timestamp: number; // Unix timestamp
    amount: number; // Quantity (Tokens or Seconds)
    unit: "TOKENS" | "SECONDS";
    type: "TEXT_PROMPT" | "TEXT_RESPONSE" | "VOICE_SESSION";
  }

  interface VoiceSession {
    id: string;
    userId: string;
    date: string; // ISO string
    duration: number; // seconds
    audioUrl?: string; // Blob URL
    previewText: string; // Summary or first user message
  }

  type Theme = "light" | "dark";

  interface ThemeState {
    theme: Theme;
    toggleTheme: () => void;
    setTheme: (theme: Theme) => void;
  }
}
export {};
