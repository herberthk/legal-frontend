// ─────────────────────────────────────────────────────────────────────────────
// PawaPay SDK – Finances Resource
// ─────────────────────────────────────────────────────────────────────────────

import type { HttpClient } from "../http-client";
import type { WalletBalancesResponse, PaymentId, Timestamp } from "../types";
import { validatePaymentId } from "../utils";

export interface StatementRequest {
  statementId: PaymentId;
  fromDateTime: Timestamp;
  toDateTime: Timestamp;
}

export interface StatementInitiationResponse {
  statementId: PaymentId;
  status: string;
  created?: Timestamp;
  failureReason?: { failureCode: string; failureMessage: string };
}

export interface StatementStatusResponse {
  statementId: PaymentId;
  status: string;
  /** Download URL — present once the statement is COMPLETED */
  url?: string;
  created?: Timestamp;
  failureReason?: { failureCode: string; failureMessage: string };
}

export class FinancesResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Retrieve the current balance of all your pawaPay wallets.
   *
   * @example
   * ```ts
   * const { balances } = await pawapay.finances.getWalletBalances();
   * balances.forEach(b => console.log(`${b.provider}: ${b.balance} ${b.currency}`));
   * ```
   */
  async getWalletBalances(): Promise<WalletBalancesResponse> {
    return this.http.request<WalletBalancesResponse>("/v2/wallets/balances");
  }

  /**
   * Request generation of a financial statement for a given time range.
   *
   * Statements are generated asynchronously — poll `checkStatementStatus()`
   * or wait for the callback with the download URL.
   *
   * @param request.fromDateTime  RFC3339 start of the period (e.g. "2024-01-01T00:00:00Z")
   * @param request.toDateTime    RFC3339 end of the period
   */
  async initiateStatement(
    request: StatementRequest
  ): Promise<StatementInitiationResponse> {
    validatePaymentId(request.statementId, "statementId");
    if (!request.fromDateTime || !request.toDateTime) {
      throw new Error("fromDateTime and toDateTime are required.");
    }
    return this.http.request<StatementInitiationResponse>("/v2/statements", {
      method: "POST",
      body: request,
    });
  }

  /**
   * Check the status of a previously requested statement.
   * When status is COMPLETED, the response includes a `url` for download.
   */
  async checkStatementStatus(statementId: string): Promise<StatementStatusResponse> {
    validatePaymentId(statementId, "statementId");
    return this.http.request<StatementStatusResponse>(
      `/v2/statements/${statementId}`
    );
  }
}
