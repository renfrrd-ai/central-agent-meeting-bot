import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../src/app.js";
import { loadEnv, resetEnvCache } from "../../src/config/env.js";
import type { JoinOrchestrator } from "../../src/orchestrator/join.js";

const testEnv = loadEnv({
  API_KEY: "test-api-key",
  VEXA_API_KEY: "test-vexa-key",
  VEXA_API_BASE: "https://api.cloud.vexa.ai",
});

describe("POST /api/join", () => {
  const mockJoin = vi.fn();
  const mockGetStatus = vi.fn();
  const mockLeave = vi.fn();

  const orchestrator = {
    join: mockJoin,
    getStatus: mockGetStatus,
    leave: mockLeave,
  } as unknown as JoinOrchestrator;

  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    resetEnvCache();
    const { registerApiRoutes } = await import("../../src/api/routes.js");
    const Fastify = (await import("fastify")).default;
    const { createLogger } = await import("../../src/logging/logger.js");
    app = Fastify({ logger: false });
    app.get("/health", async () => ({ status: "ok" }));
    await registerApiRoutes(app, {
      env: testEnv,
      logger: createLogger(testEnv),
      orchestrator,
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 401 without API key", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/join",
      payload: { meetingUrl: "https://meet.google.com/abc-defg-hij" },
    });
    expect(response.statusCode).toBe(401);
  });

  it("joins Google Meet from URL", async () => {
    mockJoin.mockResolvedValueOnce({
      success: true,
      status: "joined",
      correlationId: "corr-1",
      meetingRef: {
        platform: "google_meet",
        native_meeting_id: "abc-defg-hij",
      },
      vexaMeetingId: "m-1",
      message: "ok",
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/join",
      headers: { "x-api-key": "test-api-key" },
      payload: { meetingUrl: "https://meet.google.com/abc-defg-hij" },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.data.meetingRef.platform).toBe("google_meet");
    expect(mockJoin).toHaveBeenCalledOnce();
  });

  it("joins Teams from URL", async () => {
    mockJoin.mockResolvedValueOnce({
      success: true,
      status: "joined",
      correlationId: "corr-2",
      meetingRef: {
        platform: "teams",
        native_meeting_id: "1234567890123",
        passcode: "xyz",
      },
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/join",
      headers: { "x-api-key": "test-api-key" },
      payload: {
        meetingUrl: "https://teams.live.com/meet/1234567890123?p=xyz",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.meetingRef.platform).toBe("teams");
  });

  it("joins Zoom from URL", async () => {
    mockJoin.mockResolvedValueOnce({
      success: true,
      status: "joined",
      correlationId: "corr-3",
      meetingRef: {
        platform: "zoom",
        native_meeting_id: "12345678901",
      },
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/join",
      headers: { "x-api-key": "test-api-key" },
      payload: { meetingUrl: "https://zoom.us/j/12345678901" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.meetingRef.platform).toBe("zoom");
  });

  it("returns 400 for invalid meeting URL", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/join",
      headers: { "x-api-key": "test-api-key" },
      payload: { meetingUrl: "https://example.com/nope" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().success).toBe(false);
  });

  it("returns 400 for Teams URL without passcode", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/join",
      headers: { "x-api-key": "test-api-key" },
      payload: {
        meetingUrl: "https://teams.microsoft.com/l/meetup-join/foo/1234567890123",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("missing_passcode");
  });
});

describe("GET /health", () => {
  it("is public", async () => {
    resetEnvCache();
    const app = await buildApp(testEnv);
    await app.ready();
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
    await app.close();
  });
});
