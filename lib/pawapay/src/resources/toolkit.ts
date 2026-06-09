// ─────────────────────────────────────────────────────────────────────────────
// PawaPay SDK – Toolkit Resource
// ─────────────────────────────────────────────────────────────────────────────

import type { HttpClient } from "../http-client";
import type {
  PredictProviderRequest,
  PredictProviderResponse,
  ActiveConfigRequest,
  ActiveConfigResponse,
  OperationType,
  Country,
} from "../types";

export interface ProviderAvailabilityResponse {
  providerId: string;
  country: Country;
  operationTypes: Array<{
    operationType: OperationType;
    status: string;
    reason?: string;
  }>;
}

export interface PublicKeysResponse {
  keys: Array<{
    kid: string;
    kty: string;
    use: string;
    alg: string;
    n?: string;
    e?: string;
    crv?: string;
    x?: string;
  }>;
}

export class ToolkitResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Predict the MNO provider for a given phone number.
   *
   * Also sanitises/normalises the phone number for use in other API calls.
   * Average misprediction rate: ~0.12% (higher in Benin due to number portability).
   *
   * @example
   * ```ts
   * const prediction = await pawapay.toolkit.predictProvider({ phoneNumber: '+256 700 123 456' });
   * // { country: 'UGA', provider: 'MTN_MOMO_UGA', phoneNumber: '256700123456' }
   * ```
   */
  async predictProvider(
    request: PredictProviderRequest
  ): Promise<PredictProviderResponse> {
    return this.http.request<PredictProviderResponse>("/v2/predict-provider", {
      method: "POST",
      body: request,
    });
  }

  /**
   * Retrieve your active account configuration.
   *
   * Returns the countries and providers configured for your account,
   * supported currencies, transaction limits, auth types, and more.
   * Use this to dynamically build payment UIs and validate amounts.
   *
   * @param filters Optionally filter by country (ISO 3166-1 alpha-3) and/or
   *                operationType.
   */
  async getActiveConfiguration(
    filters?: ActiveConfigRequest
  ): Promise<ActiveConfigResponse> {
    return this.http.request<ActiveConfigResponse>("/v2/active-conf", {
      method: "GET",
      params: {
        country: filters?.country,
        operationType: filters?.operationType,
      },
    });
  }

  /**
   * Check real-time availability of providers.
   *
   * Returns the current operational status (OPERATIONAL / DELAYED / CLOSED)
   * for each provider and operation type.
   */
  async getProviderAvailability(): Promise<ProviderAvailabilityResponse[]> {
    return this.http.request<ProviderAvailabilityResponse[]>(
      "/v2/availability"
    );
  }

  /**
   * Retrieve pawaPay's public keys for verifying signed callbacks (RFC-9421).
   * Cache these keys — they change infrequently.
   */
  async getPublicKeys(): Promise<PublicKeysResponse> {
    return this.http.request<PublicKeysResponse>("/v2/public-keys");
  }
}
