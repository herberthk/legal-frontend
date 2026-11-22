# PostHog Audit Report

## Summary

The client-side Next.js integration is healthy overall: SDK installation, initialization, identification, logout reset behavior, event naming, and growth-event coverage all passed. The audit found no correctness errors, but it did find one source-level delivery warning and four open PostHog-side recommendations or health findings.

**Counts**

- **Errors**: 0 (must fix)
- **Warnings**: 3 (should fix)
- **Suggestions**: 2 (nice to have)
- **Passes**: 11

**Problematic items**

| Severity | Area | Check | File | Details |
|----------|------|-------|------|---------|
| `warning` | Event Capture | Captures route through a reverse proxy | `instrumentation-client.ts:20` | Browser `api_host` uses the default PostHog ingest host rather than a first-party reverse proxy. |
| `warning` | Live Data | Authorized URLs not configured | — | Add every owned production and staging domain under Project settings → Authorized URLs; confirm ownership before adding any domain. |
| `warning` | Live Data | Source map recommendation open | — | The source-map recommendation is open but still computing frame-resolution statistics. |
| `suggestion` | Live Data | Error alerts not wired | — | No issue-created, issue-reopened, or issue-spiking alert is wired. |
| `suggestion` | Live Data | Rate-limit recommendation open | — | The ingestion rate-limit recommendation is open but still computing which limits are missing. |

## Recommended actions

