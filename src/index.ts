import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildApp } from "./app.js";
import { loadEnv, resetEnvCache } from "./config/env.js";
import { isResendWebhookEnabled } from "./config/resend.js";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
config({ path: resolve(projectRoot, ".env") });

async function main() {
  resetEnvCache();
  const env = loadEnv();
  const app = await buildApp(env);

  const host = "0.0.0.0";
  await app.listen({ port: env.PORT, host });
  console.log(`Orchestrator listening on http://localhost:${env.PORT}`);
  console.log(
    isResendWebhookEnabled(env)
      ? `Advanced Mode: POST http://localhost:${env.PORT}/webhooks/resend`
      : "Advanced Mode: disabled — set RESEND_API_KEY + RESEND_WEBHOOK_SECRET in .env and restart",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
