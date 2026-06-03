import { describe, expect, it, vi } from "vitest";
import { loadEnv, resetEnvCache } from "../../src/config/env.js";
import { createLogger } from "../../src/logging/logger.js";
import { JoinOrchestrator } from "../../src/orchestrator/join.js";
import { VexaClient } from "../../src/vexa/client.js";
import { VexaApiError } from "../../src/vexa/types.js";

const testEnv = loadEnv({
  VEXA_API_KEY: "test-vexa-key",
  VEXA_API_BASE: "https://api.cloud.vexa.ai",
  VEXA_JOIN_POLL_INTERVAL_MS: "10",
  VEXA_JOIN_TIMEOUT_MS: "100",
});

function mockFetch(
  meetingStatus: string,
): typeof fetch {
  let botsListed = false;

  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";

    if (url.includes("/bots/status")) {
      if (!botsListed) {
        botsListed = true;
        return new Response(JSON.stringify({ running_bots: [] }), {
          status: 200,
        });
      }
      return new Response(
        JSON.stringify({
          running_bots: [
            {
              platform: "google_meet",
              native_meeting_id: "abc-defg-hij",
              normalized_status: "Up",
              status: "Up 4 seconds",
            },
          ],
        }),
        { status: 200 },
      );
    }

    if (url.includes("/meetings")) {
      return new Response(
        JSON.stringify({
          meetings: [
            {
              id: 219,
              platform: "google_meet",
              native_meeting_id: "abc-defg-hij",
              status: meetingStatus,
            },
          ],
        }),
        { status: 200 },
      );
    }

    if (method === "POST" && url.endsWith("/bots")) {
      return new Response(
        JSON.stringify({
          id: 219,
          platform: "google_meet",
          native_meeting_id: "abc-defg-hij",
          status: "requested",
        }),
        { status: 201 },
      );
    }

    return new Response(JSON.stringify({ detail: "not found" }), { status: 404 });
  });
}

describe("JoinOrchestrator", () => {
  it("returns joined only when meeting is active", async () => {
    resetEnvCache();
    const fetchImpl = mockFetch("active");
    const vexaClient = new VexaClient(testEnv, { fetchImpl });
    const orchestrator = new JoinOrchestrator({
      env: testEnv,
      logger: createLogger(testEnv),
      vexaClient,
    });

    const result = await orchestrator.join({
      meetingRef: {
        platform: "google_meet",
        native_meeting_id: "abc-defg-hij",
      },
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe("joined");
    expect(result.vexaMeetingId).toBe("219");
  });

  it("returns awaiting_admission when container is up but not admitted", async () => {
    resetEnvCache();
    const fetchImpl = mockFetch("awaiting_admission");
    const vexaClient = new VexaClient(testEnv, { fetchImpl });
    const orchestrator = new JoinOrchestrator({
      env: testEnv,
      logger: createLogger(testEnv),
      vexaClient,
    });

    const result = await orchestrator.join({
      meetingRef: {
        platform: "google_meet",
        native_meeting_id: "abc-defg-hij",
      },
    });

    expect(result.status).toBe("awaiting_admission");
  });

  it("returns duplicate when bot already running", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          running_bots: [
            {
              platform: "teams",
              native_meeting_id: "1234567890123",
              normalized_status: "Up",
              status: "Up 1 second",
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const vexaClient = new VexaClient(testEnv, { fetchImpl });
    const orchestrator = new JoinOrchestrator({
      env: testEnv,
      logger: createLogger(testEnv),
      vexaClient,
    });

    const result = await orchestrator.join({
      meetingRef: {
        platform: "teams",
        native_meeting_id: "1234567890123",
        passcode: "abc",
      },
    });

    expect(result.status).toBe("duplicate");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("surfaces Vexa API errors", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ running_bots: [] }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: "Invalid meeting" }), {
          status: 400,
        }),
      );

    const vexaClient = new VexaClient(testEnv, { fetchImpl });
    const orchestrator = new JoinOrchestrator({
      env: testEnv,
      logger: createLogger(testEnv),
      vexaClient,
    });

    await expect(
      orchestrator.join({
        meetingRef: {
          platform: "google_meet",
          native_meeting_id: "abc-defg-hij",
        },
      }),
    ).rejects.toBeInstanceOf(VexaApiError);
  });
});

describe("VexaClient", () => {
  it("maps meeting ref to create bot payload", () => {
    const client = new VexaClient(testEnv);
    expect(
      client.toCreateBotBody({
        platform: "teams",
        native_meeting_id: "1234567890123",
        passcode: "secret",
      }),
    ).toEqual({
      platform: "teams",
      native_meeting_id: "1234567890123",
      passcode: "secret",
      bot_name: "Central Agent Bot",
      recording_enabled: false,
      transcribe_enabled: false,
    });
  });
});
