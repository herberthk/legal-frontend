// ─────────────────────────────────────────────
//  Ssentezo Wallet SDK — MSISDN Resource
// ─────────────────────────────────────────────

import type { SsentezoClient } from "../client";
import type { MsisdnData } from "../types";
import { validateMsisdn } from "../validators";

/**
 * Phone number (MSISDN) verification.
 *
 * Always verify a recipient's phone number before disbursing funds to them.
 * This confirms the number is registered on a supported network and returns
 * the account holder's name so you can display a confirmation step to the user.
 *
 * Available via `wallet.msisdn`.
 */
export class MsisdnResource {
  constructor(private readonly client: SsentezoClient) {}

  /**
   * Verify the name associated with a Ugandan mobile money number.
   *
   * @param msisdn  Phone number in international format (e.g. "256709920188").
   *
   * @example
   * const info = await wallet.msisdn.verify("256709920188");
   * console.log(`${info.FirstName} ${info.Surname}`); // "John Doe"
   *
   * @throws {SsentezoValidationError} if the MSISDN format is invalid.
   * @throws {SsentezoError}           if the number cannot be verified.
   */
  async verify(msisdn: string): Promise<MsisdnData> {
    validateMsisdn(msisdn);
    return this.client.post<MsisdnData>("/msisdn-verification", { msisdn });
  }
}
