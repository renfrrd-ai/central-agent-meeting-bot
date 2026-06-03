import "dotenv/config";
import { buildApp } from "./app.js";
import { loadEnv } from "./config/env.js";
import { isResendWebhookEnabled } from "./config/resend.js";

async function main() {
  const env = loadEnv();
  const app = await buildApp(env);

  const host = "0.0.0.0";
  await app.listen({ port: env.PORT, host });
  console.log(`Orchestrator listening on http://${host}:${env.PORT}`);
  console.log(
    isResendWebhookEnabled(env)
      ? "Advanced Mode: POST /webhooks/resend (Resend configured)"
      : "Advanced Mode: disabled — add RESEND_API_KEY + RESEND_WEBHOOK_SECRET to .env and restart",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
