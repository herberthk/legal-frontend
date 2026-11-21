# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Legal Adviser** — AI-powered legal guidance PWA for the Ugandan market. Next.js 16 App Router + React 19, Firebase (Auth/Firestore/Storage/FCM), Google Gemini via Vertex AI, metered token/second billing with Stripe + PawaPay mobile money. Bun is the runtime and package manager.

## Commands

```bash
bun install

bun run dev              # builds recorder worker, then next dev
bun run build            # builds recorder worker, then next build
bun run lint             # eslint (lint:fix to autofix)

bun run test             # vitest watch — component tests (jsdom)
bunx vitest run          # single pass, what CI runs
bunx vitest run components/landing/__tests__/Hero.test.tsx   # one file
bunx vitest run -t "renders pricing"                          # one test by name

bun run test:sdk         # vitest inside sdk/pawapay (node env, own config)
bunx playwright test     # E2E — see caveat below
```

`bun run dev`/`build` first run `build:worker`, which esbuild-bundles `hooks/recorder.worker.ts` → `public/js/recorder-worker.js`. That output is gitignored, so a fresh clone must run one of these before voice recording works.

**Testing layout:** `vitest.config.mts` only picks up `app/**/__tests__/**/*.test.tsx` and `components/**/__tests__/**/*.test.tsx`. `vitest.setup.ts` stubs `IntersectionObserver`/`matchMedia` and globally mocks `@/firebase/client`, so component tests never touch real Firebase. `jest.config.ts` is stale — it targets a `lib/ssentezo/` directory that no longer exists and no script invokes it; use Vitest.

**Playwright caveat:** `playwright.config.ts` sets `baseURL` to the live production site and the `webServer` block is commented out, so `bunx playwright test` runs against production, not localhost. Change `baseURL` (or uncomment `webServer`) before using it to verify local changes.

## Architecture

### Auth: session cookie, verified server-side

Firebase Auth runs client-side, but the app's source of truth is an HTTP-only `session` cookie minted by the Admin SDK (`setSessionCookie` in `lib/actions/auth.ts`, 1-week expiry).

- **Server code** calls `getCurrentUser()` (full Firestore user doc) or `getAuthenticatedUserId()` (uid only) — both verify the cookie via `auth.verifySessionCookie`. Never trust a client-supplied uid in a route handler or action.
- **`proxy.ts`** is the Next 16 middleware (renamed from `middleware.ts`). It only checks cookie _presence_ to redirect unauthenticated users off `/dashboard`, `/admin`, `/notifications`, and injects `x-device-*` headers parsed from the UA. Real authorization happens in layouts and actions.
- **Role gating** lives in `app/(dashboard)/admin/layout.tsx`, which calls `notFound()` for non-`ADMIN`/`SUPER_ADMIN`. `app/(dashboard)/layout.tsx` redirects anonymous users to `/login`.
- **`components/global/AuthProvider.tsx`** hydrates the Zustand auth store from the server session, then keeps it live with a Firestore `onSnapshot` on the user doc — so balance/token deductions made server-side appear in the UI without a refetch.

### Two Firebase apps — keep them apart

`firebase/client.ts` initializes the named app `[DEFAULT]` (client SDK: auth, firestore, storage, messaging, analytics, functions in `europe-west3`). `firebase/admin.ts` initializes a separate app named `admin` (Admin SDK, service-account env vars). Server actions and route handlers import `db`/`auth` from `@/firebase/admin`; client components import from `@/firebase/client`. Mixing them is the most common source of runtime errors here.

Collection names are centralized in `constants/collection.ts` (`COLLECTIONS.*`) — use those rather than string literals. Writes that use `FieldValue.serverTimestamp()` are typed with the `FirestoreWrite<T, K>` helper.

`firestore.rules` enforces `isOwner(userId)` / `isAdmin()`. The `otp` collection is fully client-blocked (`allow read, write: if false`) because it's Admin-SDK only. Never work around a rule in application code — fix the rule.

### Metered billing wraps every AI feature

This is the cross-cutting invariant. Any new AI-consuming endpoint must follow the same sequence, seen in `app/api/chat/route.ts` and `app/api/review/route.ts`:

1. `getAuthenticatedUserId()` → 401.
2. `checkUserCanSend(userId)` → 402 if the account is inactive or out of credit.
3. **Estimate cost before spending it** — `CHARS_PER_TOKEN` for text, a 500-token floor for PDFs (scanned PDFs have no text layer and would otherwise estimate to zero), 258 tokens per image — and reject up front if the estimate exceeds available credit.
4. Stream the response.
5. `recordUsageAndDeduct(...)` in the completion callback. It runs a Firestore transaction that deducts in a fixed order: **welcome bonus → daily free tokens → paid balance**, and writes a `usage` record.

