import { describe, expect, it, vi } from "vitest";
import { loadEnv } from "../../src/config/env.js";
import { createLogger } from "../../src/logging/logger.js";
import type { FallbackEngine } from "../../src/orchestrator/fallback.js";
import { JoinOrchestrator } from "../../src/orchestrator/join.js";
import { isRetriableJoinError } from "../../src/orchestrator/retriable.js";
import { VexaClient } from "../../src/vexa/client.js";
import { VexaApiError } from "../../src/vexa/types.js";

const testEnv = loadEnv({
  VEXA_API_KEY: "test-vexa-key",
  VEXA_JOIN_POLL_INTERVAL_MS: "10",
  VEXA_JOIN_TIMEOUT_MS: "50",
});

const meetingRef = {
  platform: "google_meet" as const,
  native_meeting_id: "abc-defg-hij",
};

/** fetch mock: empty running bots, then POST /bots returns the given status. */
function vexaFailingFetch(postStatus: number): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url.includes("/bots/status")) {
      return new Response(JSON.stringify({ running_bots: [] }), { status: 200 });
    }
    if (method === "POST" && url.endsWith("/bots")) {
      return new Response(JSON.stringify({ detail: "boom" }), { status: postStatus });
    }
    return new Response(JSON.stringify({ detail: "not found" }), { status: 404 });
  }) as unknown as typeof fetch;
}

function fakeFallback(overrides: Partial<FallbackEngine> = {}): FallbackEngine {
  return {
    supports: () => true,
    join: vi.fn(async () => ({ status: "joined" as const })),
    close: vi.fn(async () => {}),
    ...overrides,
  };
}

describe("isRetriableJoinError", () => {
  it("retries on Vexa 5xx and 429", () => {
    expect(isRetriableJoinError(new VexaApiError(500, "vexa_5xx", "x"))).toBe(true);
    expect(isRetriableJoinError(new VexaApiError(429, "vexa_4xx", "x"))).toBe(true);
  });

  it("does not retry on deterministic Vexa 4xx", () => {
    expect(isRetriableJoinError(new VexaApiError(400, "vexa_4xx", "x"))).toBe(false);
    expect(isRetriableJoinError(new VexaApiError(404, "vexa_4xx", "x"))).toBe(false);
  });

  it("retries on generic network errors", () => {
    expect(isRetriableJoinError(new Error("ECONNREFUSED"))).toBe(true);
  });
});

describe("JoinOrchestrator fallback", () => {
  it("falls back to the engine when Vexa fails with a 5xx", async () => {
    const fallback = fakeFallback();
    const orchestrator = new JoinOrchestrator({
      env: testEnv,
      logger: createLogger(testEnv),
      vexaClient: new VexaClient(testEnv, { fetchImpl: vexaFailingFetch(500) }),
      fallbackEngine: fallback,
    });

    const result = await orchestrator.join({ meetingRef });

    expect(result.success).toBe(true);
    expect(result.status).toBe("joined");
    expect(result.message).toMatch(/fallback/i);
    expect(fallback.join).toHaveBeenCalledTimes(1);
  });

  it("does not fall back on a deterministic 4xx", async () => {
    const fallback = fakeFallback();
    const orchestrator = new JoinOrchestrator({
      env: testEnv,
      logger: createLogger(testEnv),
      vexaClient: new VexaClient(testEnv, { fetchImpl: vexaFailingFetch(400) }),
      fallbackEngine: fallback,
    });

    await expect(orchestrator.join({ meetingRef })).rejects.toBeInstanceOf(VexaApiError);
    expect(fallback.join).not.toHaveBeenCalled();
  });

  it("skips unsupported platforms", async () => {
    const fallback = fakeFallback({ supports: () => false });
    const orchestrator = new JoinOrchestrator({
      env: testEnv,
      logger: createLogger(testEnv),
      vexaClient: new VexaClient(testEnv, { fetchImpl: vexaFailingFetch(500) }),
      fallbackEngine: fallback,
    });

    await expect(orchestrator.join({ meetingRef })).rejects.toBeInstanceOf(VexaApiError);
    expect(fallback.join).not.toHaveBeenCalled();
  });

  it("surfaces the original error when the fallback also fails", async () => {
    const fallback = fakeFallback({
      join: vi.fn(async () => {
        throw new Error("browser crashed");
      }),
    });
    const orchestrator = new JoinOrchestrator({
      env: testEnv,
      logger: createLogger(testEnv),
      vexaClient: new VexaClient(testEnv, { fetchImpl: vexaFailingFetch(503) }),
      fallbackEngine: fallback,
    });

    await expect(orchestrator.join({ meetingRef })).rejects.toBeInstanceOf(VexaApiError);
    expect(fallback.join).toHaveBeenCalledTimes(1);
  });

  it("closes fallback sessions on shutdown", async () => {
    const fallback = fakeFallback();
    const orchestrator = new JoinOrchestrator({
      env: testEnv,
      logger: createLogger(testEnv),
      vexaClient: new VexaClient(testEnv, { fetchImpl: vexaFailingFetch(500) }),
      fallbackEngine: fallback,
    });

    await orchestrator.join({ meetingRef });
    await orchestrator.shutdown();

    expect(fallback.close).toHaveBeenCalledTimes(1);
  });
});

describe("JoinOrchestrator shutdown", () => {
  it("stops tracked Vexa bots", async () => {
    const deleteCalls: string[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (method === "DELETE") {
        deleteCalls.push(url);
        return new Response(JSON.stringify({ message: "stopping" }), { status: 202 });
      }
      if (url.includes("/bots/status")) {
        return new Response(JSON.stringify({ running_bots: [] }), { status: 200 });
      }
      if (url.includes("/meetings")) {
        return new Response(
          JSON.stringify({ meetings: [{ id: 1, ...meetingRef, status: "active" }] }),
          { status: 200 },
        );
      }
      if (method === "POST" && url.endsWith("/bots")) {
        return new Response(JSON.stringify({ id: 1, ...meetingRef, status: "requested" }), {
          status: 201,
        });
      }
      return new Response(JSON.stringify({ detail: "not found" }), { status: 404 });
    }) as unknown as typeof fetch;

    const orchestrator = new JoinOrchestrator({
      env: testEnv,
      logger: createLogger(testEnv),
      vexaClient: new VexaClient(testEnv, { fetchImpl }),
    });

    await orchestrator.join({ meetingRef });
    await orchestrator.shutdown();

    expect(deleteCalls).toHaveLength(1);
    expect(deleteCalls[0]).toContain("/bots/google_meet/abc-defg-hij");
  });
});
