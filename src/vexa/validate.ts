import { ParseError } from "../parsers/errors.js";
import type { MeetingRef } from "../parsers/types.js";

/**
 * Validate MeetingRef before calling Vexa POST /bots.
 * @see https://docs.vexa.ai/meeting-ids
 */
export function validateMeetingRefForVexa(meeting: MeetingRef): void {
  if (meeting.platform === "teams" && !meeting.passcode?.trim()) {
    throw new ParseError(
      "missing_passcode",
      "Microsoft Teams requires a passcode (?p= in the meeting URL)",
    );
  }

  if (meeting.platform === "google_meet" && !meeting.native_meeting_id.trim()) {
    throw new ParseError("missing_meeting_id", "Google Meet meeting code is required");
  }

  if (meeting.platform === "zoom" && !/^\d{9,11}$/.test(meeting.native_meeting_id)) {
    throw new ParseError(
      "invalid_meeting_id",
      "Zoom native_meeting_id must be 9–11 digits",
    );
  }

  if (meeting.platform === "teams" && !/^\d{9,15}$/.test(meeting.native_meeting_id)) {
    throw new ParseError(
      "invalid_meeting_id",
      "Teams native_meeting_id must be a numeric meeting ID",
    );
  }
}
