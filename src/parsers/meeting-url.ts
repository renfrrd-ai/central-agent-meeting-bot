import { ParseError } from "./errors.js";
import type { MeetingRef, Platform } from "./types.js";

const MEET_CODE_PATTERN = /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/i;
const MEET_NICKNAME_PATTERN = /^[a-z0-9-]{1,63}$/i;

function parseUrl(input: string): URL {
  const trimmed = input.trim();
  let urlString = trimmed;
  if (!/^https?:\/\//i.test(urlString)) {
    urlString = `https://${urlString}`;
  }

  try {
    return new URL(urlString);
  } catch {
    throw new ParseError("invalid_url", `Invalid meeting URL: ${input}`);
  }
}

function parseGoogleMeet(hostname: string, pathname: string, sourceUrl: string): MeetingRef {
  const host = hostname.toLowerCase();
  if (host !== "meet.google.com") {
    throw new ParseError("unsupported_host", `Unsupported Google Meet host: ${hostname}`);
  }

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) {
    throw new ParseError("missing_meeting_id", "Google Meet URL is missing a meeting code");
  }

  const code = segments[0]!;
  if (segments[0] === "lookup" && segments[1]) {
    return {
      platform: "google_meet",
      native_meeting_id: segments[1]!,
      sourceUrl,
    };
  }

  if (!MEET_CODE_PATTERN.test(code) && !MEET_NICKNAME_PATTERN.test(code)) {
    throw new ParseError("invalid_meeting_id", `Invalid Google Meet code: ${code}`);
  }

  return {
    platform: "google_meet",
    native_meeting_id: code.toLowerCase(),
    sourceUrl,
  };
}

function parseTeams(hostname: string, pathname: string, searchParams: URLSearchParams, sourceUrl: string): MeetingRef {
  const host = hostname.toLowerCase();
  const isTeamsHost =
    host === "teams.live.com" ||
    host.endsWith(".teams.microsoft.com") ||
    host === "teams.microsoft.com" ||
    host.endsWith(".teams.microsoft.us") ||
    host === "gov.teams.microsoft.us";

  if (!isTeamsHost) {
    throw new ParseError("unsupported_host", `Unsupported Teams host: ${hostname}`);
  }

  const passcode = searchParams.get("p") ?? searchParams.get("passcode") ?? undefined;

  const meetPathMatch = pathname.match(/\/meet\/(\d{9,15})/i);
  if (meetPathMatch) {
    return {
      platform: "teams",
      native_meeting_id: meetPathMatch[1]!,
      passcode: passcode ?? undefined,
      sourceUrl,
    };
  }

  const queryMeetingId = searchParams.get("meetingId") ?? searchParams.get("meetingid");
  if (queryMeetingId && /^\d{9,15}$/.test(queryMeetingId)) {
    return {
      platform: "teams",
      native_meeting_id: queryMeetingId,
      passcode: passcode ?? undefined,
      sourceUrl,
    };
  }

  const pathDigits = pathname.match(/(\d{12,15})/);
  if (pathDigits) {
    return {
      platform: "teams",
      native_meeting_id: pathDigits[1]!,
      passcode: passcode ?? undefined,
      sourceUrl,
    };
  }

  throw new ParseError(
    "missing_meeting_id",
    "Could not extract Teams numeric meeting ID. Use a teams.live.com/meet/{id}?p=... link.",
  );
}

function detectPlatform(hostname: string): Platform | null {
  const host = hostname.toLowerCase();
  if (host === "meet.google.com") return "google_meet";
  if (
    host === "teams.live.com" ||
    host.endsWith(".teams.microsoft.com") ||
    host === "teams.microsoft.com" ||
    host.endsWith(".teams.microsoft.us") ||
    host === "gov.teams.microsoft.us"
  ) {
    return "teams";
  }
  return null;
}

export function parseMeetingUrl(input: string): MeetingRef {
  const url = parseUrl(input);
  const platform = detectPlatform(url.hostname);

  if (!platform) {
    throw new ParseError(
      "unsupported_platform",
      `Unsupported meeting platform for host: ${url.hostname}`,
    );
  }

  switch (platform) {
    case "google_meet":
      return parseGoogleMeet(url.hostname, url.pathname, url.toString());
    case "teams":
      return parseTeams(url.hostname, url.pathname, url.searchParams, url.toString());
  }
}

export function meetingRefKey(ref: MeetingRef): string {
  return `${ref.platform}:${ref.native_meeting_id}`;
}
