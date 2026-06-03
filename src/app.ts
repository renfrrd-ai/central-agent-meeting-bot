import path from "node:path";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
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

  const publicDir = path.join(process.cwd(), "public");
  await app.register(fastifyStatic, {
    root: publicDir,
    prefix: "/",
  });

  return app;
}
