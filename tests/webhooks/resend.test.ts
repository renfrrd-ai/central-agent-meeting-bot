import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import Fastify from "fastify";
import { loadEnv, resetEnvCache } from "../../src/config/env.js";
import { createLogger } from "../../src/logging/logger.js";
import type { JoinOrchestrator } from "../../src/orchestrator/join.js";
import { EmailInviteProcessor } from "../../src/email/invite-processor.js";
import { registerResendWebhookRoutes } from "../../src/webhooks/resend-routes.js";

const testEnv = loadEnv({
  VEXA_API_KEY: "test-vexa-key",
  RESEND_API_KEY: "re_test",
  RESEND_WEBHOOK_SECRET: "whsec_test",
});

describe("POST /webhooks/resend (configured)", () => {
  const mockProcessEvent = vi.fn().mockResolvedValue(undefined);
  const processor = {
    processEvent: mockProcessEvent,
  } as unknown as EmailInviteProcessor;

  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    resetEnvCache();
    app = Fastify({ logger: false });
    await registerResendWebhookRoutes(app, {
      env: testEnv,
      logger: createLogger(testEnv),
      orchestrator: { join: vi.fn() } as unknown as JoinOrchestrator,
      processor,
      verifyWebhook: (_payload, _headers) => ({
        type: "email.received",
        data: {
          email_id: "email-99",
          from: "host@example.com",
          to: ["bot@resend.app"],
        },
      }),
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 200 and processes email.received asynchronously", async () => {
    mockProcessEvent.mockClear();

    const response = await app.inject({
      method: "POST",
      url: "/webhooks/resend",
      headers: {
        "content-type": "application/json",
        "svix-id": "msg_1",
        "svix-timestamp": "123",
        "svix-signature": "v1,abc",
      },
      payload: JSON.stringify({ type: "email.received" }),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true, received: true });

    await vi.waitFor(() => {
      expect(mockProcessEvent).toHaveBeenCalledOnce();
    });
  });

  it("returns 400 when signature verification fails", async () => {
    const badApp = Fastify({ logger: false });
    await registerResendWebhookRoutes(badApp, {
      env: testEnv,
      logger: createLogger(testEnv),
      orchestrator: { join: vi.fn() } as unknown as JoinOrchestrator,
      processor,
      verifyWebhook: () => {
        throw new Error("bad signature");
      },
    });
    await badApp.ready();

    const response = await badApp.inject({
      method: "POST",
      url: "/webhooks/resend",
      headers: { "content-type": "application/json" },
      payload: "{}",
    });

    expect(response.statusCode).toBe(400);
    await badApp.close();
  });

  it("ignores non email.received events", async () => {
    const ignoreApp = Fastify({ logger: false });
    await registerResendWebhookRoutes(ignoreApp, {
      env: testEnv,
      logger: createLogger(testEnv),
      orchestrator: { join: vi.fn() } as unknown as JoinOrchestrator,
      processor,
      verifyWebhook: () => ({ type: "email.delivered" }),
    });
    await ignoreApp.ready();

    mockProcessEvent.mockClear();
    const response = await ignoreApp.inject({
      method: "POST",
      url: "/webhooks/resend",
      headers: { "content-type": "application/json" },
      payload: "{}",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ success: true, ignored: true });
    expect(mockProcessEvent).not.toHaveBeenCalled();
    await ignoreApp.close();
  });
});

describe("POST /webhooks/resend (not configured)", () => {
  it("returns 503 instead of 404 when Resend env vars are missing", async () => {
    resetEnvCache();
    const env = loadEnv({
      VEXA_API_KEY: "test-vexa-key",
      RESEND_API_KEY: undefined,
      RESEND_WEBHOOK_SECRET: undefined,
    });

    const app = Fastify({ logger: false });
    await registerResendWebhookRoutes(app, {
      env,
      logger: createLogger(env),
      orchestrator: { join: vi.fn() } as unknown as JoinOrchestrator,
    });
    await app.ready();

    const response = await app.inject({
      method: "POST",
      url: "/webhooks/resend",
      headers: { "content-type": "application/json" },
      payload: "{}",
    });

    expect(response.statusCode).toBe(503);
    expect(response.json().error).toBe("webhook_not_configured");
    await app.close();
  });
});

describe("GET /webhooks/resend", () => {
  it("returns endpoint info for debugging", async () => {
    resetEnvCache();
    const app = Fastify({ logger: false });
    await registerResendWebhookRoutes(app, {
      env: testEnv,
      logger: createLogger(testEnv),
      orchestrator: { join: vi.fn() } as unknown as JoinOrchestrator,
    });
    await app.ready();

    const response = await app.inject({ method: "GET", url: "/webhooks/resend" });
    expect(response.statusCode).toBe(200);
    expect(response.json().endpoint).toBe("/webhooks/resend");
    await app.close();
  });
});
