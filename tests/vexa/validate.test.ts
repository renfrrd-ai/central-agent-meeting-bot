import { describe, expect, it } from "vitest";
import { ParseError } from "../../src/parsers/errors.js";
import { validateMeetingRefForVexa } from "../../src/vexa/validate.js";

describe("validateMeetingRefForVexa", () => {
  it("requires Teams passcode", () => {
    expect(() =>
      validateMeetingRefForVexa({
        platform: "teams",
        native_meeting_id: "1234567890123",
      }),
    ).toThrow(ParseError);
  });

  it("accepts Teams with passcode", () => {
    expect(() =>
      validateMeetingRefForVexa({
        platform: "teams",
        native_meeting_id: "1234567890123",
        passcode: "abc",
      }),
    ).not.toThrow();
  });
});
