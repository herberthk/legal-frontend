---
project_name: "legal-adviser"
architecture_pattern: "Next.js App Router (Server & Client Components) with Firebase Backend"
tech_stack_versions:
  next: "16.1.6"
  react: "19.2.3"
  firebase: "^12.10.0"
  tailwind: "^4.0.0"
  zustand: "^5.0.11"
  ai_sdk: "@google/genai ^1.49.0 / @ai-sdk/google ^3.0.29"
target_model_optimization: "Gemini 2.5 Flash / Gemini models. Optimize for low latency, secure token usage tracking in Firestore, and robust text session handling."
---

# Executive Context
The Legal Adviser application provides AI-powered legal guidance utilizing Google Gemini, supporting real-time text chat. It uses a Next.js (App Router) frontend deployed as a Progressive Web App (PWA) via Serwist. Authentication, real-time database functions, and security rules are powered by Firebase. The architecture relies on Zustand for global state management and Stripe for billing/subscriptions. AI engineers are expected to focus on optimizing Gemini API calls, maintaining strict typing for AI interactions, and accurately tracking token usage for billing purposes.

# Domain Architecture & Directory Map
- `/app`: Next.js App Router core. Separated by route groups (`(auth)`, `(dashboard)`, `(legal)`), API routes (`/api`), and PWA service worker logic (`/serwist`, `/offline`).
- `/components`: Reusable UI elements, strictly modularized by domain (`admin`, `auth`, `editor`, `emails`, `global`, `landing`, `pwa`, `ui`, `user`). The `ui/` folder contains Shadcn UI primitives.
- `/store`: Zustand state management. The main store `app.ts` persists application state (active tabs, token usage history) to local storage.
- `/lib`: Core library files, configurations, and utilities (e.g., Stripe clients, Firebase admin wrappers, UI and error mapping utilities).
- `/services`: Business logic and external service integrations (e.g., Gemini Text services).
- `/firebase`: Firebase initialization, client SDK setup, and modular exports.
- `/sdk`: Standalone internal or third-party SDKs used within the app (e.g., `pawapay`).
- `/hooks`: Custom React hooks for shared component logic.
- `/utils` & `/constants`: Application-wide helper functions and static constants.

# Development & Build Commands
- **Local Development:** `npm run dev` (Runs the Next.js development server)
- **Production Build:** `npm run build` (Generates the Next.js optimized production build)
- **Start Production Server:** `npm run start` (Starts the built Next.js server)
- **Linting:** `npm run lint` (Runs ESLint with configurations defined in `eslint.config.mjs`)
- **Testing (Unit):** `npm run test` (Runs Jest with Node experimental VM modules enabled)
- **Testing (SDK specific):** `npm run test:sdk` (Runs Vitest specifically inside `sdk/pawapay`)

# Coding Standards & Paradigms
- **Framework & Rendering:** Strictly Next.js App Router. Use React Server Components by default for better performance and SEO. Add the `"use client"` directive only to components that require interactivity, browser APIs, or Zustand state hooks.
- **State Management:** Use Zustand with the `persist` middleware for global client-side state. Avoid React Context for global state unless strictly required by a third-party provider.
- **Styling:** Tailwind CSS v4 alongside Shadcn UI patterns. Use `clsx` and `tailwind-merge` for dynamic class composition.
- **Authentication & Authorization:** Rely on Firebase Auth for identity. Role-based access control is defined by `isAdmin()` and `isOwner()` paradigms.
- **Error Handling:** Map specific service/auth error codes to user-friendly strings using centralized mapping (e.g., `lib/errors.ts`). Use Sonner for UI toast notifications.

# Compliance & Security
- **Forbidden Patterns:** Do not bypass Firestore Security Rules; the `.rules` file strictly enforces `isOwner(userId)` or `isAdmin()` checks. Do not use legacy Firebase namespaced APIs (e.g., `firebase.auth()`); use modern v9+ modular imports.
- **Environment & Secrets:** Never commit `.env` files or Firebase Admin SDK JSON keys (e.g., `legal-51aee...json`). Ensure all sensitive server-side operations are handled via Server Actions or `/api` routes, and never exposed to the client bundle.
- **Quality Expectations:** All new logic must use TypeScript. Explicitly handle loading, empty, and error states for all AI interactions, third-party API fetches, and Firestore transactions.
