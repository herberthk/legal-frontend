// Cost constants
export const COST_PER_THOUSAND_TOKENS = 0.027; // $0.027 per 1000 tokens
export const COST_PER_VOICE_MINUTE = 0.08; // $0.08 per minute
export const FREE_WELCOME_TEXT_TOKENS = 4000; // 4000 free tokens for new users
export const FREE_WELCOME_VOICE_SECONDS = 120; // 120 free seconds for new users (2 minutes)
export const FREE_TEXT_TOKENS = 1000; // 1000 free tokens per 5 days
export const USD_TO_UGX_EXCHANGE_RATE = 3800; // 1 USD = 3800 UGX
export const COST_PER_VOICE_SECOND = COST_PER_VOICE_MINUTE / 60; // $0.001333 per second
export const USD_IN_CENTS = 100;
export const COST_PER_VOICE_SECOND_IN_CENTS =
  COST_PER_VOICE_SECOND * USD_IN_CENTS;
export const COST_PER_THOUSAND_TOKENS_IN_CENTS =
  COST_PER_THOUSAND_TOKENS * USD_IN_CENTS;
// Hard ceiling on a single voice call. The client stops a call at this point,
// and the billing endpoint refuses any duration above it — the session cookie
// proves who is calling, not how long they talked, so this is what bounds a
// forged or corrupted beacon payload.
export const MAX_VOICE_SESSION_SECONDS = 1800; // 30 minutes
//Mobile Money Transaction fee percentage
export const MOBILE_MONEY_FEE_PERCENTAGE = 0.03; // 3% of the amount for mobile money transactions

// App metadata
export const APP_NAME = "LegalAdviser";
export const APP_DEFAULT_TITLE = "Legal Adviser";
export const APP_TITLE_TEMPLATE = "%s - LegalAdviser";
export const APP_DESCRIPTION =
  "LegalAdviser is an AI-powered platform dedicated to democratizing access to justice in Uganda. Get instant legal guidance, analyze complex cases, and access 24/7 AI-driven consultations to empower your legal journey.";

// Default region
export const DEFAULT_REGION = "africa-south1";

// Firebase Cloud Functions URLs for push notifications (africa-south1)
export const PUSH_FUNCTIONS_BASE_URL =
  process.env.PUSH_FUNCTIONS_BASE_URL ||
  "https://africa-south1-legal-adviser-9cd92.cloudfunctions.net";

export const SINGLE_PUSH_NOTIFICATION_URL =
  process.env.SINGLE_PUSH_NOTIFICATION_URL ||
  `${PUSH_FUNCTIONS_BASE_URL}/singlePushNotification`;

export const MULTIPLE_PUSH_NOTIFICATION_URL =
  process.env.MULTIPLE_PUSH_NOTIFICATION_URL ||
  `${PUSH_FUNCTIONS_BASE_URL}/multiplePushNotification`;

// Document Review constants
export const MAX_REVIEW_FILE_SIZE_MB = 10;
export const MAX_REVIEW_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
export const MAX_REVIEW_PAGES = 15;
export const CHARS_PER_TOKEN = 4; // ~4 characters per token (standard LLM estimate)

export const CALLBACK_URL = `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/callback`

// Transitions
export const TRANSITION = {
  NAV_FORWARD: 'nav-forward',
  NAV_BACK: 'nav-back',
} as const
