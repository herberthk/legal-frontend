// ─────────────────────────────────────────────────────────────────────────────
// PawaPay SDK – Types  (v2 API)
// ─────────────────────────────────────────────────────────────────────────────

// ── Shared primitives ─────────────────────────────────────────────────────────

/** UUIDv4 string, 36 chars */
export type PaymentId = string;

/** ISO 4217 currency code, e.g. "UGX", "ZMW" */
export type Currency = string;

/** ISO 3166-1 alpha-3 country code, e.g. "UGA", "ZMB" */
export type Country = string;

/** Amount as string per pawaPay rules (no leading zeroes, decimals optional) */
export type Amount = string;

/** RFC3339 datetime string */
export type Timestamp = string;

// ── Enums ─────────────────────────────────────────────────────────────────────

export enum TransactionStatus {
  ACCEPTED = "ACCEPTED",
  REJECTED = "REJECTED",
  DUPLICATE_IGNORED = "DUPLICATE_IGNORED",
}

export enum FinalTransactionStatus {
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  ENQUEUED = "ENQUEUED",
}

export enum FailureCode {
  NO_AUTHENTICATION = "NO_AUTHENTICATION",
  AUTHENTICATION_ERROR = "AUTHENTICATION_ERROR",
  AUTHORISATION_ERROR = "AUTHORISATION_ERROR",
  HTTP_SIGNATURE_ERROR = "HTTP_SIGNATURE_ERROR",
  INVALID_INPUT = "INVALID_INPUT",
  MISSING_PARAMETER = "MISSING_PARAMETER",
  UNSUPPORTED_PARAMETER = "UNSUPPORTED_PARAMETER",
  INVALID_PARAMETER = "INVALID_PARAMETER",
  DUPLICATE_METADATA_FIELD = "DUPLICATE_METADATA_FIELD",
  DEPOSITS_NOT_ALLOWED = "DEPOSITS_NOT_ALLOWED",
  PAYOUTS_NOT_ALLOWED = "PAYOUTS_NOT_ALLOWED",
  REFUNDS_NOT_ALLOWED = "REFUNDS_NOT_ALLOWED",
  REMITTANCES_NOT_ALLOWED = "REMITTANCES_NOT_ALLOWED",
  INVALID_PHONE_NUMBER = "INVALID_PHONE_NUMBER",
  INVALID_AMOUNT = "INVALID_AMOUNT",
  AMOUNT_OUT_OF_BOUNDS = "AMOUNT_OUT_OF_BOUNDS",
  INVALID_CURRENCY = "INVALID_CURRENCY",
  INVALID_PROVIDER = "INVALID_PROVIDER",
  PROVIDER_TEMPORARILY_UNAVAILABLE = "PROVIDER_TEMPORARILY_UNAVAILABLE",
  PAWAPAY_WALLET_OUT_OF_FUNDS = "PAWAPAY_WALLET_OUT_OF_FUNDS",
  NOT_FOUND = "NOT_FOUND",
  INVALID_STATE = "INVALID_STATE",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

export enum GatewayAvailabilityStatus {
  OPERATIONAL = "OPERATIONAL",
  DELAYED = "DELAYED",
  CLOSED = "CLOSED",
}

export enum DecimalsInAmount {
  TWO_PLACES = "TWO_PLACES",
  NONE = "NONE",
}

export enum AuthType {
  PROVIDER_AUTH = "PROVIDER_AUTH",
  PREAUTH = "PREAUTH",
  REDIRECT_AUTH = "REDIRECT_AUTH",
}

export enum PinPromptType {
  AUTOMATIC = "AUTOMATIC",
  MANUAL = "MANUAL",
}

export enum OperationType {
  DEPOSIT = "DEPOSIT",
  PAYOUT = "PAYOUT",
  REFUND = "REFUND",
  REMITTANCE = "REMITTANCE",
  PUSH_DEPOSIT = "PUSH_DEPOSIT",
  NAME_LOOKUP = "NAME_LOOKUP",
}

// ── Shared sub-shapes ─────────────────────────────────────────────────────────

export interface FailureReason {
  failureCode: FailureCode | string;
  failureMessage: string;
}

export interface AccountDetails {
  phoneNumber: string;
  provider: string;
}

export interface PayerOrRecipient {
  type: "MMO";
  accountDetails: AccountDetails;
}

export type MetadataItem = Record<string, string | boolean>;

// ── Deposit ───────────────────────────────────────────────────────────────────

export interface DepositRequest {
  /** UUIDv4 – generate and store before calling */
  depositId: PaymentId;
  payer: PayerOrRecipient;
  amount: Amount;
  currency: Currency;
  /** For PREAUTH providers */
  preAuthorisationCode?: string;
  clientReferenceId?: string;
  /** 4–22 alphanumeric chars */
  customerMessage?: string;
  metadata?: MetadataItem[];
}

export interface DepositInitiationResponse {
  depositId: PaymentId;
  status: TransactionStatus;
  created?: Timestamp;
  failureReason?: FailureReason;
}

export interface DepositStatusResponse extends DepositInitiationResponse {
  /** Present once in a final state */
  finalStatus?: FinalTransactionStatus | string;
  payer?: PayerOrRecipient;
  amount?: Amount;
  currency?: Currency;
  country?: Country;
  correspondent?: string;
  statementDescription?: string;
  customerTimestamp?: Timestamp;
  receivedByRecipient?: Timestamp;
  correspondentIds?: Record<string, string>;
  metadata?: MetadataItem[];
}

// ── Payout ────────────────────────────────────────────────────────────────────

export interface PayoutRequest {
  payoutId: PaymentId;
  recipient: PayerOrRecipient;
  amount: Amount;
  currency: Currency;
  clientReferenceId?: string;
  customerMessage?: string;
  metadata?: MetadataItem[];
}

export interface PayoutInitiationResponse {
  payoutId: PaymentId;
  status: TransactionStatus;
  created?: Timestamp;
  failureReason?: FailureReason;
}

export interface PayoutStatusResponse extends PayoutInitiationResponse {
  finalStatus?: FinalTransactionStatus | string;
  recipient?: PayerOrRecipient;
  amount?: Amount;
  currency?: Currency;
  country?: Country;
  correspondent?: string;
  statementDescription?: string;
  customerTimestamp?: Timestamp;
  receivedByRecipient?: Timestamp;
  correspondentIds?: Record<string, string>;
  metadata?: MetadataItem[];
}

// ── Bulk Payout ───────────────────────────────────────────────────────────────

export interface BulkPayoutRequest {
  payouts: PayoutRequest[];
}

export interface BulkPayoutResponse {
  payouts: PayoutInitiationResponse[];
}

// ── Refund ────────────────────────────────────────────────────────────────────

export interface RefundRequest {
  refundId: PaymentId;
  /** depositId of the deposit to be refunded */
  depositId: PaymentId;
  amount: Amount;
  currency: Currency;
  clientReferenceId?: string;
  metadata?: MetadataItem[];
}

export interface RefundInitiationResponse {
  refundId: PaymentId;
  status: TransactionStatus;
  created?: Timestamp;
  failureReason?: FailureReason;
}

export interface RefundStatusResponse extends RefundInitiationResponse {
  finalStatus?: FinalTransactionStatus | string;
  amount?: Amount;
  currency?: Currency;
  country?: Country;
  correspondent?: string;
  metadata?: MetadataItem[];
}

// ── Remittance ────────────────────────────────────────────────────────────────

export interface RemittanceRequest {
  remittanceId: PaymentId;
  recipient: PayerOrRecipient;
  amount: Amount;
  currency: Currency;
  clientReferenceId?: string;
  customerMessage?: string;
  metadata?: MetadataItem[];
}

export interface RemittanceInitiationResponse {
  remittanceId: PaymentId;
  status: TransactionStatus;
  created?: Timestamp;
  failureReason?: FailureReason;
}

// ── Toolkit ───────────────────────────────────────────────────────────────────

export interface PredictProviderRequest {
  phoneNumber: string;
}

export interface PredictProviderResponse {
  country: Country;
  provider: string;
  /** Sanitised phone number safe for other API calls */
  phoneNumber: string;
}

export interface ActiveConfigRequest {
  country?: Country;
  operationType?: OperationType;
}

export interface ActiveConfigResponse {
  companyName: string;
  signatureConfiguration: {
    signedRequestsOnly: boolean;
    signedCallbacks: boolean;
  };
  countries: ActiveCountryConfig[];
}

export interface ActiveCountryConfig {
  country: Country;
  displayName: { en?: string; fr?: string };
  prefix: string;
  flag: string;
  providers: ActiveProviderConfig[];
}

export interface ActiveProviderConfig {
  provider: string;
  displayName: string;
  logo?: string;
  nameDisplayedToCustomer: string;
  currencies: ActiveCurrencyConfig[];
}

export interface ActiveCurrencyConfig {
  currency: Currency;
  displayName: string;
  operationTypes: Partial<Record<OperationType, OperationTypeConfig>>;
}

export interface OperationTypeConfig {
  minAmount?: Amount;
  maxAmount?: Amount;
  decimalsInAmount?: DecimalsInAmount;
  status?: GatewayAvailabilityStatus;
  callbackUrl?: string;
  authType?: AuthType;
  pinPrompt?: PinPromptType;
  pinPromptRevivable?: boolean;
}

// ── Finances ──────────────────────────────────────────────────────────────────

export interface WalletBalancesResponse {
  balances: WalletBalance[];
}

export interface WalletBalance {
  provider: string;
  currency: Currency;
  balance: Amount;
  country: Country;
  status: GatewayAvailabilityStatus;
}

// ── Payment Page ──────────────────────────────────────────────────────────────

export interface PaymentPageDepositRequest {
  depositId: PaymentId;
  amount: Amount;
  currency: Currency;
  clientReferenceId?: string;
  customerMessage?: string;
  returnUrl?: string;
  metadata?: MetadataItem[];
}

export interface PaymentPageDepositResponse {
  depositId: PaymentId;
  status: TransactionStatus;
  created?: Timestamp;
  redirectUrl?: string;
  failureReason?: FailureReason;
}

// ── Callbacks (inbound webhook shapes) ───────────────────────────────────────

export interface DepositCallback extends DepositStatusResponse {}
export interface PayoutCallback extends PayoutStatusResponse {}
export interface RefundCallback extends RefundStatusResponse {}

// ── SDK config ────────────────────────────────────────────────────────────────

export type Environment = "sandbox" | "production";

export interface PawaPayConfig {
  apiToken: string;
  environment?: Environment;
  /** Override base URL (useful for tests) */
  baseUrl?: string;
  /** Request timeout in ms (default: 30 000) */
  timeout?: number;
  /** Max retry attempts for 5xx / network errors (default: 3) */
  maxRetries?: number;
  /** Base delay in ms for exponential backoff (default: 500) */
  retryDelay?: number;
  /** Custom fetch implementation (e.g. node-fetch in older Node) */
  fetchImpl?: typeof globalThis.fetch;
  /** Global request headers merged on every call */
  extraHeaders?: Record<string, string>;
}
