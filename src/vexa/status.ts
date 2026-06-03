import type { JoinStatus } from "../parsers/types.js";
import type { VexaMeetingRecord, VexaRunningBot } from "./types.js";

/**
 * Map Vexa container fields from GET /bots/status.
 * "Up" means the bot container is running — not necessarily admitted to the call.
 * @see https://docs.vexa.ai/api/bots#get-botsstatus
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
    return "running";
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

/**
 * Map Vexa meeting lifecycle from GET /meetings.
 * @see https://docs.vexa.ai/concepts — joining, awaiting_admission, active, …
 */
export function mapVexaMeetingStatus(meetingStatus?: string): JoinStatus {
  const value = (meetingStatus ?? "").trim().toLowerCase();

  if (value === "active") {
    return "joined";
  }

  if (value === "awaiting_admission") {
    return "awaiting_admission";
  }

  if (value === "failed") {
    return "failed";
  }

  if (
    value === "completed" ||
    value === "stopped" ||
    value === "stopping"
  ) {
    return "stopped";
  }

  if (value === "joining" || value === "requested" || value === "starting") {
    return "running";
  }

  return "running";
}

/** Prefer meeting lifecycle; fall back to container status when no meeting record. */
export function resolveJoinStatus(options: {
  meeting?: VexaMeetingRecord;
  bot?: VexaRunningBot;
}): JoinStatus {
  if (options.meeting?.status) {
    return mapVexaMeetingStatus(options.meeting.status);
  }

  if (!options.bot) {
    return "stopped";
  }

  return mapVexaBotStatus(options.bot.normalized_status, options.bot.status);
}

/** True when Vexa meeting lifecycle is `active` (bot admitted to the call). */
export function isVexaMeetingActive(meetingStatus?: string): boolean {
  return mapVexaMeetingStatus(meetingStatus) === "joined";
}

/** True when POST /bots initial meeting `status` indicates accept (e.g. `"requested"`). */
export function isVexaMeetingAccepted(meetingStatus?: string): boolean {
  const value = (meetingStatus ?? "").toLowerCase();
  return value === "requested" || value === "starting" || value === "running";
}
