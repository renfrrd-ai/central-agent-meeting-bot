import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildApp } from "./app.js";
import { loadEnv, resetEnvCache } from "./config/env.js";
import { isResendWebhookEnabled } from "./config/resend.js";
import { createLogger } from "./logging/logger.js";
import { JoinOrchestrator } from "./orchestrator/join.js";
import { PlaywrightFallbackEngine } from "./playwright/fallback-engine.js";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
config({ path: resolve(projectRoot, ".env") });

async function main() {
  resetEnvCache();
  const env = loadEnv();
  const logger = createLogger(env);

  const fallbackEngine = env.FALLBACK_ENABLED
    ? new PlaywrightFallbackEngine(env, logger)
    : undefined;
  const orchestrator = new JoinOrchestrator({ env, logger, fallbackEngine });
  const app = await buildApp(env, { orchestrator });

  const host = "0.0.0.0";
  await app.listen({ port: env.PORT, host });
  console.log(`Orchestrator listening on http://localhost:${env.PORT}`);
  console.log(
    isResendWebhookEnabled(env)
      ? `Advanced Mode: POST http://localhost:${env.PORT}/webhooks/resend`
      : "Advanced Mode: disabled — set RESEND_API_KEY + RESEND_WEBHOOK_SECRET in .env and restart",
  );
  console.log(
    fallbackEngine
      ? "Playwright fallback: enabled (run `npx playwright install chromium` if not installed)"
      : "Playwright fallback: disabled (FALLBACK_ENABLED=false)",
  );

  let shuttingDown = false;
  const shutdown = async (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "shutdown_received");
    try {
      await app.close();
      await orchestrator.shutdown();
    } catch (error) {
      logger.error({ error }, "shutdown_error");
    } finally {
      process.exit(0);
    }
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