Rates and quotas are constants in `constants/constants.ts` (`COST_PER_THOUSAND_TOKENS`, `COST_PER_VOICE_MINUTE`, `FREE_WELCOME_*`, `USD_TO_UGX_EXCHANGE_RATE`). Balances are stored in **US cents**; the UI converts to UGX.

### Two distinct Gemini paths

- **Text / document review** — Vercel AI SDK over Vertex AI. `lib/actions/vertex.ts` builds a `createVertex` provider from service-account env vars; routes call `streamText`/`generateText`. `/api/review` uses `Output` + a Zod schema for structured document analysis. DOCX is unsupported inline by Gemini, so `mammoth` extracts it to text and the file part is rewritten as a text part; PDFs and images pass through natively.
- **Live voice** — `@google/genai` WebSocket sessions directly from the browser. The API key never reaches the client: `/api/gemini-token` mints a short-lived ephemeral token (60 min, 5 min to open a session). `hooks/use-gemini-live.ts` orchestrates it with sub-hooks under `hooks/use-gemini-live/` (audio graph, mic stream, ephemeral token, Firestore sync). Mic PCM is downsampled to 16 kHz with VAD inside an AudioWorklet whose source is the `WORKLET_CODE` string in `constants/gemini.ts`. Voice billing posts to `/api/voice-billing` after the call.

### PWA / service worker

Serwist via `@serwist/turbopack`. `app/sw.ts` is the service-worker source; `app/serwist/[path]/route.ts` serves it and `next.config.ts` rewrites `/sw.js` → `/serwist/sw.js`. FCM background push is handled inside `app/sw.ts` (foreground push in `firebase/client.ts` + `FCMProvider`). FCM token acquisition deliberately waits for the Serwist registration to become active — there's a real race between `FCMProvider` and `SerwistProvider` otherwise.

### next.config.ts is load-bearing

It carries a strict per-origin **CSP** — adding any third-party script, image host, or API origin requires editing it or requests will be blocked. It also sets a deliberately permissive CSP on the `/serwist/sw.js` response (a SW enforces its own response's CSP for internal `fetch`), `Cross-Origin-Opener-Policy: same-origin-allow-popups` for Firebase popup OAuth, a `/__/auth/:path*` rewrite proxying to the Firebase auth domain, `serverExternalPackages: ["pdf-parse"]`, and the React Compiler (`reactCompiler: true`).

## Conventions

- **Ambient global types.** `types/*.d.ts` declare `User`, `Message`, `Transaction`, `Role`, `FirestoreWrite`, voice/payment types etc. in `declare global` — they are used **without imports**. Add new shared domain types there, not as local exports.
- **Server actions** live in `lib/actions/**` with `"use server"`, and are re-exported through `lib/index.ts`, so most imports are `from "@/lib"`. Path alias is `@/*` → repo root.
- **RSC by default.** `"use client"` only for interactivity, browser APIs, or Zustand hooks.
- **Zustand with `persist`** for global client state (`store/`: app, auth, checkout, theme, pop). Theme uses `skipHydration` plus an inline script in `app/layout.tsx` that applies the class before paint — dark is the default.
- **Shadcn UI** (`new-york`, neutral base, CSS variables) in `components/ui`; Tailwind v4 configured entirely in `app/globals.css`. Compose classes with `clsx`/`tailwind-merge`; toasts via Sonner.
- **Firebase Auth error codes** map to user-facing copy through `getFriendlyErrorMessage` in `lib/errors.ts`.
- **Payments:** PawaPay is a vendored SDK at `sdk/pawapay` (own vitest config and tests) instantiated in `sdk/index.ts`; provider callbacks land in `app/api/webhooks/{deposit,payout,refund,stripe}`.

## Secrets

`.env` and `legal-adviser-*-firebase-adminsdk-*.json` are gitignored and must stay that way. Server-only keys (`FIREBASE_PRIVATE_KEY`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `STRIPE_SECRET_KEY`, `PAWAPAY_API_TOKEN`, `SMTP_*`) must never be referenced from a `"use client"` file — only `NEXT_PUBLIC_*` vars are safe there. Multi-line private keys are stored escaped and unescaped at load with `.replace(/\\n/g, "\n")`.
