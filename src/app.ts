import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import type { Env } from "./config/env.js";
import { registerApiRoutes } from "./api/routes.js";
import { createLogger } from "./logging/logger.js";
import { JoinOrchestrator } from "./orchestrator/join.js";
import {
  registerResendJsonParser,
  registerResendWebhookRoutes,
} from "./webhooks/resend-routes.js";

export interface BuildAppOptions {
  orchestrator?: JoinOrchestrator;
}

export async function buildApp(env: Env, options: BuildAppOptions = {}) {
  const logger = createLogger(env);

  const app = Fastify({
    logger: false,
  });

  app.get("/health", async () => ({ status: "ok" }));

  const orchestrator =
    options.orchestrator ?? new JoinOrchestrator({ env, logger });

  // Webhook parser + routes before API/static so POST /webhooks/resend is never shadowed.
  registerResendJsonParser(app);
  await registerResendWebhookRoutes(app, { env, logger, orchestrator });
  await registerApiRoutes(app, { env, logger, orchestrator });

  const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");
  await app.register(fastifyStatic, {
    root: publicDir,
    prefix: "/",
    wildcard: false,
    index: ["index.html"],
  });

  return app;
}