1. **Event Capture · Captures route through a reverse proxy** — Browser events are sent directly to PostHog's ingest host from `instrumentation-client.ts:20`. _Why it matters:_ Tracking blockers can drop browser captures, creating undercounted funnels, retention, and replay coverage. _Fix:_ Configure a first-party Next.js rewrite or managed proxy and point `api_host` at it. See [Next.js reverse proxy docs](https://posthog.com/docs/advanced/proxy/nextjs#setup).
2. **Live Data · Authorized URLs not configured** — The project has no authorized product domains. _Why it matters:_ The toolbar cannot launch reliably and some web analytics filters may not work correctly without an owned-domain allowlist. _Fix:_ Add only confirmed production, staging, and owned subdomains under Project settings → Authorized URLs. See [authorized URLs health check docs](https://posthog.com/docs/health-checks/authorized-urls).
3. **Live Data · Source map recommendation open** — PostHog's source-map recommendation is open, but its frame-resolution statistics were still computing during this audit. _Why it matters:_ Unresolved production frames make exceptions harder to debug and can degrade error issue grouping. _Fix:_ Recheck the recommendation after computation; if unresolved frames are reported, configure Next.js source-map uploads. See [Next.js source map docs](https://posthog.com/docs/error-tracking/upload-source-maps/nextjs).
4. **Live Data · Error alerts not wired** — No alert is configured for created, reopened, or spiking error issues. _Why it matters:_ Newly introduced or rapidly worsening failures can remain unnoticed, delaying triage while affected sessions accumulate. _Fix:_ Create and enable appropriate notifications in Error tracking → Alerts. See [error tracking alerts docs](https://posthog.com/docs/error-tracking/alerts).
5. **Live Data · Rate-limit recommendation open** — PostHog's ingestion rate-limit recommendation is open, but the missing-limit details were still computing during this audit. _Why it matters:_ A noisy client or runaway exception can consume error-tracking quota and increase cost. _Fix:_ Recheck after computation, then set project-wide or per-issue limits if PostHog reports they are missing. See [error tracking rate limiting docs](https://posthog.com/docs/error-tracking/rate-limiting).

## Full audit

### Installation

Whether the PostHog SDK is present, current, and initialized the way the framework expects. Everything downstream depends on this: a missing or stale SDK silently changes which events exist and which config options are honoured.

| Check | Status | File | Details |
|-------|--------|------|---------|
| PostHog SDK installed | `pass` | `package.json:48` | `posthog-js@1.453.2` and `posthog-node@6.0.5` are installed. |
| SDK version up to date | `pass` | `bun.lock:2320` | Both SDKs match their latest published versions. |
| Initialization is correct | `pass` | `instrumentation-client.ts:19` | The browser SDK initializes at the canonical Next.js App Router entry point with configured env-sourced token and host. |
| One initialization per runtime | `pass` | `instrumentation-client.ts:19` | One browser initialization site and no duplicate initialization in the same runtime. |

#### Assumptions and blind spots

_No findings to qualify; the standard checks for this area passed cleanly._

### Identification

Whether the same human maps to one stable `distinct_id` across sessions, runtimes, and logins. Identity defects are the most expensive kind to fix after the fact, because they corrupt person counts, funnels, and retention retroactively rather than going forward.

| Check | Status | File | Details |
|-------|--------|------|---------|
| Stable distinct_id (not session UUID) | `pass` | `components/global/FirebaseAnalytics.tsx:36` | `identify()` uses the authenticated Firebase user UID as a stable distinct ID. |
| identify() called before captures / flag evals | `pass` | `components/global/FirebaseAnalytics.tsx:36` | Identity is established immediately on auth-state restoration or change before authenticated captures; no identity-dependent flag evaluations were found. |
| Same distinct_id across client and server | `pass` | `instrumentation-client.ts:19` | Single runtime: only the browser SDK initializes PostHog. |
| reset() called on logout / account switch | `pass` | `components/global/FirebaseAnalytics.tsx:45` | Firebase auth-state transitions reset PostHog on sign-out and before direct account changes. |

#### Assumptions and blind spots

_No findings to qualify; the standard checks for this area passed cleanly._

### Event Capture

Whether events are named consistently, reach PostHog reliably, and cover the moments the business actually reasons about. Gaps here don't break anything visibly; they just leave the questions you want to ask unanswerable.

| Check | Status | File | Details |
|-------|--------|------|---------|
| Event names are static and consistent | `pass` | `hooks/use-document-transcribe.tsx:289` | All 11 application capture calls use static string literal event names. |
| Captures route through a reverse proxy | `warning` | `instrumentation-client.ts:20` | Browser `api_host` is configured to the default PostHog ingest host rather than a first-party reverse proxy. |
| Key activation events captured | `pass` | `app/(dashboard)/dashboard/billing/checkout/StripePaymentForm.tsx:60` | Explicit account creation, activation, and payment completion events cover the main growth funnel. |

#### Assumptions and blind spots

The source scan covered explicit `posthog.capture()` calls but cannot prove what percentage of browser requests are blocked in production. The configured host is known to be the direct PostHog ingest endpoint, while the actual effect depends on user browser extensions and network policy. Autocaptured events and dynamically generated behavior outside the scanned calls were not evaluated as business events. Verify the delivery gap in live ingestion after introducing a first-party proxy.

### Live Data

What PostHog itself has already flagged for this project, read from its recommendations and health checks. These come from ingested data rather than source code, so they catch problems no static scan can see — stack frames that never resolve, syncs that keep failing, alerts nobody wired up.

| Check | Status | File | Details |
|-------|--------|------|---------|
| Open findings in PostHog | `pass` | — | 4 open findings from PostHog. |
| Authorized URLs not configured | `warning` | — | Add every owned production and staging domain under Project settings → Authorized URLs; confirm ownership before adding any domain. |
| Source map recommendation open | `warning` | — | PostHog's source-map recommendation is open but still computing frame-resolution statistics; recheck after computation finishes. |
| Error alerts not wired | `suggestion` | — | No alert is wired for issue-created, issue-reopened, or issue-spiking errors. |
| Rate-limit recommendation open | `suggestion` | — | PostHog's ingestion rate-limit recommendation is open but still computing which limits are missing; recheck after computation finishes. |

#### Assumptions and blind spots

These findings reflect what PostHog observed in the recent lookback window, so a project that has just started sending data, or one whose findings have not been recomputed yet, can show a clean area without being clean. Two recommendation payloads were still computing, so this report records their open state without inventing missing statistics. Authorized domains must be confirmed by the user because event-derived hostnames are not proof of ownership. Re-run the audit after computation finishes to confirm source-map and rate-limit details.

### Write report

This workflow check verifies that the local markdown audit report is created successfully.

| Check | Status | File | Details |
|-------|--------|------|---------|
| Create posthog-audit-report.md | `pending` | — | Pending at the moment the report body was rendered; the workflow resolves it immediately after the file exists. |

#### Assumptions and blind spots

The row is necessarily rendered before its own completion is recorded in the transient ledger. Confirm the file remains present at the project root after the audit completes.

### Upload notebook

This workflow check verifies that the completed local report is mirrored into a shareable PostHog notebook.

| Check | Status | File | Details |
|-------|--------|------|---------|
| Write the report into a PostHog notebook | `pending` | — | Pending at the moment the report body was rendered; notebook creation and verification happen after local report generation. |

#### Assumptions and blind spots

The local report is the source of truth even if notebook upload is unavailable. A successful upload still requires a read-back check to confirm that every report heading reached the cloud notebook.

## About this audit

The PostHog wizard runs this audit in stages: SDK installation → init correctness → identification → event capture → live data → this report. The early stages resolve checks against the project's source tree. The live-data stage reads what PostHog already computed from your ingested data — things no source scan can see, like whether stack frames actually resolve. Every result, pass or otherwise, is recorded in the ledger this report was generated from.

- `error` items break correctness now (events lost, identity broken). Fix first.
- `warning` items work today but cause subtle data-quality bugs. Fix when convenient.
- `suggestion` items are best-practice improvements with measurable upside.

Re-run `posthog-wizard audit` after applying fixes to refresh the ledger.
