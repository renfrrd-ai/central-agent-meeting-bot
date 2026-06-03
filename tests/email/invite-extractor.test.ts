import { describe, expect, it } from "vitest";
import {
  extractMeetingRefFromInvite,
  extractMeetingUrls,
} from "../../src/email/invite-extractor.js";

const GOOGLE_HTML = `
<html><body>
<p>Join with Google Meet: <a href="https://meet.google.com/abc-defg-hij">Meet link</a></p>
</body></html>
`;

const TEAMS_HTML = `
<p>Microsoft Teams meeting</p>
<a href="https://teams.live.com/meet/1234567890123?p=SecretPass">Join</a>
`;

const ICS_SNIPPET = `
BEGIN:VEVENT
SUMMARY:Standup
LOCATION:https://meet.google.com/xyz-abcd-efg
END:VEVENT
`;

describe("extractMeetingUrls", () => {
  it("finds Google Meet links in HTML", () => {
    const urls = extractMeetingUrls(GOOGLE_HTML);
    expect(urls).toContain("https://meet.google.com/abc-defg-hij");
  });

  it("finds Teams links in HTML", () => {
    const urls = extractMeetingUrls(TEAMS_HTML);
    expect(urls.some((u) => u.includes("teams.live.com/meet/1234567890123"))).toBe(
      true,
    );
  });

  it("finds Meet links in ICS LOCATION", () => {
    const urls = extractMeetingUrls(ICS_SNIPPET);
    expect(urls).toContain("https://meet.google.com/xyz-abcd-efg");
  });
});

describe("extractMeetingRefFromInvite", () => {
  it("returns parsed Google Meet ref", () => {
    const ref = extractMeetingRefFromInvite(GOOGLE_HTML);
    expect(ref).toEqual({
      platform: "google_meet",
      native_meeting_id: "abc-defg-hij",
      sourceUrl: "https://meet.google.com/abc-defg-hij",
    });
  });

  it("returns parsed Teams ref with passcode", () => {
    const ref = extractMeetingRefFromInvite(TEAMS_HTML);
    expect(ref?.platform).toBe("teams");
    expect(ref?.native_meeting_id).toBe("1234567890123");
    expect(ref?.passcode).toBe("SecretPass");
  });

  it("returns null when no supported link exists", () => {
    expect(extractMeetingRefFromInvite("Hello, no meeting here.")).toBeNull();
  });
});
