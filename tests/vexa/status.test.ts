import { describe, expect, it } from "vitest";
import {
  isVexaBotRunning,
  isVexaMeetingAccepted,
  mapVexaBotStatus,
} from "../../src/vexa/status.js";

describe("mapVexaBotStatus", () => {
  it("maps Vexa normalized_status Up to joined", () => {
    expect(mapVexaBotStatus("Up", "Up 4 seconds")).toBe("joined");
  });

  it("maps requested meeting status", () => {
    expect(isVexaMeetingAccepted("requested")).toBe(true);
    expect(mapVexaBotStatus(undefined, "requested")).toBe("running");
  });

  it("detects running bot", () => {
    expect(isVexaBotRunning("Up", "Up 2 seconds")).toBe(true);
    expect(isVexaBotRunning("Down", "Exited")).toBe(false);
  });
});
