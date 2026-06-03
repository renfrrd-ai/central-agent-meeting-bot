# Meeting Bot — Central Agent

Autonomous meeting bot orchestrator for **Google Meet** and **Microsoft Teams** via [Vexa Cloud](https://docs.vexa.ai/user_api_guide).

| Mode | How to use |
|------|------------|
| **Easy** | Open `http://localhost:3000`, paste a meeting URL, join |
| **Advanced** | Invite `BOT_EMAIL` on a calendar event; Resend webhook auto-joins |

## Quickstart

```bash
cp .env.example .env   # VEXA_API_KEY required; Resend vars for Advanced Mode
npm install
npm run dev
```

- Health: `curl http://localhost:3000/health`
- Webhook probe: `curl http://localhost:3000/webhooks/resend`

## Environment (minimum)

```bash
VEXA_API_KEY=...              # required
RESEND_API_KEY=...            # Advanced Mode
RESEND_WEBHOOK_SECRET=whsec_... # Advanced Mode
BOT_EMAIL=bot@your-inbox      # address on calendar invites
```

Advanced Mode also needs a public HTTPS URL (e.g. [ngrok](docs/setup.md#ngrok-for-advanced-mode)) registered in Resend as `POST …/webhooks/resend` with event `email.received`.

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
