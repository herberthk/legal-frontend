// ─────────────────────────────────────────────────────────────────────────────
// PawaPay TypeScript SDK  v1.0.0
// Full coverage of the pawaPay Merchant API v2
// https://docs.pawapay.io/v2/api-reference
// ─────────────────────────────────────────────────────────────────────────────

// ── Main client ───────────────────────────────────────────────────────────────
export { PawaPayClient } from "./client";
export type { PawaPayConfig } from "./client";

// ── All types ─────────────────────────────────────────────────────────────────
export type {
  // Primitives
  PaymentId,
  Currency,
  Country,
  Amount,
  Timestamp,
  Environment,
  // Enums (re-exported as values + types)
  AccountDetails,
  PayerOrRecipient,
  MetadataItem,
  FailureReason,
  // Deposits
  DepositRequest,
  DepositInitiationResponse,
  DepositStatusResponse,
  DepositCallback,
  // Payouts
  PayoutRequest,
  PayoutInitiationResponse,
  PayoutStatusResponse,
  PayoutCallback,
  BulkPayoutRequest,
  BulkPayoutResponse,
  // Refunds
  RefundRequest,
  RefundInitiationResponse,
  RefundStatusResponse,
  RefundCallback,
  // Remittances
  RemittanceRequest,
  RemittanceInitiationResponse,
  // Payment Page
  PaymentPageDepositRequest,
  PaymentPageDepositResponse,
  // Config
  ActiveConfigRequest,
  ActiveConfigResponse,
  ActiveCountryConfig,
  ActiveProviderConfig,
  ActiveCurrencyConfig,
  OperationTypeConfig,
  PredictProviderRequest,
  PredictProviderResponse,
  WalletBalancesResponse,
  WalletBalance,
} from "./types/index.js";

export {
  TransactionStatus,
  FinalTransactionStatus,
  FailureCode,
  GatewayAvailabilityStatus,
  DecimalsInAmount,
  AuthType,
  PinPromptType,
  OperationType,
} from "./types";

// ── Errors ────────────────────────────────────────────────────────────────────
export {
  PawaPayError,
  PawaPayApiError,
  PawaPayNetworkError,
  PawaPayValidationError,
  PawaPayRetryExhaustedError,
} from "./errors";

// ── Utilities ─────────────────────────────────────────────────────────────────
export {
  generateUUID,
  isValidUUID,
  formatAmount,
  sanitisePhoneNumber,
  validateAmount,
  validatePhoneNumber,
  validatePaymentId,
  validateCustomerMessage,
  validateMetadata,
} from "./utils";

// ── Polling ───────────────────────────────────────────────────────────────────
export {
  pollUntilFinal,
  pollUntilFinalOrThrow,
} from "./utils/polling";
export type { PollOptions, PollResult, FinalStatus } from "./utils/polling";

// ── Fee Calculator ────────────────────────────────────────────────────────────
export { calculateFee, netAmount, FEE_SCHEDULES } from "./utils/fees";
export type { FeeResult, FeeCountry, FeeSchedule } from "./utils/fees";


// ── Webhook / Callback helpers ────────────────────────────────────────────────
export {
  parseDepositCallback,
  parsePayoutCallback,
  parseRefundCallback,
  verifyContentDigest,
  hasSignatureHeaders,
} from "./utils/webhooks";

// ── Finance types ─────────────────────────────────────────────────────────────
export type {
  StatementRequest,
  StatementInitiationResponse,
  StatementStatusResponse,
} from "./resources/finances";

// ── Toolkit types ─────────────────────────────────────────────────────────────
export type {
  ProviderAvailabilityResponse,
  PublicKeysResponse,
} from "./resources/toolkit";
