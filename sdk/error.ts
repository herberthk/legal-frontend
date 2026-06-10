import { FailureCode, PawaPayApiError, PawaPayNetworkError, PawaPayValidationError } from "./pawapay";

export const customPawapayError = (err:unknown) => {
      if (err instanceof PawaPayValidationError) {
    // Client-side validation failed — no network call was made
    console.error("Bad request:", err.message, "field:", err.field);
  } else if (err instanceof PawaPayApiError) {
    // API returned a structured error
    console.error("API error:", err.failureCode, err.failureMessage);

    if (err.failureCode === FailureCode.PROVIDER_TEMPORARILY_UNAVAILABLE) {
      // Schedule a retry later
      console.log("Provider temporarily unavailable - retry later")
    }
    if (err.isAuthError) {
      // Token invalid / expired
      console.log("Token invalid / expired")
    }
  } else if (err instanceof PawaPayNetworkError) {
    // Timeout, DNS failure, etc.
    console.error("Network error:", err.message);
  }
}