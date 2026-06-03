import Fastify from "fastify";
import type { Env } from "./config/env.js";
import { registerApiRoutes } from "./api/routes.js";
import { createLogger } from "./logging/logger.js";

export async function buildApp(env: Env) {
  const logger = createLogger(env);

  const app = Fastify({
    logger: false,
  });

  app.get("/health", async () => ({ status: "ok" }));

  await registerApiRoutes(app, { env, logger });

  return app;
}
