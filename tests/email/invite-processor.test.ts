import { describe, expect, it, vi } from "vitest";
import { loadEnv, resetEnvCache } from "../../src/config/env.js";
import { createLogger } from "../../src/logging/logger.js";
import { DedupStore } from "../../src/email/dedup-store.js";
import { EmailInviteProcessor } from "../../src/email/invite-processor.js";
import type { JoinOrchestrator } from "../../src/orchestrator/join.js";
import type { ResendReceivingClient } from "../../src/email/resend-client.js";

const testEnv = loadEnv({
  VEXA_API_KEY: "test-key",
  INVITE_SENDER_MODE: "open",
  BOT_DISPLAY_NAME: "Test Bot",
});

describe("EmailInviteProcessor", () => {
  it("joins meeting when invite contains Meet link", async () => {
    resetEnvCache();
    const mockJoin = vi.fn().mockResolvedValue({
      success: true,
      status: "joined",
      correlationId: "c1",
      meetingRef: {
        platform: "google_meet",
        native_meeting_id: "abc-defg-hij",
      },
    });

    const orchestrator = { join: mockJoin } as unknown as JoinOrchestrator;
    const resendClient: ResendReceivingClient = {
      getReceivedEmail: vi.fn().mockResolvedValue({
        id: "email-1",
        from: "host@example.com",
        to: ["bot@resend.app"],
        subject: "Team sync",
        html: '<a href="https://meet.google.com/abc-defg-hij">Join</a>',
        headers: {},
      }),
    };

    const processor = new EmailInviteProcessor({
      env: testEnv,
      logger: createLogger(testEnv),
      orchestrator,
      resendClient,
      dedupStore: new DedupStore(),
    });

    await processor.processEvent({
      type: "email.received",
      data: {
        email_id: "email-1",
        from: "host@example.com",
        to: ["bot@resend.app"],
        subject: "Team sync",
      },
    });

    expect(mockJoin).toHaveBeenCalledOnce();
    expect(mockJoin).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "email",
        meetingRef: expect.objectContaining({
          platform: "google_meet",
          native_meeting_id: "abc-defg-hij",
        }),
      }),
    );
  });

  it("skips duplicate email_id", async () => {
    resetEnvCache();
    const mockJoin = vi.fn().mockResolvedValue({
      success: true,
      status: "joined",
      correlationId: "c1",
      meetingRef: {
        platform: "google_meet",
        native_meeting_id: "abc-defg-hij",
      },
    });
    const resendClient: ResendReceivingClient = {
      getReceivedEmail: vi.fn().mockResolvedValue({
        id: "dup-1",
        from: "host@example.com",
        to: ["bot@resend.app"],
        subject: "sync",
        html: '<a href="https://meet.google.com/abc-defg-hij">x</a>',
        headers: {},
      }),
    };

    const processor = new EmailInviteProcessor({
      env: testEnv,
      logger: createLogger(testEnv),
      orchestrator: { join: mockJoin } as unknown as JoinOrchestrator,
      resendClient,
      dedupStore: new DedupStore(),
    });

    const event = {
      type: "email.received" as const,
      data: {
        email_id: "dup-1",
        from: "host@example.com",
        to: ["bot@resend.app"],
      },
    };

    await processor.processEvent(event);
    await processor.processEvent(event);

    expect(resendClient.getReceivedEmail).toHaveBeenCalledOnce();
    expect(mockJoin).toHaveBeenCalledOnce();
  });

  it("rejects disallowed sender in strict mode", async () => {
    resetEnvCache();
    const strictEnv = loadEnv({
      VEXA_API_KEY: "test-key",
      INVITE_SENDER_MODE: "strict",
      ALLOWED_INVITE_SENDERS: "allowed@example.com",
    });

    const mockJoin = vi.fn();
    const resendClient: ResendReceivingClient = {
      getReceivedEmail: vi.fn(),
    };

    const processor = new EmailInviteProcessor({
      env: strictEnv,
      logger: createLogger(strictEnv),
      orchestrator: { join: mockJoin } as unknown as JoinOrchestrator,
      resendClient,
    });

    await processor.processEvent({
      type: "email.received",
      data: {
        email_id: "email-2",
        from: "stranger@example.com",
        to: ["bot@resend.app"],
      },
    });

    expect(resendClient.getReceivedEmail).not.toHaveBeenCalled();
    expect(mockJoin).not.toHaveBeenCalled();
  });
});
