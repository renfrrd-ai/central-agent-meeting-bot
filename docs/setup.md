# Setup

## Prerequisites

- Node.js 20+
- [Vexa Cloud](https://vexa.ai/account) API key
- (Advanced Mode) [Resend](https://resend.com) API key, webhook secret, and [ngrok](https://ngrok.com) (or other HTTPS tunnel)

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
3. **One-time login**: run `npm run auth:google`, sign in as the bot in a browser, save session to `data/sessions/` — not per meeting, only when cookies expire (used by the Playwright fallback below).

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

## ngrok for Advanced Mode

**Easy Mode** (paste a Meet URL in the UI) works on `localhost` only — no tunnel needed.

**Advanced Mode** (invite `BOT_EMAIL`, Resend webhook auto-join) needs a **public HTTPS** URL because Resend cannot POST to `localhost`.

### Quick start

1. Run the app: `npm run dev` (listens on port 3000).
2. In another terminal: `ngrok http 3000`
3. Copy the **HTTPS** URL, e.g. `https://abc123.ngrok-free.app`
4. In [Resend](https://resend.com) → Webhooks, set:
   ```text
   https://abc123.ngrok-free.app/webhooks/resend
   ```
5. Keep **both** terminals running while you demo.

### Notes

| Topic | Detail |
|-------|--------|
| **Free ngrok** | URL changes every time you restart ngrok — update the Resend webhook URL |
| **Browser warning** | ngrok’s interstitial is for browsers only; Resend’s server POST is unaffected |
| **Trainer demo** | Share your ngrok URL while the tunnel is up, or use **Easy Mode** so they only need the UI |
| **Env vars** | Same as `.env` locally — ngrok does not need extra keys |

### Advanced Mode test

1. Set `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, and `BOT_EMAIL` in `.env`.
2. Register webhook URL `https://<ngrok>/webhooks/resend` with event **`email.received`**.
3. Send a calendar invite to `BOT_EMAIL` with a Google Meet or Teams link.
4. Watch server logs for `email_join_triggered` and `join_succeeded`.

## Playwright fallback (Google Meet)

When a Vexa join fails with a **retriable** error (5xx, 429, or a network error), the
orchestrator falls back to joining Google Meet directly in Chromium. Deterministic Vexa
errors (4xx — bad URL, invalid key) never trigger the fallback.

### One-time browser setup

```bash
npx playwright install chromium   # download the browser binary
npm run auth:google               # sign in once; saves data/sessions/google_meet.json
```

### Behavior & config

| Var | Default | Effect |
|-----|---------|--------|
| `FALLBACK_ENABLED` | `true` | Set `false` to disable the fallback entirely |
| `HEADLESS` | `true` | Set `false` to watch the browser join |
| `PLAYWRIGHT_SESSION_DIR` | `./data/sessions` | Where the saved Google session lives |

- Without a saved session, the bot joins as a **guest** using `BOT_DISPLAY_NAME`; many Meet
  links then require a host to admit it from the lobby (`awaiting_admission`).
- On failure, a screenshot is written to `logs/screenshots/` and a `fallback_failed` event is logged.

## Graceful shutdown

On `SIGTERM` / `SIGINT` the app stops accepting requests, asks Vexa to stop any bots it
started this session, and closes any open fallback browsers (`shutdown_started` →
`bot_stopped` in the logs).

## Tests & CI

```bash
npm test         # vitest (browsers not required)
npm run typecheck
npm run lint
npm run build
```

CI runs the same four steps on every push/PR — see `.github/workflows/ci.yml`.
