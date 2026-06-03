import { describe, expect, it, vi } from "vitest";
import { loadEnv, resetEnvCache } from "../../src/config/env.js";
import { createLogger } from "../../src/logging/logger.js";
import { JoinOrchestrator } from "../../src/orchestrator/join.js";
import { VexaClient } from "../../src/vexa/client.js";
import { VexaApiError } from "../../src/vexa/types.js";

const testEnv = loadEnv({
  API_KEY: "test-api-key",
  VEXA_API_KEY: "test-vexa-key",
  VEXA_API_BASE: "https://api.cloud.vexa.ai",
  VEXA_JOIN_POLL_INTERVAL_MS: "10",
  VEXA_JOIN_TIMEOUT_MS: "100",
});

describe("JoinOrchestrator", () => {
  it("creates bot when not running", async () => {
    resetEnvCache();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ running_bots: [] }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 219,
            platform: "google_meet",
            native_meeting_id: "abc-defg-hij",
            status: "requested",
          }),
          { status: 201 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
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
        platform: "google_meet",
        native_meeting_id: "abc-defg-hij",
      },
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe("joined");
    expect(result.vexaMeetingId).toBe("219");
    expect(fetchImpl).toHaveBeenCalledTimes(3);
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
          platform: "zoom",
          native_meeting_id: "12345678901",
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
