# Meeting-bot-central-agent

Autonomous meeting bot orchestrator: joins **Google Meet**, **Microsoft Teams**, and **Zoom** via [Vexa Cloud](https://docs.vexa.ai/user_api_guide), with Playwright fallback (planned).

- **Easy Mode** — `POST /api/join` with a meeting URL
- **Advanced Mode** — invite the bot inbox; Resend webhook triggers join (planned)

## Quickstart

```bash
cp .env.example .env   # set API_KEY and VEXA_API_KEY
npm install
npm run dev
curl http://localhost:3000/health
```

Join a meeting:

```bash
curl -X POST http://localhost:3000/api/join \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"meetingUrl":"https://meet.google.com/abc-defg-hij"}'
```

## Docs

- [Setup guide](docs/setup.md)
- [How bot email, Resend, and Render work](docs/bot-email-and-deployment.md)
- [Architecture diagram](docs/architecture.md)
- [Implementation TODO](TODO.md)
- [Product requirements](PRD.md)
