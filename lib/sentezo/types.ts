// ─────────────────────────────────────────────
//  Ssentezo Wallet SDK — Types
// ─────────────────────────────────────────────

// ── Configuration ────────────────────────────────────────────────────────────

/** Ssentezo API environment. Use "sandbox" for development and testing. */
export type Environment = "live" | "sandbox";

/** Only UGX is supported at this time. */
export type Currency = "UGX";

/** Configuration for the SsentezoWallet client. */
export interface SsentezoConfig {
  /**
   * Your API username.
   * Falls back to the SSENTEZO_API_USER environment variable.
   */
  apiUser?: string;

  /**
   * Your API key / secret.
   * Falls back to the SSENTEZO_API_KEY environment variable.
   */
  apiKey?: string;

  /**
   * Which environment to target.
   * Falls back to the SSENTEZO_ENV environment variable, then defaults to "live".
   */
  environment?: Environment;

  /**
   * Request timeout in milliseconds.
   * @default 30000
   */
  timeout?: number;

  /**
   * Maximum number of automatic retries on retryable errors (429, 5xx, network).
   * Each retry uses exponential back-off starting at 1 second.
   * @default 3
   */
  maxRetries?: number;

  /**
   * How long to cache the bank list in milliseconds.
   * @default 3600000 (1 hour)
   */
  bankCacheTtlMs?: number;
}

// ── Raw wire format ───────────────────────────────────────────────────────────

/** Raw JSON envelope returned by every Ssentezo endpoint. */
export type SsentezoRawResponse<T> =
  | { response: "OK"; data: T }
  | { response: "ERROR"; error: SsentezoErrorBody };

/** Error body from the Ssentezo API. */
export interface SsentezoErrorBody {
  message: string;
  /** Machine-readable code, e.g. "UPPER_CEILING_BREACH" or "RATE_LIMIT_EXCEEDED". */
  code?: string;
  /** Field-level validation errors keyed by field name. */
  errors?: Record<string, string[]>;
}

// ── Transaction lifecycle ─────────────────────────────────────────────────────

/**
 * Possible states a transaction can be in.
 *
 * - PENDING       — accepted by Ssentezo, waiting for network/user confirmation
 * - SUCCEEDED     — completed successfully
 * - FAILED        — could not be completed
 * - INDETERMINATE — network could not confirm; may resolve within 48 hours
 */
export type TransactionStatus =
  | "PENDING"
  | "SUCCEEDED"
  | "FAILED"
  | "INDETERMINATE";

// ── Balance ───────────────────────────────────────────────────────────────────

/** Wallet balance details. */
export interface BalanceData {
  /** Raw numeric balance in the smallest unit (e.g. 1834665). */
  amount: number;
  /** Human-readable formatted balance (e.g. "1,834,665"). */
  formatted: string;
  currency: Currency;
}

// ── MSISDN verification ───────────────────────────────────────────────────────

/** Result of a phone number verification request. */
export interface MsisdnData {
  /** Verified phone number in international format. */
  msisdn: string;
  FirstName: string;
  Surname: string;
}

// ── Mobile money transactions ─────────────────────────────────────────────────

/** Parameters shared between deposit and withdraw. */
export interface TransactionParams {
  /**
   * Your unique transaction identifier (max 250 chars).
   * Must be unique across ALL transactions in your account.
   * A duplicate reference will be rejected by the API.
   */
  externalReference: string;
  /** Phone number in international format (e.g. "256709920188"). */
  msisdn: string;
  /** Amount in UGX. Must be between 500 and 7,000,000. */
  amount: number;
  /** Defaults to "UGX". */
  currency?: Currency;
  /** Human-readable reason / narration shown to the payer. */
  reason: string;
  /** Optional name of the sender / recipient. */
  name?: string;
  /**
   * URL Ssentezo will POST to when the transaction succeeds.
   * Must be publicly accessible and respond within 5 seconds.
   * Must NOT require authentication.
   */
  successCallback?: string;
  /**
   * URL Ssentezo will POST to when the transaction fails.
   * Same requirements as successCallback.
   */
  failureCallback?: string;
}

/** Returned immediately after initiating a deposit or withdraw. */
export interface TransactionInitResult {
  /** Will always be "PENDING" on a successful initiation. */
  transactionStatus: "PENDING";
  /** Ssentezo's internal UUID for this transaction. */
  ssentezoWalletReference: string;
  /** ID from the mobile network operator (MTN / Airtel). */
  financialTransactionId: string;
}

/** Full transaction details returned by the status endpoint. */
export interface TransactionStatusResult {
  transactionStatus: TransactionStatus;
  ssentezoWalletReference: string;
  externalReference: string;
  financialTransactionId: string;
  amount: number;
  reason: string;
  currency: Currency;
  msisdn: string;
  /** ISO 8601 timestamp, e.g. "2024-04-24T16:24:58.000000Z". */
  transactionTime: string;
}

/** Callback payload posted to your success_callback / failure_callback URLs. */
export interface CallbackPayload {
  response: "OK";
  data: {
    transactionStatus: "SUCCEEDED" | "FAILED";
    ssentezoWalletReference: string;
    externalReference: string;
    financialTransactionId: string;
  };
}

// ── Bank transfers ────────────────────────────────────────────────────────────

/** A bank supported by Ssentezo's push-to-bank service. */
export interface Bank {
  id: number;
  bank_name: string;
  address: string;
  swift_code: string;
}

/** Parameters for initiating a bank transfer. */
export interface BankTransferParams {
  /**
   * Your unique transaction identifier (max 250 chars).
   * Use external_reference naming convention (matches the API field).
   */
  externalReference: string;
  /** Bank ID from the getBanks() response. */
  bankId: number;
  /** Full name of the bank account holder. */
  accountName: string;
  /** Bank account number. */
  accountNumber: string;
  /** Amount in UGX. Minimum is UGX 50,000. */
  amount: number;
  /** Transaction narration. */
  reason: string;
}

/** Returned after successfully initiating a bank transfer. */
export interface BankTransferInitResult {
  transactionStatus: "PENDING";
  ssentezoWalletReference: string;
  externalReference: string;
}

/** Full bank transfer status from the check-bank-transfer-status endpoint. */
export interface BankTransferStatusResult {
  transactionStatus: TransactionStatus;
  ssentezoWalletReference: string;
  externalReference: string;
  amount: number;
  /** ISO 8601 timestamp. */
  transactionTime: string;
}
