# Legal Adviser - Frontend Application

An AI-powered legal guidance and consultation platform built with Next.js 16 (App Router), React 19, Firebase, Google Gemini, and Serwist PWA support.

---

## 🚀 Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router, Server & Client Components)
- **Runtime & Package Manager**: [Bun](https://bun.sh/)
- **Library**: [React 19](https://react.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) & [Shadcn UI](https://ui.shadcn.com/)
- **PWA & Offline Support**: [Serwist](https://serwist.pages.dev/) (`@serwist/next`)
- **Backend & Auth**: Firebase (Firebase Auth, Firestore, Firebase Admin SDK)
- **State Management**: [Zustand](https://zustand-demo.pmnd.rs/) with persistence
- **AI Integrations**: Google Generative AI (`@google/genai`), Vercel AI SDK (`ai`, `@ai-sdk/google`, `@ai-sdk/google-vertex`) with Gemini 2.5 Flash / Gemini models
- **Payments & Billing**: Stripe (`@stripe/stripe-js`), NylonPay (`@nile-squad/nylonpay-ts`), and custom PawaPay SDK (`sdk/pawapay`)
- **Rich Text & Document Processing**: Tiptap Editor (`@tiptap/react`), `@react-pdf/renderer`, `pdf-parse`, `mammoth` (DOCX parsing)
- **Audio & Media**: [Mediabunny](https://github.com/mediabunny) & browser audio recorder Web Worker
- **Observability**: [Sentry](https://sentry.io/) (`@sentry/nextjs`)
- **Testing**: Vitest, Jest (`ts-jest`), and Playwright (`@playwright/test`)

---

## ✨ Key Features

- **AI-Powered Legal Chat & Guidance**: Real-time legal assistance powered by Google Gemini, complete with token usage tracking and session persistence in Firestore.
- **Progressive Web App (PWA)**: Built-in service worker via Serwist providing offline capabilities, asset caching, and mobile installation.
- **Role-Based Dashboards**: Custom interfaces tailored for `Admin`, `Legal`, and `User` roles with dynamic navigation and responsive design.
- **Document Editing & Analysis**: Integrated Tiptap rich-text editor supporting markdown, PDF generation (`@react-pdf/renderer`), and document parsing (PDF and DOCX).
- **Multi-Provider Billing & Subscriptions**: Support for Stripe payments/subscriptions alongside regional mobile payment gateways (NylonPay and PawaPay).
- **Voice & Audio Processing**: Web Worker-based recording capabilities (`hooks/recorder.worker.ts`) and audio processing via Mediabunny.
- **Dark & Light Mode**: Seamless theme switching powered by `next-themes` and CSS custom variables.

---

## 📁 Project Structure

```text
├── app/                  # Next.js App Router (route groups: (auth), (dashboard), (legal), api routes, PWA sw logic)
├── components/           # Reusable UI elements (admin, auth, editor, emails, global, landing, pwa, ui, user)
│   └── ui/               # Shadcn UI primitives
├── store/                # Zustand global state stores (app.ts with localStorage persistence)
├── services/             # External service integrations & business logic (Gemini services)
├── firebase/             # Firebase SDK client setup, Admin wrapper, and configuration
├── lib/                  # Utility functions, Stripe client, error mappers, and helpers
├── sdk/                  # Standalone internal/third-party SDKs (e.g., pawapay)
├── hooks/                # Custom React hooks & Web Worker scripts (recorder.worker.ts)
├── types/                # TypeScript definitions & ambient type declarations
├── utils/                # Helper functions & static utilities
├── tests/                # Unit, integration, and E2E tests
└── public/               # Static assets & compiled worker scripts
```

---

## 🛠️ Getting Started

### Prerequisites

- **Bun** (Recommended runtime and package manager) or **Node.js** (v20+)
- Firebase Project with Auth and Firestore enabled
- Google Gemini / Vertex AI API Keys

### Installation

1. **Clone the repository and install dependencies using Bun**:

   ```bash
   bun install
   ```

2. **Set up Environment Variables**:

   Create a `.env.local` file at the root of the project mirroring `.env.example` (or as required by your service setup), including:

   - **Firebase Config**: `NEXT_PUBLIC_FIREBASE_*` and Firebase Admin credentials
   - **Google AI**: `GEMINI_API_KEY` / Google Cloud Vertex credentials
   - **Stripe**: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
   - **Payment Gateways**: NylonPay & PawaPay API keys (if applicable)
   - **Sentry**: `SENTRY_AUTH_TOKEN`, `NEXT_PUBLIC_SENTRY_DSN` (optional for error tracking)

---

## 💻 Local Development & Build Commands

- **Development Server**:

  ```bash
  bun run dev
  ```
  *Note: `bun run dev` automatically compiles the recorder worker (`hooks/recorder.worker.ts` -> `public/js/recorder-worker.js`) via esbuild before launching `next dev`.*

- **Production Build**:

  ```bash
  bun run build
  ```

- **Start Production Server**:

  ```bash
  bun run start
  ```

- **Linting & Code Formatting**:

  ```bash
  bun run lint
  bun run lint:fix
  ```

- **Testing**:

  ```bash
  # Run main unit/component tests (Vitest / Jest)
  bun run test

  # Run PawaPay SDK specific tests
  bun run test:sdk
  ```

- **Build Web Worker Separately**:

  ```bash
  bun run build:worker
  ```

---

## 🔒 Security & Best Practices

- **Firestore Security Rules**: Security enforcement is strictly handled by `firestore.rules`. Never bypass security checks in application code.
- **Environment & Secrets**: Keep secret keys strictly in server-side actions, `/api` routes, or environment variables. Never commit `.env` files or Firebase Admin JSON keys to version control.
- **React Server Components**: Leverage React Server Components (RSC) by default for optimal performance. Reserve the `"use client"` directive for interactive components, browser APIs, or Zustand hooks.
