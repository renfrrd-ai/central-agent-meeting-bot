import { VexaApiError } from "../vexa/types.js";

/**
 * Decide whether a failed Vexa join is worth retrying via the Playwright fallback.
 *
 * - Vexa 5xx / 429 → transient, fall back.
 * - Vexa 4xx (invalid meeting, bad key, etc.) → deterministic, do NOT fall back.
 * - Network / timeout / unknown errors → fall back (a browser may still work).
 */
export function isRetriableJoinError(error: unknown): boolean {
  if (error instanceof VexaApiError) {
    return error.isServerError || error.status === 429;
  }
  return error instanceof Error;
}
