import type { Env } from "../config/env.js";
import { parseCsvList } from "../config/env.js";

/** Parse `Name <user@domain.com>` or bare address. */
export function parseEmailAddress(from: string): string {
  const trimmed = from.trim();
  const angleMatch = trimmed.match(/<([^>]+)>/);
  const address = angleMatch ? angleMatch[1]! : trimmed;
  return address.trim().toLowerCase();
}

export function isSenderAllowed(from: string, env: Env): boolean {
  const email = parseEmailAddress(from);
  const mode = env.INVITE_SENDER_MODE;

  if (mode === "open") {
    return true;
  }

  const allowedSenders = parseCsvList(env.ALLOWED_INVITE_SENDERS).map((s) =>
    s.toLowerCase(),
  );

  if (mode === "strict") {
    return allowedSenders.includes(email);
  }

  const allowedDomains = parseCsvList(env.ALLOWED_INVITE_DOMAINS).map((d) =>
    d.toLowerCase(),
  );
  const domain = email.split("@")[1];
  if (domain && allowedDomains.includes(domain)) {
    return true;
  }

  return allowedSenders.includes(email);
}
