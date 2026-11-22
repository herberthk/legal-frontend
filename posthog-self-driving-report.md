# PostHog Self-driving setup report

## Summary

PostHog Self-driving is configured for this web application. Session Replay, Error Tracking, and Support were enabled; native health, error, and support signal sources were also enabled. Findings will start appearing in the [Self-driving inbox](https://us.posthog.com/project/759134/inbox) within about 30 minutes as new data arrives.

## AI data processing

Approved.

## GitHub

The PostHog GitHub App was already connected before this run. GitHub Issues was not selected as a connected-tool source in this setup.

## Products enabled

| Product | Status | Integration check |
|---|---|---|
| Session Replay | **Enabled** | `posthog-js` initializes without `disable_session_recording`; no recordings existed at setup time. |
| Error Tracking | **Enabled** | `capture_exceptions: true` is present in the web SDK initialization. |
| Support | **Enabled** | Connect an inbound email, inbox, or Slack channel in PostHog before tickets can arrive. |

## Signal sources

| Source product / type | Action | Notes |
|---|---|---|
| `signals_scout` / `cross_source_issue` | On by default | No opt-out row exists, so scout findings can reach the inbox. |
| `health_checks` / `health_issue` | Enabled | Source id `01a20513-502b-7e19-ba2a-c40c10148fa0`. |
| `error_tracking` / `issue_created` | Enabled | Source id `01a20513-50f3-76d0-813f-366f8e54b60d`. |
| `error_tracking` / `issue_reopened` | Enabled | Source id `01a20513-50d8-7989-a3e9-1f8b9aa0925e`. |
| `error_tracking` / `issue_spiking` | Enabled | Source id `01a20513-50e0-7e4e-8078-c192cb9f67ab`. |
| `conversations` / `ticket` | Enabled | Source id `01a20513-5106-7c38-b232-5618d644c159`; it remains idle until an inbound support channel is connected. |
| `logs` / `alert_state_change` | Skipped | No evidence that the project uses PostHog Logs. |
| `endpoints` / `endpoint_execution_failed` and `endpoint_breakdown_limit_exceeded` | Skipped | Endpoint usage could not be checked with the available MCP scope. |
| `session_replay` / `session_analysis_cluster` | Skipped | Replay coverage is provided by the Replay Vision scanners below. |

## Connected tools

No external connected-tool sources were selected. The detected Sentry build tooling and the offered GitHub Issues, Linear, Jira, and Zendesk connections are recorded as **not used** for this setup; no responder was enabled for them.

## Scout troop

**Enabled troop scouts**

| Scout | Why it is enabled |
|---|---|
| General | Watches cross-product patterns and surfaces not owned by a specialist. |
| Product analytics | Covers the application's existing product event flows. |
| Revenue analytics | Covers the Stripe and multi-provider payment/billing surface. |
| AI observability | Covers the Gemini-powered legal guidance surface when AI telemetry is present. |

**Operational scout:** Inbox validation remains enabled. It runs report follow-up checks and sits outside the product-scout troop ceiling.

All other 25 materialized scouts remain disabled because their product surfaces were not evidenced as active. Error tracking is covered by its native source; session replay is covered by Replay Vision scanners. Re-enable a surface-specific scout later if the relevant PostHog product becomes active.

| Capacity | Value |
|---|---:|
| Maximum scout runs per day | 100 |
| Runs used today | 0 |
| Runs remaining today | 100 |
| Maximum enabled scouts | 250 |
| Non-operational / non-custom slots available | 249 |

> Scouts are in early access. Each project gets up to 100 scout runs a day. Contact team-self-driving@posthog.com if you need more.

## Custom scouts

No custom scouts were created; the proposal was declined. Two focused document-processing candidates were considered:

- **Document transcription completion:** a sustained drop from transcription completion to saving a result. Declined.
- **Document review completion:** a sustained drop from review completion to saving a result. Declined.

The generic chat and payment surfaces were not proposed because the current event taxonomy does not provide a complete success/failure sequence for a reliable, low-noise discriminator. If a custom scout later becomes noisy, set its `emit` configuration to `false` in PostHog to keep it in dry-run mode.

## Replay Vision scanners

A scanner is an LLM that watches individual session recordings on a schedule and pushes qualifying visible defects to the inbox. These are the only objects in this setup that spend Replay Vision quota. Each finding arrives at half weight and needs independent corroboration before it is promoted into a report.

| Scanner | Status | Scope | Sampling | Estimated monthly spend |
|---|---|---|---:|---:|
| Document processing breakage monitor | **Created** | Recordings visiting `/dashboard/transcribe` or `/dashboard/review`; these are the app's document transcription and document review completion flows, where users upload/process/view/save work. | 100% | 0 credits / 0 observations from the current estimate |
| User frustration monitor | **Created** | Recordings with `$rageclick`, excluding the transcription and review pages so it does not duplicate the breakage monitor. | 100% | 0 credits / 0 observations from the current estimate |

Replay Vision has a 2,500-credit budget remaining for the current period and is not exhausted. No recordings existed when the scanners were sized, so both monitors are armed and start scanning when eligible recordings begin arriving.

## Files modified or created

| File | Change |
|---|---|
| `posthog-self-driving-report.md` | Created this configuration and handoff report. |

## Follow-ups

- [ ] Connect an inbound Support channel (email, inbox, or Slack) in PostHog to begin collecting support tickets.
- [ ] Deploy the existing web application configuration with `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST` available in production, then generate real sessions so replay recordings and the two scanners can begin work.
- [ ] If this project uses PostHog Endpoints, enable its two endpoint responders after reauthorizing the MCP connection with endpoint-read permission.
- [ ] The Self-driving project profile was still being built during setup; rerun or refresh later if you want its server-side product inventory to inform future tuning.
- [ ] Rate early scanner observations in the Replay Vision UI with a thumbs-up or thumbs-down and a short note to improve their prompts.

## What happens next

The scout coordinator picks up these fresh configurations within about 30 minutes. Scout runs draw from the project's daily budget, findings cluster into reports in the inbox, and immediately actionable reports can start coding tasks. This work is billed to the PostHog organization and is capped by its Self-driving billing limit; see [organization billing](https://us.posthog.com/organization/billing).
