# Setup

## Prerequisites

- Node.js 20+
- [Vexa Cloud](https://vexa.ai/account) API key
- (Advanced Mode later) [Resend](https://resend.com) API key and webhook

See [bot-email-and-deployment.md](./bot-email-and-deployment.md) for email and hosting details.

## Supported platforms

This project targets **Google Meet** (assignment) and **Microsoft Teams** (works reliably on Vexa Cloud today).

| Platform | Status |
|----------|--------|
| **Microsoft Teams** | Primary for demos when Meet is flaky — include `?p=` passcode in URL |
| **Google Meet** | Supported in code; Vexa Cloud may be unstable — see [issue #407](https://github.com/Vexa-ai/vexa/issues/407) |
| **Zoom** | Not implemented (out of scope) |

## Bot Google account (first-time signup / login)

For meetings that require a signed-in user (or Playwright fallback later):

1. **Create** a dedicated bot account externally (e.g. `renfredbot@gmail.com` or `bot@yourdomain.com`) — normal Google sign-up, not in this repo.
2. **Use that address** on calendar invites (`BOT_EMAIL` / Advanced Mode).
3. **One-time login** (planned Phase 6): run `npm run auth:google`, sign in as the bot in a browser, save session to `data/sessions/` — not per meeting, only when cookies expire.

You do **not** sign up inside the orchestrator app. The app only stores API keys and (later) saved browser sessions.

## Local run

```bash
cp .env.example .env
# Set VEXA_API_KEY (and optional BOT_* vars)

npm install
npm run dev
```

Health check:

```bash
curl http://localhost:3000/health
```

## Easy Mode UI

Open **http://localhost:3000** in your browser, paste a meeting URL, and click **Join meeting**.

## Easy Mode — join a meeting (curl)

```bash
curl -X POST http://localhost:3000/api/join \
  -H "Content-Type: application/json" \
  -d '{"meetingUrl":"https://meet.google.com/abc-defg-hij"}'
```

Supported URL formats ([Vexa meeting IDs](https://docs.vexa.ai/meeting-ids)):

| Platform | Example URL | Notes |
|----------|-------------|--------|
| Google Meet | `https://meet.google.com/abc-defg-hij` | Code becomes `native_meeting_id`; admit bot from waiting room if needed |
| Microsoft Teams | `https://teams.live.com/meet/1234567890123?p=YOUR_PASSCODE` | **`?p=` passcode required** by Vexa |

## Other endpoints

```bash
# Status
curl http://localhost:3000/api/status/google_meet/abc-defg-hij

# Leave
curl -X POST http://localhost:3000/api/leave \
  -H "Content-Type: application/json" \
  -d '{"meetingUrl":"https://meet.google.com/abc-defg-hij"}'
```

## Tests

```bash
npm test
npm run build
```
