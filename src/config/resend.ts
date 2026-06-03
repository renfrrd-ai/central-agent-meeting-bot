import type { Env } from "./env.js";

/** Non-empty trimmed Resend credentials (empty strings in .env count as missing). */
export function isResendWebhookEnabled(env: Env): boolean {
  return Boolean(
    env.RESEND_API_KEY?.trim() && env.RESEND_WEBHOOK_SECRET?.trim(),
  );
}
