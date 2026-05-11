// Cost constants
export const COST_PER_THOUSAND_TOKENS = 0.027; // $0.027 per 1000 tokens
export const COST_PER_VOICE_MINUTE = 0.08; // $0.08 per minute
export const FREE_WELCOME_TEXT_TOKENS = 4000; // 4000 free tokens for new users
export const FREE_WELCOME_VOICE_SECONDS = 120; // 120 free seconds for new users (2 minutes)
export const FREE_DAILY_TEXT_TOKENS = 1000; // 1000 free tokens per day
export const USD_TO_UGX_EXCHANGE_RATE = 3750; // 1 USD = 3750 UGX
export const COST_PER_VOICE_SECOND = COST_PER_VOICE_MINUTE / 60; // $0.001333 per second
export const USD_IN_CENTS = 100;
export const COST_PER_VOICE_SECOND_IN_CENTS =
  COST_PER_VOICE_SECOND * USD_IN_CENTS;
export const COST_PER_THOUSAND_TOKENS_IN_CENTS =
  COST_PER_THOUSAND_TOKENS * USD_IN_CENTS;

// App metadata
export const APP_NAME = "LegalAdviser";
export const APP_DEFAULT_TITLE = "Legal Adviser";
export const APP_TITLE_TEMPLATE = "%s - LegalAdviser";
export const APP_DESCRIPTION =
  "LegalAdviser is an AI-powered platform dedicated to democratizing access to justice in Uganda. Get instant legal guidance, analyze complex cases, and access 24/7 AI-driven consultations to empower your legal journey.";
