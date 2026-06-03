import { randomUUID } from "node:crypto";
import type { Env } from "../config/env.js";
import { logLifecycle, type Logger } from "../logging/logger.js";
import { meetingRefKey, type MeetingRef } from "../parsers/index.js";
import type { JoinResult, JoinStatus } from "../parsers/types.js";
import { VexaClient } from "../vexa/client.js";
import {
  isVexaBotRunning,
  isVexaMeetingAccepted,
  mapVexaBotStatus,
} from "../vexa/status.js";
import { VexaApiError } from "../vexa/types.js";

export interface JoinOptions {
  meetingRef: MeetingRef;
  botName?: string;
  force?: boolean;
  correlationId?: string;
}

export interface OrchestratorDeps {
  env: Env;
  logger: Logger;
  vexaClient?: VexaClient;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class JoinOrchestrator {
  private readonly env: Env;
  private readonly logger: Logger;
  private readonly vexa: VexaClient;

  constructor(deps: OrchestratorDeps) {
    this.env = deps.env;
    this.logger = deps.logger;
    this.vexa = deps.vexaClient ?? new VexaClient(deps.env);
  }

  async join(options: JoinOptions): Promise<JoinResult> {
    const correlationId = options.correlationId ?? randomUUID();
    const { meetingRef } = options;

    logLifecycle(this.logger, "trigger_received", {
      correlationId,
      source: "api",
      platform: meetingRef.platform,
      native_meeting_id: meetingRef.native_meeting_id,
    });

    logLifecycle(this.logger, "link_parsed", {
      correlationId,
      platform: meetingRef.platform,
      native_meeting_id: meetingRef.native_meeting_id,
    });

    if (!options.force) {
      const running = await this.vexa.listRunningBots();
      const existing = this.vexa.findRunningBot(running, meetingRef);
      if (existing) {
        logLifecycle(this.logger, "duplicate_bot", {
          correlationId,
          platform: meetingRef.platform,
          native_meeting_id: meetingRef.native_meeting_id,
        });
        return {
          success: true,
          status: "duplicate",
          meetingRef,
          correlationId,
          message: "Bot already running for this meeting",
        };
      }
    }

    try {
      logLifecycle(this.logger, "vexa_bot_requested", {
        correlationId,
        platform: meetingRef.platform,
        native_meeting_id: meetingRef.native_meeting_id,
      });

      const created = await this.vexa.createBot(meetingRef, {
        botName: options.botName,
      });

      if (!isVexaMeetingAccepted(created.status)) {
        this.logger.warn(
          {
            correlationId,
            vexaStatus: created.status,
            meetingId: created.id,
          },
          "unexpected_vexa_meeting_status",
        );
      }

      const status = await this.waitForBot(meetingRef, correlationId, created.status);

      logLifecycle(this.logger, "join_succeeded", {
        correlationId,
        platform: meetingRef.platform,
        native_meeting_id: meetingRef.native_meeting_id,
        status,
      });

      return {
        success: true,
        status,
        meetingRef,
        correlationId,
        vexaMeetingId: created.id !== undefined ? String(created.id) : undefined,
        message: "Bot join requested successfully",
      };
    } catch (error) {
      const message =
        error instanceof VexaApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Unknown join error";

      logLifecycle(this.logger, "join_failed", {
        correlationId,
        platform: meetingRef.platform,
        native_meeting_id: meetingRef.native_meeting_id,
        error: message,
        code: error instanceof VexaApiError ? error.code : "join_error",
      });

      throw error;
    }
  }

  async getStatus(meetingRef: MeetingRef): Promise<JoinStatus> {
    const running = await this.vexa.listRunningBots();
    const bot = this.vexa.findRunningBot(running, meetingRef);
    if (!bot) return "stopped";
    return mapVexaBotStatus(bot.normalized_status, bot.status);
  }

  async leave(meetingRef: MeetingRef): Promise<void> {
    await this.vexa.stopBot(meetingRef);
  }

  /**
   * Poll GET /bots/status until normalized_status is "Up" or timeout.
   * @see https://docs.vexa.ai/api/bots#get-botsstatus
   */
  private async waitForBot(
    meetingRef: MeetingRef,
    correlationId: string,
    createdStatus?: string,
  ): Promise<JoinStatus> {
    const deadline = Date.now() + this.env.VEXA_JOIN_TIMEOUT_MS;
    let lastStatus: JoinStatus = isVexaMeetingAccepted(createdStatus)
      ? "running"
      : "requested";

    while (Date.now() < deadline) {
      const running = await this.vexa.listRunningBots();
      const bot = this.vexa.findRunningBot(running, meetingRef);

      if (bot) {
        lastStatus = mapVexaBotStatus(bot.normalized_status, bot.status);
        logLifecycle(this.logger, "vexa_status", {
          correlationId,
          platform: meetingRef.platform,
          native_meeting_id: meetingRef.native_meeting_id,
          status: lastStatus,
          normalizedStatus: bot.normalized_status,
          rawStatus: bot.status,
        });

        if (isVexaBotRunning(bot.normalized_status, bot.status)) {
          return "joined";
        }

        if (lastStatus === "failed" || lastStatus === "stopped") {
          return lastStatus;
        }
      }

      await sleep(this.env.VEXA_JOIN_POLL_INTERVAL_MS);
    }

    return lastStatus;
  }
}

export { meetingRefKey };
