# Implementation TODO — Autonomous Meeting Bot

Engineering checklist for the orchestrator described in [PRD.md](PRD.md) and [docs/architecture.md](docs/architecture.md).

This repo is the **orchestrator wrapper** around [Vexa Cloud](https://docs.vexa.ai) — not a fork of Vexa.

## Status

| Phase | Status | Notes |
|-------|--------|-------|
| **0** Foundation | Done | Fastify, TypeScript, Vitest, `GET /health`, Zod env validation |
| **1** Parsers | Done | Meet + Teams URLs → `MeetingRef` + tests (Zoom out of scope) |
| **2** Vexa orchestrator | Done | `POST /bots`, poll `GET /meetings` until `active`, duplicate guard |
| **3** Easy Mode API + UI | Done | `/api/join`, `/api/status`, `/api/leave`, UI at `/` |
| **4** Advanced Mode (email) | Done | Resend `email.received` webhook → invite extraction → auto-join |
| **5** Playwright fallback | Done | Chromium join of Google Meet on retriable Vexa errors; screenshot on failure |
| **6** Reliability | Done | Correlation-ID logs, `fallback_*` events, graceful SIGTERM/SIGINT shutdown |
| **7** CI | Done | GitHub Actions: lint, typecheck, test, build |

**Verified:** `npm test` (54 passing), `npm run build`, `npm run typecheck`, `npm run lint`, `npm run dev` → http://localhost:3000

---

## Configuration

Copy [`.env.example`](.env.example) to `.env`.

```bash
# Easy Mode (minimum)
VEXA_API_KEY=...

# Advanced Mode (email auto-join)
RESEND_API_KEY=...
RESEND_WEBHOOK_SECRET=whsec_...
BOT_EMAIL=you@your-id.resend.app   # or custom-domain inbox
```

Advanced Mode also needs a public HTTPS URL (ngrok) registered in Resend at
`POST …/webhooks/resend` with event `email.received` — see [docs/setup.md](docs/setup.md).

---

## Known limitations

- **Vexa joins as an unauthenticated guest.** Meetings restricted to "only people in [org]"
  or sign-in-only will reject/kick the bot ([Vexa #98](https://github.com/Vexa-ai/vexa/issues/98),
  [#83](https://github.com/Vexa-ai/vexa/issues/83)). Most Google Meet links require a host to
  admit the bot from the lobby (`awaiting_admission` → `active`). True zero-touch join needs an
  authenticated bot identity, which Vexa Cloud does not yet support.
- **Google Meet on Vexa Cloud can be flaky** ([#407](https://github.com/Vexa-ai/vexa/issues/407));
  Teams is reliable for demos.

---

## Remaining work

### Operator (manual, no code)

- [ ] Set `VEXA_API_KEY` from [vexa.ai/account](https://vexa.ai/account)
- [ ] Easy Mode smoke test: real Google Meet + Teams URL
- [ ] Advanced Mode smoke test: invite `BOT_EMAIL` with a Meet link → bot joins
- [ ] Fallback prerequisite: `npx playwright install chromium` on the host, then `npm run auth:google` to save a signed-in session
- [ ] Fallback smoke test: force a Vexa failure → confirm Playwright joins Meet (or check `logs/screenshots/` on failure)

### Implemented (Phases 5–7)

- [x] `src/playwright/` — session store (`storageState`), `join-google-meet.ts`, `fallback-engine.ts` (lazy-loads Playwright)
- [x] Fallback runs from `orchestrator.join` only when `FALLBACK_ENABLED=true`, platform is `google_meet`, and the Vexa error is retriable (5xx/429/network) — deterministic 4xx never falls back
- [x] `npm run auth:google` saves a signed-in Google session (works around guest-join limits)
- [x] `fallback_started` / `fallback_succeeded` / `fallback_failed` lifecycle events; screenshot on failure
- [x] `SIGTERM` / `SIGINT` → stop tracked Vexa bots + close fallback browsers
- [x] GitHub Actions CI: `lint`, `typecheck`, `test`, `build`

### Possible enhancements (not planned)

- Teams Playwright fallback (`join-teams.ts`) — currently fallback covers Google Meet only
- Vexa webhooks (`meeting.status_change` / `recording.completed` via `PUT /user/webhook`,
  [docs](https://docs.vexa.ai/webhooks)) to replace status polling for a live UI
- Containerize + deploy if a stable URL is wanted instead of ngrok

---

## Out of scope (v1)

- AI summaries / transcript pipeline ([PRD Non-Goals](PRD.md#non-goals))
- Admin dashboard, multi-bot scaling, billing, calendar sync
- Zoom support

---

## References

| Topic | Link |
|-------|------|
| Product requirements | [PRD.md](PRD.md) |
| Architecture | [docs/architecture.md](docs/architecture.md) |
| Setup & ngrok | [docs/setup.md](docs/setup.md) |
| Bot email & Resend | [docs/bot-email-and-deployment.md](docs/bot-email-and-deployment.md) |
| Vexa Bots API | https://docs.vexa.ai/api/bots |
| Vexa webhooks | https://docs.vexa.ai/webhooks |
| Resend inbound email | https://resend.com/docs/dashboard/receiving/introduction |
