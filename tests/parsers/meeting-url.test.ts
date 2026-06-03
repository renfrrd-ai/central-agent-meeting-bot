import { describe, expect, it } from "vitest";
import { ParseError, parseMeetingUrl } from "../../src/parsers/index.js";

describe("parseMeetingUrl", () => {
  it("parses Google Meet hyphenated code", () => {
    expect(
      parseMeetingUrl("https://meet.google.com/abc-defg-hij"),
    ).toEqual({
      platform: "google_meet",
      native_meeting_id: "abc-defg-hij",
      sourceUrl: "https://meet.google.com/abc-defg-hij",
    });
  });

  it("parses Google Meet nickname URL", () => {
    expect(parseMeetingUrl("https://meet.google.com/my-team-standup")).toEqual({
      platform: "google_meet",
      native_meeting_id: "my-team-standup",
      sourceUrl: "https://meet.google.com/my-team-standup",
    });
  });

  it("parses Teams live URL with passcode", () => {
    expect(
      parseMeetingUrl(
        "https://teams.live.com/meet/1234567890123?p=AbCdEfGh123",
      ),
    ).toEqual({
      platform: "teams",
      native_meeting_id: "1234567890123",
      passcode: "AbCdEfGh123",
      sourceUrl:
        "https://teams.live.com/meet/1234567890123?p=AbCdEfGh123",
    });
  });

  it("parses Teams microsoft.com URL", () => {
    expect(
      parseMeetingUrl(
        "https://teams.microsoft.com/l/meetup-join/19/meeting/1234567890123?p=xyz",
      ),
    ).toMatchObject({
      platform: "teams",
      native_meeting_id: "1234567890123",
      passcode: "xyz",
    });
  });

  it("parses Zoom URL with password", () => {
    expect(
      parseMeetingUrl(
        "https://us05web.zoom.us/j/12345678901?pwd=abc123secret",
      ),
    ).toEqual({
      platform: "zoom",
      native_meeting_id: "12345678901",
      passcode: "abc123secret",
      sourceUrl:
        "https://us05web.zoom.us/j/12345678901?pwd=abc123secret",
    });
  });

  it("parses Zoom URL without password", () => {
    expect(parseMeetingUrl("https://zoom.us/j/98765432109")).toEqual({
      platform: "zoom",
      native_meeting_id: "98765432109",
      sourceUrl: "https://zoom.us/j/98765432109",
    });
  });

  it("rejects unsupported hosts", () => {
    expect(() => parseMeetingUrl("https://example.com/meeting")).toThrow(
      ParseError,
    );
  });

  it("rejects invalid URLs", () => {
    expect(() => parseMeetingUrl("not-a-url")).toThrow(ParseError);
  });
});
