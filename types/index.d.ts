import "./email.d.ts";
import "./voices.d.ts";
import "./global.d.ts";
import "./pay.d.ts";
declare global {
  type SignInParams = {
    email: string;
    idToken: string;
  };

  type SignUpParams = {
    name: string;
    email: string;
    password?: string; // Optinal as it might be handled client-side
  };

  // type Notifications = {
  //   id: number;
  //   text: string;
  //   time: string;
  //   unread: boolean;
  //   type?: "info" | "alert" | "success";
  // };

  type Role = "ADMIN" | "USER";

  type PreferedVoice = {
    preferedVoiceId: Voice;
    preferedVoiceName: string;
  };

  type User = {
    id: string; // Firebase UID
    name: string;
    email: string;
    avatar: string;
    role: Role;
    balance: number; // In UGX will be converted to USD at rate of 3800
    totalSpent: number; // In UGX will be converted to USD at rate of 3800
    status: "active" | "suspended";
    preferedVoice?: PreferedVoice;
    // Tier Tracking
    welcomeTextTokens: number; // One-time welcome bonus (4000)
    freeTextTokens: number; // Daily Recurring Limit (1000)
    freeVoiceSeconds: number; // One-time welcome bonus (300s = 5mins)
    nextDailyReset: string; // ISO Date string — next reset time
    createdAt: string; // ISO Date string
    updatedAt?: string;
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
    createdAt: string;
    isStreaming?: boolean;
    attachment?: {
      name: string;
      contentType: string;
      url: string;
    };
  };

  type ChartData = {
    name: string;
    value: number;
    revenue?: number;
    cost?: number;
  };

  type TransactionMethod = "STRIPE" | "AIRTEL" | "MTN";
  type Transaction = {
    id: string;
    userId: string;
    type: "TEXT_CHAT" | "VOICE_SESSION" | "DEPOSIT";
    description: string;
    amount: number;
    createdAt: string;
    details: string; // e.g., "1.5k tokens" or "4m 20s"
    status: "PENDING" | "COMPLETED" | "FAILED";
    method: TransactionMethod
    reference: string;
    providerTransactionId?:string;
    country?: string;
    fee?:number
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

  type HelpArticle = {
    id: string;
    title: string;
    category: string;
    content: string; // Markdown supported
    order: number;
    createdAt: string;
  };

  type NotificationType = "INFO" | "SUCCESS" | "WARNING" | "ERROR";

  type FCMTokenRecord = {
    id: string; // The token itself is typically used as the ID
    userId: string;
    token: string;
    createdAt: string; // ISO string
    updatedAt: string; // ISO string
  };

  type AppNotification = {
    id: string;
    userId: string;
    title: string;
    message: string;
    type: NotificationType;
    url?: string;
    isRead: boolean;
    createdAt: string; // ISO Date string
  };

  type TranscriptionRecord = {
    id: string;
    userId: string;
    title: string;
    fileName: string;
    fileUrl?: string; // Original document URL
    transcribedText: string;
    formatMode: "professional" | "original";
    tokensUsed?: number; // Added token consumption
    createdAt: string; // ISO string
    updatedAt: string; // ISO string
  };

  type Transcript = {
    role: "user" | "AI";
    content: string;
  };

  type VoiceSession = {
    id: string;
    userId: string;
    title: string;
    createdAt: string; // ISO string
    duration: number; // seconds
    audioUrl?: string; // Recording
    summary: string;
    transcripts: Transcript[];
    cost: number;
    sessionId: string;
  };

  type VoiceSessionUsage = Omit<VoiceSession, "id">;

  type Theme = "light" | "dark";

  type ThemeState = {
    theme: Theme;
    toggleTheme: () => void;
    setTheme: (theme: Theme) => void;
  };

  type ConnectionStatus = "connected" | "reconnecting" | "offline";

  // --- Chat Persistence Types ---
  type ChatSession = {
    id: string;
    userId: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    messageCount: number;
  };

  type ChatMessageRecord = {
    id: string;
    sessionId: string;
    role: "user" | "assistant";
    text: string;
    createdAt: string;
    tokenCount: number;
    attachment?: { name: string; contentType: string; url: string };
  };

  type UsageSource = "free" | "paid" | "welcome";
  type UsageType = "TEXT_RESPONSE" | "VOICE_SESSION" | "DOCUMENT_TRANSCRIPTION";
  // --- Usage Tracking Types ---
  type UsageRecord = {
    id: string;
    userId: string;
    type: UsageType;
    tokens: number;
    cost: number;
    seconds: number;
    source: UsageSource;
    sessionId: string;
    createdAt: string;
  };

  type UsageFilter = "today" | "yesterday" | "last_week" | "month" | "custom";

  type UserStats = {
    id?: string;
    userId: string;
    browser: string;
    os: string;
    device: string; // Generic type (Mobile, Tablet, Desktop)
    deviceName: string; // Specific name (e.g. iPhone, Samsung, HP)
    resolution: string;
    ip: string;
    country: string;
    city: string;
    timezone: string;
    createdAt: string;
    userAgent: string;
  };

  type SessionStore = {
    user: User;
    session: string;
  };

  interface ChatInterfaceProps {
    chatId?: string | null;
    onChatCreated?: (chatId: string) => void;
    serverChatId?: string | null;
    serverMessages?: ChatMessageRecord[];
    serverHasMore?: boolean;
  }

  // Generic utility — omit any fields and replace with FieldValue
  type FirestoreWrite<T, K extends keyof T = never> = Omit<T, K> & {
    [P in K]: FieldValue;
  };

  type PostCallStage =
    | "encoding"
    | "billing"
    | "uploading"
    | "saving"
    | "done"
    | "error";

  // --- Document Review Types ---
  type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

  type ReviewClause = {
    title: string;
    content: string;
    assessment: string;
    riskLevel: RiskLevel;
  };

  type ReviewRisk = {
    title: string;
    description: string;
    severity: RiskLevel;
    clause?: string;
    recommendation: string;
  };

  type ReviewRecommendation = {
    title: string;
    description: string;
    priority: RiskLevel;
  };

  type ReviewScoreCategory = {
    category: string;
    score: number; // 0-100
  };

  type DocumentReview = {
    id: string;
    userId: string;
    fileName: string;
    fileUrl: string;
    documentType: string;
    summary: string;
    overallScore: number; // 0-100
    highlights: string[];
    keyClauses: ReviewClause[];
    risks: ReviewRisk[];
    recommendations: ReviewRecommendation[];
    scoreBreakdown: ReviewScoreCategory[];
    tokensUsed: number;
    pageCount: number;
    createdAt: string;
    updatedAt: string;
  };

  type ReviewStage =
    | "idle"
    | "uploading"
    | "extracting"
    | "analyzing"
    | "scoring"
    | "generating"
    | "complete"
    | "error";
}
export {};
