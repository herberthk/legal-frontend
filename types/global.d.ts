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

    //Flutterwave
    FLW_CLIENT_ID: string;
    FLW_CLIENT_SECRET: string;
    FLW_ENCRYPTION_KEY: string;
    FLW_WEBHOOK_SECRET: string;
    FLW_ENV: "sandbox" | "live";
  }
}
