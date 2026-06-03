import { describe, expect, it } from "vitest";
import {
  isVexaMeetingAccepted,
  isVexaMeetingActive,
  mapVexaBotStatus,
  mapVexaMeetingStatus,
  resolveJoinStatus,
} from "../../src/vexa/status.js";

describe("mapVexaBotStatus", () => {
  it("maps container Up to running (not in-meeting)", () => {
    expect(mapVexaBotStatus("Up", "Up 4 seconds")).toBe("running");
  });
});

describe("mapVexaMeetingStatus", () => {
  it("maps active to joined", () => {
    expect(mapVexaMeetingStatus("active")).toBe("joined");
    expect(isVexaMeetingActive("active")).toBe(true);
  });

  it("maps awaiting_admission separately from joined", () => {
    expect(mapVexaMeetingStatus("awaiting_admission")).toBe(
      "awaiting_admission",
    );
    expect(isVexaMeetingActive("awaiting_admission")).toBe(false);
  });

  it("maps joining to running", () => {
    expect(mapVexaMeetingStatus("joining")).toBe("running");
    expect(isVexaMeetingAccepted("requested")).toBe(true);
  });
});

describe("resolveJoinStatus", () => {
  it("prefers meeting lifecycle over container Up", () => {
    expect(
      resolveJoinStatus({
        meeting: {
          platform: "google_meet",
          native_meeting_id: "abc-defg-hij",
          status: "awaiting_admission",
        },
        bot: {
          platform: "google_meet",
          native_meeting_id: "abc-defg-hij",
          normalized_status: "Up",
          status: "Up 4 seconds",
        },
      }),
    ).toBe("awaiting_admission");
  });
});
