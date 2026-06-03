# Setup

## Prerequisites

- Node.js 20+
- [Vexa Cloud](https://vexa.ai/account) API key
- (Advanced Mode later) [Resend](https://resend.com) API key and webhook

See [bot-email-and-deployment.md](./bot-email-and-deployment.md) for email and hosting details.

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
| Google Meet | `https://meet.google.com/abc-defg-hij` | Code becomes `native_meeting_id` |
| Microsoft Teams | `https://teams.live.com/meet/1234567890123?p=YOUR_PASSCODE` | **`?p=` passcode required** by Vexa |
| Zoom | `https://zoom.us/j/12345678901?pwd=...` | `pwd` optional but recommended |

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
