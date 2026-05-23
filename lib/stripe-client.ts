// "use client"
// import { loadStripe, type Stripe } from "@stripe/stripe-js";

// // Module-level singleton — created once for the lifetime of the browser tab.
// // This prevents the Stripe.js script from being loaded multiple times.
// let stripePromise: Promise<Stripe | null> | null = null;

// /**
//  * Loads Stripe.js with automatic retry logic.
//  * Retries up to `maxRetries` times with exponential backoff to handle
//  * transient CDN failures that cause "Failed to load Stripe.js".
//  */
// const loadStripeWithRetry = async (
//   publishableKey: string,
//   retries = 7,
//   delay = 1000,
// ): Promise<Stripe | null> => {
//   for (let attempt = 1; attempt <= retries; attempt++) {
//     try {
//       const stripe = await loadStripe(publishableKey);
//       if (stripe) return stripe;

//       // loadStripe resolved to null — unusual, treat as failure
//       if (attempt < retries) {
//         await new Promise((res) => setTimeout(res, delay * attempt));
//       }
//     } catch (err) {
//       console.error(`Stripe.js load attempt ${attempt} failed:`, err);
//       if (attempt < retries) {
//         await new Promise((res) => setTimeout(res, delay * attempt));
//       }
//     }
//   }
//   console.error("Stripe.js failed to load after all retries.");
//   return null;
// };

// /**
//  * Returns the module-level Stripe promise singleton.
//  * Safe to call multiple times — Stripe.js is only loaded once.
//  * Returns `null` if the env variable is missing (avoids runtime throws in SSR).
//  */
// export const getStripe = (): Promise<Stripe | null> => {
//   if (typeof window === "undefined") {
//     // Server-side — return a resolved null promise safely
//     return Promise.resolve(null);
//   }

//   if (!stripePromise) {
//     const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
//     if (!key) {
//       console.error("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not defined");
//       return Promise.resolve(null);
//     }
//     stripePromise = loadStripeWithRetry(key);
//   }

//   return stripePromise;
// };

// /**
//  * Resets the singleton — useful for testing or forced reloads.
//  */
// export const resetStripePromise = () => {
//   stripePromise = null;
// };

import { loadStripe, type Stripe } from "@stripe/stripe-js";

let stripePromise: Promise<Stripe | null>;

export const getStripe = () => {
  if (!stripePromise) {
    if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
      throw new Error("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not defined");
    }
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
  }
  return stripePromise;
};
