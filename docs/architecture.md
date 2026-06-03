# Architecture

Plain-language email and webhook setup: [bot-email-and-deployment.md](bot-email-and-deployment.md).  
Local dev: [setup.md](setup.md).

## System overview

```mermaid
flowchart LR
  subgraph triggers [Triggers]
    UI[Easy Mode UI / POST /api/join]
    Email[Calendar invite to BOT_EMAIL]
  end

  subgraph inbound [Inbound email]
    Resend[Resend receiving]
    Webhook[POST /webhooks/resend]
    Email --> Resend
    Resend --> Webhook
  end

  subgraph app [Orchestrator localhost:3000]
    Parser[Meeting URL parser]
    Orch[Join orchestrator]
    UI --> Parser
    Webhook --> Parser
    Parser --> Orch
  end

  subgraph external [External]
    Vexa[Vexa Cloud API]
    Meet[Google Meet]
    Teams[Microsoft Teams]
  end

  Orch --> Vexa
  Vexa --> Meet
  Vexa --> Teams
```

## Modes

| Mode | Trigger | Needs Resend / ngrok |
|------|---------|----------------------|
| **Easy** | Paste Meet/Teams URL | No |
| **Advanced** | Invite `BOT_EMAIL` | Yes (webhook + public HTTPS) |

## Source layout

```
src/
  api/           # POST /api/join, status, leave
  webhooks/      # POST /webhooks/resend
  email/         # Invite parsing, Resend client, processor
  orchestrator/  # Vexa join pipeline
  vexa/          # Vexa HTTP client
  parsers/       # URL → MeetingRef
  config/        # Env validation
  logging/
public/          # Easy Mode UI
```
