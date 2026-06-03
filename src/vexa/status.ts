import type { JoinStatus } from "../parsers/types.js";

/**
 * Map Vexa bot status fields to orchestrator JoinStatus.
 * @see https://docs.vexa.ai/api/bots — `normalized_status` is typically `"Up"` when running.
 */
export function mapVexaBotStatus(
  normalizedStatus?: string,
  rawStatus?: string,
): JoinStatus {
  const normalized = (normalizedStatus ?? "").trim().toLowerCase();
  const raw = (rawStatus ?? "").trim().toLowerCase();

  if (
    normalized === "up" ||
    raw.startsWith("up") ||
    normalized.includes("running") ||
    raw.includes("running")
  ) {
    return "joined";
  }

  if (
    normalized.includes("fail") ||
    raw.includes("fail") ||
    normalized.includes("error") ||
    raw.includes("error")
  ) {
    return "failed";
  }

  if (normalized.includes("stop") || raw.includes("stop")) {
    return "stopped";
  }

  if (
    normalized.includes("request") ||
    raw.includes("request") ||
    normalized.includes("start") ||
    raw.includes("start")
  ) {
    return "running";
  }

  return "requested";
}

/** True when Vexa reports the bot container is up (meeting join in progress or active). */
export function isVexaBotRunning(
  normalizedStatus?: string,
  rawStatus?: string,
): boolean {
  return mapVexaBotStatus(normalizedStatus, rawStatus) === "joined";
}

/** True when POST /bots initial meeting `status` indicates accept (e.g. `"requested"`). */
export function isVexaMeetingAccepted(meetingStatus?: string): boolean {
  const value = (meetingStatus ?? "").toLowerCase();
  return value === "requested" || value === "starting" || value === "running";
}
