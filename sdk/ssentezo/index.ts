// ─────────────────────────────────────────────
//  Ssentezo Wallet SDK — Main Entry Point
//
//  ⚠️  SERVER-SIDE ONLY
//  This module must never be imported from client components or
//  client-side code. It reads credentials from environment variables
//  and makes authenticated HTTP requests.
//
//  If you are using Next.js App Router, add the line below to
//  the top of any file that imports this module to enforce the rule
//  at build time:
//
//    import "server-only";
//
// ─────────────────────────────────────────────

import { SsentezoClient } from "./client";
import { BalanceResource } from "./resources/balance";
import { BankTransferResource } from "./resources/bank-transfer";
import { MsisdnResource } from "./resources/msisdn";
import { TransactionsResource } from "./resources/transactions";
import type { SsentezoConfig } from "./types";

// ── Re-exports (single import surface for consumers) ──────────────────────────

export * from "./types";

export * from "./errors";

export * from "./utils";

export * from "./error-handler";


// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_BANK_CACHE_TTL_MS = 60 * 60 * 1_000; // 1 hour

// ── Main class ────────────────────────────────────────────────────────────────

/**
 * Main Ssentezo Wallet client.
 *
 * Instantiate once (or use `getSsentezoWallet()`) and call the resource
 * methods on it.
 *
 * Credentials are read from the config object first, then fall back to
 * environment variables:
 *   - `SSENTEZO_API_USER`
 *   - `SSENTEZO_API_KEY`
 *   - `SSENTEZO_ENV` ("live" | "sandbox", defaults to "live")
 *
 * @example
 * // lib/payments.ts
 * import { getSsentezoWallet } from "@/lib/ssentezo";
 * export const wallet = getSsentezoWallet();
 *
 * // app/api/checkout/route.ts
 * import { wallet } from "@/lib/payments";
 * const result = await wallet.transactions.deposit({ ... });
 */
export class SsentezoWallet {
  /**
   * Check your Ssentezo wallet balance.
   * @see {@link BalanceResource}
   */
  readonly balance: BalanceResource;

  /**
   * Verify mobile money phone numbers before transacting.
   * @see {@link MsisdnResource}
   */
  readonly msisdn: MsisdnResource;

  /**
   * Collect money from (deposit) and send money to (withdraw) mobile money
   * accounts, and check transaction status.
   * @see {@link TransactionsResource}
   */
  readonly transactions: TransactionsResource;

  /**
   * Transfer money from your wallet to a Ugandan bank account.
   * @see {@link BankTransferResource}
   */
  readonly bankTransfer: BankTransferResource;

  constructor(config: SsentezoConfig = {}) {
    const apiUser =
      config.apiUser ?? process.env.SSENTEZO_API_USER;

    const apiKey =
      config.apiKey ?? process.env.SSENTEZO_API_KEY;

    const environment =
      config.environment ??
      (process.env.SSENTEZO_ENV as "live" | "sandbox" | undefined) ??
      "live";

    if (!apiUser || !apiKey) {
      throw new Error(
        "[SsentezoWallet] Missing credentials.\n" +
          "Either pass { apiUser, apiKey } to the constructor, or set the\n" +
          "SSENTEZO_API_USER and SSENTEZO_API_KEY environment variables."
      );
    }

    const client = new SsentezoClient({
      ...config,
      apiUser,
      apiKey,
      environment,
    });

    const cacheTtl = config.bankCacheTtlMs ?? DEFAULT_BANK_CACHE_TTL_MS;

    this.balance     = new BalanceResource(client);
    this.msisdn      = new MsisdnResource(client);
    this.transactions = new TransactionsResource(client);
    this.bankTransfer = new BankTransferResource(client, cacheTtl);
  }
}

// ── Singleton helper ──────────────────────────────────────────────────────────

/**
 * Get a shared `SsentezoWallet` instance.
 *
 * In **production**, a new instance is returned every time to prevent state
 * bleed between serverless invocations.
 *
 * In **development**, the instance is reused across Next.js Hot Module
 * Replacement (HMR) reloads to avoid "too many open connections" warnings.
 *
 * @example
 * // lib/ssentezo/index.ts  (re-export or just use directly)
 * export const wallet = getSsentezoWallet();
 */
export function getSsentezoWallet(config?: SsentezoConfig): SsentezoWallet {
  if (process.env.NODE_ENV === "production") {
    // Serverless: new instance per cold start — no shared mutable state
    return new SsentezoWallet(config);
  }

  // Development: reuse across HMR reloads via the Node.js global object
  const globalForSsentezo = globalThis as typeof globalThis & {
    __ssentezoWallet?: SsentezoWallet;
  };

  if (!globalForSsentezo.__ssentezoWallet) {
    globalForSsentezo.__ssentezoWallet = new SsentezoWallet(config);
  }

  return globalForSsentezo.__ssentezoWallet;
}
