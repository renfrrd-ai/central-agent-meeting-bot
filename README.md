# Meeting Bot — Central Agent

Autonomous meeting bot orchestrator for **Google Meet** and **Microsoft Teams** via [Vexa Cloud](https://docs.vexa.ai/user_api_guide).

| Mode | How to use |
|------|------------|
| **Easy** | Open `http://localhost:3000`, paste a meeting URL, join |
| **Advanced** | Invite `BOT_EMAIL` on a calendar event; Resend webhook auto-joins |

## Setup

```bash
cp .env.example .env
npm install
npm run dev          # http://localhost:3000
```

**1. Easy Mode (minimum).** Set one var, then open the UI or POST a URL:

```bash
VEXA_API_KEY=...     # from https://vexa.ai/account
```

```bash
curl -X POST http://localhost:3000/api/join \
  -H "Content-Type: application/json" \
  -d '{"meetingUrl":"https://meet.google.com/abc-defg-hij"}'
```

**2. Advanced Mode (email auto-join).** Add Resend + a public HTTPS URL so calendar invites
to `BOT_EMAIL` auto-join:

```bash
RESEND_API_KEY=...
RESEND_WEBHOOK_SECRET=whsec_...   # from the Resend webhook
BOT_EMAIL=bot@your-inbox
```

Expose the app (e.g. [ngrok](docs/setup.md#ngrok-for-advanced-mode)) and register
`POST …/webhooks/resend` in Resend with event `email.received`. See [bot email guide](docs/bot-email-and-deployment.md).

**3. Playwright fallback (optional).** Joins Meet directly if Vexa fails — run
`npx playwright install chromium` and `npm run auth:google`. See [setup](docs/setup.md#playwright-fallback-google-meet).

Verify: `curl http://localhost:3000/health` and `curl http://localhost:3000/webhooks/resend`.

## Docs

- [Setup](docs/setup.md) — local dev, ngrok, curl examples
- [Bot email & Resend](docs/bot-email-and-deployment.md) — Advanced Mode, custom domain MX
- [Architecture](docs/architecture.md)
- [PRD](PRD.md)

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server with reload |
| `npm test` | Unit tests |
| `npm run build` | Compile to `dist/` |
| `npm start` | Run compiled app |
| `npm run auth:google` | Save a signed-in Google session for the fallback |
