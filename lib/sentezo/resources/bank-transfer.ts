// ─────────────────────────────────────────────
//  Ssentezo Wallet SDK — Bank Transfer Resource
// ─────────────────────────────────────────────

import type { SsentezoClient } from "../client";
import type {
  Bank,
  BankTransferInitResult,
  BankTransferParams,
  BankTransferStatusResult,
} from "../types";
import {
  validateAmount,
  validateBankId,
  validateExternalReference,
  BANK_TRANSFER_AMOUNT_MIN,
} from "../validators";

// ── Types ─────────────────────────────────────────────────────────────────────

interface BankCache {
  banks: Bank[];
  expiresAt: number;
}

// ── Resource ──────────────────────────────────────────────────────────────────

/**
 * Push-to-bank transfer operations.
 *
 * Bank transfers take longer than mobile money and have a higher minimum
 * amount (UGX 50,000). Always check transfer status before marking a
 * transaction as complete.
 *
 * Available via `wallet.bankTransfer`.
 */
export class BankTransferResource {
  private bankCache: BankCache | null = null;

  constructor(
    private readonly client: SsentezoClient,
    private readonly cacheTtlMs: number
  ) {}

  // ── Get supported banks ─────────────────────────────────────────────────────

  /**
   * Get the list of banks supported by Ssentezo.
   *
   * Results are cached in-process for `bankCacheTtlMs` (default: 1 hour)
   * since the bank list changes rarely. Pass `{ fresh: true }` to bypass
   * the cache and force a live fetch.
   *
   * @example
   * const banks = await wallet.bankTransfer.getBanks();
   * const stanbic = banks.find(b => b.bank_name === "Stanbic Bank");
   */
  async getBanks(opts: { fresh?: boolean } = {}): Promise<Bank[]> {
    const now = Date.now();

    if (!opts.fresh && this.bankCache && this.bankCache.expiresAt > now) {
      return this.bankCache.banks;
    }

    const data = await this.client.post<{ banks: Bank[] }>(
      "/push-to-bank/get-banks"
    );

    this.bankCache = {
      banks:     data.banks,
      expiresAt: now + this.cacheTtlMs,
    };

    return data.banks;
  }

  /**
   * Look up a single bank by ID.
   * Returns `undefined` if the bank ID is not found.
   *
   * @example
   * const bank = await wallet.bankTransfer.getBankById(3);
   * // { id: 3, bank_name: "Equity", ... }
   */
  async getBankById(bankId: number): Promise<Bank | undefined> {
    const banks = await this.getBanks();
    return banks.find((b) => b.id === bankId);
  }

  /**
   * Find banks whose names include `query` (case-insensitive).
   *
   * @example
   * const results = await wallet.bankTransfer.findBanks("stanbic");
   */
  async findBanks(query: string): Promise<Bank[]> {
    const lower = query.toLowerCase();
    const banks = await this.getBanks();
    return banks.filter((b) =>
      b.bank_name.toLowerCase().includes(lower)
    );
  }

  /**
   * Manually invalidate the cached bank list.
   * The next call to `getBanks()` will fetch fresh data.
   */
  clearBankCache(): void {
    this.bankCache = null;
  }

  // ── Request transfer ────────────────────────────────────────────────────────

  /**
   * Transfer money from your wallet to a bank account.
   *
   * Minimum amount: **UGX 50,000**.
   * Bank transfers take longer to process than mobile money.
   *
   * @example
   * const banks  = await wallet.bankTransfer.getBanks();
   * const stanbic = banks.find(b => b.bank_name === "Stanbic Bank")!;
   *
   * const result = await wallet.bankTransfer.requestTransfer({
   *   externalReference: generateReference(),
   *   bankId:            stanbic.id,
   *   accountName:       "John Doe",
   *   accountNumber:     "044653389534563",
   *   amount:            75_000,
   *   reason:            "Vendor payment",
   * });
   *
   * @throws {SsentezoValidationError} if amount < UGX 50,000.
   * @throws {SsentezoError}           on API-level errors.
   */
  async requestTransfer(
    params: BankTransferParams
  ): Promise<BankTransferInitResult> {
    validateExternalReference(params.externalReference);
    validateBankId(params.bankId);
    validateAmount(params.amount, { minAmount: BANK_TRANSFER_AMOUNT_MIN });

    return this.client.post<BankTransferInitResult>(
      "/push-to-bank/request-bank-transfer",
      {
        external_reference: params.externalReference,
        bank_id:            params.bankId,
        account_name:       params.accountName,
        account_number:     params.accountNumber,
        // The API accepts a string here per the documentation
        amount:             String(params.amount),
        reason:             params.reason,
      }
    );
  }

  // ── Check status ────────────────────────────────────────────────────────────

  /**
   * Check the status of a previously initiated bank transfer.
   *
   * Always verify status before marking the transfer as complete in your system.
   *
   * @example
   * const status = await wallet.bankTransfer.checkStatus("ref-abc-123");
   * if (status.transactionStatus === "SUCCEEDED") { ... }
   */
  async checkStatus(externalReference: string): Promise<BankTransferStatusResult> {
    validateExternalReference(externalReference);
    return this.client.post<BankTransferStatusResult>(
      "/push-to-bank/check-bank-transfer-status",
      { external_reference: externalReference }
    );
  }
}
