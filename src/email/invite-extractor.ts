import { ParseError, parseMeetingUrl } from "../parsers/index.js";
import type { MeetingRef } from "../parsers/types.js";

const MEET_URL_PATTERN =
  /https?:\/\/meet\.google\.com\/(?:lookup\/)?[a-z0-9-]+(?:\/[a-z0-9-]+)?/gi;

const TEAMS_URL_PATTERN =
  /https?:\/\/(?:teams\.live\.com\/meet\/\d+(?:\?[^\s"'<>]*)?|(?:[a-z0-9-]+\.)?teams\.microsoft\.(?:com|us)\/[^\s"'<>]+)/gi;

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function collectUrlMatches(content: string, pattern: RegExp): string[] {
  const matches = content.match(pattern);
  return matches ? [...new Set(matches.map((u) => u.trim()))] : [];
}

/** Pull candidate meeting URLs from plain text, HTML, or ICS bodies. */
export function extractMeetingUrls(...parts: (string | undefined)[]): string[] {
  const combined = parts.filter(Boolean).join("\n");
  if (!combined.trim()) {
    return [];
  }

  const decoded = decodeHtmlEntities(combined);
  const urls = [
    ...collectUrlMatches(decoded, MEET_URL_PATTERN),
    ...collectUrlMatches(decoded, TEAMS_URL_PATTERN),
  ];

  return [...new Set(urls)];
}

/** Parse the first supported meeting link found in invite content. */
export function extractMeetingRefFromInvite(
  ...parts: (string | undefined)[]
): MeetingRef | null {
  const urls = extractMeetingUrls(...parts);

  for (const url of urls) {
    try {
      return parseMeetingUrl(url);
    } catch (error) {
      if (!(error instanceof ParseError)) {
        throw error;
      }
    }
  }

  return null;
}
