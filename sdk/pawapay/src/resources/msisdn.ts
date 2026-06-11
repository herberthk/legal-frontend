import { MsisdnData, MsisdnVerificationResponse } from "../types";
import { base64Encode } from "../utils";
import { validateMsisdn } from "../utils/validators";

/**
 * Phone number (MSISDN) verification.
 *
 * Always verify a recipient's phone number before disbursing funds to them.
 * This confirms the number is registered on a supported network and returns
 * the account holder's name so you can display a confirmation step to the user.
 *
 * Available via `wallet.msisdn`.
 */

 const API_BASE_URL = "https://devwallet.ssentezo.com/api";

 const API_USER="aacb471c-1073-4edb-906b-b1b3c5287e1a"
const API_KEY="f17c71c3cf97a0c993befc3317fc3668"
export class MsisdnResource {
    private readonly authHeader: string;
  constructor() {
    this.authHeader = `Basic ${base64Encode(`${API_USER}:${API_KEY}`)}`;
  }

  /**
   * Verify the name associated with a Ugandan mobile money number.
   *
   * @param msisdn  Phone number in international format (e.g. "256709920188").
   *
   * @example
   * const info = await wallet.msisdn.verify("256709920188");
   * console.log(`${info.FirstName} ${info.Surname}`); // "John Doe"
   *
   * @throws {PawaPayValidationError} if the MSISDN format is invalid.
   * @throws {PawaPayError}           if the number cannot be verified.
   */
 private async makeFetchRequest(msisdn: string): Promise<MsisdnVerificationResponse> {
     return await fetch(`${API_BASE_URL}/msisdn-verification`, {
        method: 'POST',
        headers: {
             Authorization:  this.authHeader,
            "Content-Type": "application/json",
            // Hint to the HTTP layer that we want persistent connections
            Connection: "keep-alive",
        },
        body: JSON.stringify({
            msisdn,
        }),
    }).then(res => res.json());
  }
  async verify(msisdn: string): Promise<MsisdnVerificationResponse> {
    validateMsisdn(msisdn);
    return this.makeFetchRequest(msisdn);
  }
}