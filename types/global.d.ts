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
  }
}
