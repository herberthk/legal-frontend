declare namespace NodeJS {
  interface ProcessEnv {
    // Firebase client config
    NEXT_PUBLIC_FIREBASE_API_KEY: string;
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: string;
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: string;
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: string;
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: string;
    NEXT_PUBLIC_FIREBASE_APP_ID: string;
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: string;
    NEXT_PUBLIC_FIREBASE_VAPID_KEY: string;

    // Firebase server
    FIREBASE_API_KEY: string;
    FIREBASE_STORAGE_BUCKET: string;
    FIREBASE_MESSAGING_SENDER_ID: string;
    FIREBASE_PROJECT_ID: string;
    FIREBASE_APP_ID: string;
    FIREBASE_CLIENT_EMAIL: string;
    FIREBASE_PRIVATE_KEY: string;

    // Google
    GOOGLE_GENERATIVE_AI_API_KEY: string;

    // SMTP configuration
    SMTP_HOST: string;
    SMTP_PASSWORD: string;
    SMTP_USER: string;
    SMTP_PORT: string;

    // Stripe
    STRIPE_SECRET_KEY: string;
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: string;
    STRIPE_WEBHOOK_SECRET: string;

     /**
     * Ssentezo API username.
     * Generated from the "API Access" menu in your Ssentezo merchant dashboard.
     * SERVER-SIDE ONLY — never prefix with NEXT_PUBLIC_.
     */
    SSENTEZO_API_USER?: string;

    /**
     * Ssentezo API key / secret.
     * Generated from the "API Access" menu in your Ssentezo merchant dashboard.
     * SERVER-SIDE ONLY — never prefix with NEXT_PUBLIC_.
     */
    SSENTEZO_API_KEY?: string;

    /**
     * Ssentezo environment to target.
     * - "live"    — real money, production API  (default)
     * - "sandbox" — test API, no real money
     */
    SSENTEZO_ENV?: "live" | "sandbox";

    /**
     * Your app's public base URL.
     * Used to construct absolute callback URLs, e.g.:
     *   `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/callback`
     *
     * Example: "https://yourapp.com"  (no trailing slash)
     */
    NEXT_PUBLIC_APP_URL?: string;

    //PawaPay
    PAWAPAY_API_TOKEN: string;

    // Vertex AI
    GOOGLE_VERTEX_PROJECT_ID: string;
    GOOGLE_VERTEX_LOCATION: string;
    GOOGLE_CLIENT_EMAIL: string;
    GOOGLE_PRIVATE_KEY: string;

    // Firebase App Check reCAPTCHA configuration
    /**
     * The site key for the reCAPTCHA provider. This is **NOT** the same
     * as the private key. You can get this from the Firebase Console
     * under "App Check" → "reCAPTCHA provider" → "Provider configuration".
     */
    NEXT_PUBLIC_FIREBASE_RECAPTCHA_SITE_KEY: string;
    NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN: string;
    DISABLE_APP_CHECK?: string;

    NEXT_PUBLIC_BUILD_ENVIRONMENT: string;
    CRON_SECRET: string
  }
}

declare module "jsdom" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export class JSDOM {
    constructor(html?: string, options?: unknown);
    window: unknown;
  }
}
