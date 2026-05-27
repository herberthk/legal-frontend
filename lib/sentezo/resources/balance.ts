// ─────────────────────────────────────────────
//  Ssentezo Wallet SDK — Balance Resource
// ─────────────────────────────────────────────

import type { SsentezoClient } from "../client";
import type { BalanceData } from "../types";

/**
 * Access your Ssentezo wallet balance.
 *
 * Available via `wallet.balance`.
 */
export class BalanceResource {
  constructor(private readonly client: SsentezoClient) {}

  /**
   * Get your current wallet balance.
   *
   * **Important:** Balance data is never cached — every call hits the API.
   * Cache the result yourself if you need to display it frequently.
   *
   * @example
   * const balance = await wallet.balance.check();
   * console.log(balance.formatted); // "1,834,665"
   * console.log(balance.amount);    // 1834665
   */
  async check(currency: "UGX" = "UGX"): Promise<BalanceData> {
    return this.client.post<BalanceData>("/acc_balance", { currency });
  }
}
