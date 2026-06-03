import { randomUUID } from "node:crypto";
import type { Env } from "../config/env.js";
import type { Logger } from "../logging/logger.js";
import type { JoinOrchestrator } from "../orchestrator/join.js";
import { validateMeetingRefForVexa } from "../vexa/validate.js";
import { isAutoReplyEmail } from "./auto-reply.js";
import { DedupStore } from "./dedup-store.js";
import { extractMeetingRefFromInvite } from "./invite-extractor.js";
import { SenderRateLimiter } from "./rate-limit.js";
import type { ResendReceivingClient } from "./resend-client.js";
import { isSenderAllowed, parseEmailAddress } from "./sender-allowlist.js";

export interface EmailReceivedEvent {
  type: "email.received";
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject?: string;
  };
}

export interface EmailInviteProcessorDeps {
  env: Env;
  logger: Logger;
  orchestrator: JoinOrchestrator;
  resendClient: ResendReceivingClient;
  dedupStore?: DedupStore;
  rateLimiter?: SenderRateLimiter;
}

export class EmailInviteProcessor {
  private readonly env: Env;
  private readonly logger: Logger;
  private readonly orchestrator: JoinOrchestrator;
  private readonly resendClient: ResendReceivingClient;
  private readonly dedupStore: DedupStore;
  private readonly rateLimiter: SenderRateLimiter;

  constructor(deps: EmailInviteProcessorDeps) {
    this.env = deps.env;
    this.logger = deps.logger;
    this.orchestrator = deps.orchestrator;
    this.resendClient = deps.resendClient;
    this.dedupStore = deps.dedupStore ?? new DedupStore();
    this.rateLimiter =
      deps.rateLimiter ??
      new SenderRateLimiter(deps.env.EMAIL_JOIN_RATE_LIMIT_PER_HOUR);
  }

  async processEvent(event: EmailReceivedEvent): Promise<void> {
    if (event.type !== "email.received") {
      return;
    }

    const { email_id: emailId, from, subject } = event.data;
    const sender = parseEmailAddress(from);

    this.logger.info(
      {
        event: "email_webhook_received",
        emailId,
        from: sender,
        subject,
      },
      "email_webhook_received",
    );

    if (!this.dedupStore.tryMark(`email:${emailId}`)) {
      this.logger.info({ emailId }, "email_duplicate_skipped");
      return;
    }

    if (!isSenderAllowed(from, this.env)) {
      this.logger.warn({ from: sender, emailId }, "email_sender_rejected");
      return;
    }

    if (!this.rateLimiter.canProceed(sender)) {
      this.logger.warn({ from: sender, emailId }, "email_rate_limited");
      return;
    }

    const email = await this.resendClient.getReceivedEmail(emailId);
    if (!email) {
      this.logger.error({ emailId }, "email_fetch_failed");
      return;
    }

    if (email.messageId && !this.dedupStore.tryMark(`mid:${email.messageId}`)) {
      this.logger.info({ emailId, messageId: email.messageId }, "email_duplicate_skipped");
      return;
    }

    if (isAutoReplyEmail(email.headers)) {
      this.logger.info({ emailId, from: sender }, "email_auto_reply_skipped");
      return;
    }

    const meetingRef = extractMeetingRefFromInvite(
      email.text,
      email.html,
      email.subject,
    );

    if (!meetingRef) {
      this.logger.warn({ emailId, from: sender }, "email_no_meeting_link");
      return;
    }

    try {
      validateMeetingRefForVexa(meetingRef);
    } catch (error) {
      this.logger.warn(
        {
          emailId,
          from: sender,
          error: error instanceof Error ? error.message : "validation_error",
        },
        "email_meeting_link_invalid",
      );
      return;
    }

    this.rateLimiter.record(sender);

    const correlationId = randomUUID();
    this.logger.info(
      {
        event: "email_join_triggered",
        emailId,
        from: sender,
        correlationId,
        platform: meetingRef.platform,
        native_meeting_id: meetingRef.native_meeting_id,
      },
      "email_join_triggered",
    );

    await this.orchestrator.join({
      meetingRef,
      botName: this.env.BOT_DISPLAY_NAME,
      correlationId,
      source: "email",
    });
  }
}
