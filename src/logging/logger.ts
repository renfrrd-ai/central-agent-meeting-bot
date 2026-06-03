import pino from "pino";
import type { Env } from "../config/env.js";

export function createLogger(env: Env) {
  return pino({
    level: env.LOG_LEVEL,
    base: undefined,
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

export type Logger = ReturnType<typeof createLogger>;

export type LifecycleEvent =
  | "trigger_received"
  | "link_parsed"
  | "vexa_bot_requested"
  | "vexa_status"
  | "join_succeeded"
  | "join_failed"
  | "duplicate_bot"
  | "fallback_started"
  | "fallback_succeeded"
  | "fallback_failed"
  | "shutdown_started"
  | "bot_stopped";

export function logLifecycle(
  logger: Logger,
  event: LifecycleEvent,
  fields: Record<string, unknown>,
): void {
  logger.info({ event, ...fields }, event);
}
