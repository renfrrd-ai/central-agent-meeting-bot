import { randomUUID } from "node:crypto";
import type { Env } from "../config/env.js";
import { logLifecycle, type Logger } from "../logging/logger.js";
import { meetingRefKey, type MeetingRef } from "../parsers/index.js";
import type { JoinResult, JoinStatus } from "../parsers/types.js";
import { VexaClient } from "../vexa/client.js";
import {
  isVexaMeetingAccepted,
  isVexaMeetingActive,
  resolveJoinStatus,
} from "../vexa/status.js";
import { VexaApiError } from "../vexa/types.js";
import type { FallbackEngine } from "./fallback.js";
import { isRetriableJoinError } from "./retriable.js";

/** Statuses that mean a bot is (or is becoming) present in a meeting. */
const ACTIVE_STATUSES: ReadonlySet<JoinStatus> = new Set([
  "requested",
  "running",
  "awaiting_admission",
  "joined",
]);

export interface JoinOptions {
  meetingRef: MeetingRef;
  botName?: string;
  force?: boolean;
  correlationId?: string;
  source?: "api" | "email";
}

export interface OrchestratorDeps {
  env: Env;
  logger: Logger;
  vexaClient?: VexaClient;
  /** Optional secondary engine used when a Vexa join fails retriably. */
  fallbackEngine?: FallbackEngine;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class JoinOrchestrator {
  private readonly env: Env;
  private readonly logger: Logger;
  private readonly vexa: VexaClient;
  private readonly fallback?: FallbackEngine;
  /** Meetings with a live Vexa bot, for graceful shutdown. */
  private readonly activeMeetings = new Map<string, MeetingRef>();

  constructor(deps: OrchestratorDeps) {
    this.env = deps.env;
    this.logger = deps.logger;
    this.vexa = deps.vexaClient ?? new VexaClient(deps.env);
    this.fallback = deps.fallbackEngine;
  }

  async join(options: JoinOptions): Promise<JoinResult> {
    const correlationId = options.correlationId ?? randomUUID();
    const { meetingRef } = options;

    logLifecycle(this.logger, "trigger_received", {
      correlationId,
      source: options.source ?? "api",
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

      this.trackActive(meetingRef, status);

      logLifecycle(this.logger, "join_succeeded", {
        correlationId,
        platform: meetingRef.platform,
        native_meeting_id: meetingRef.native_meeting_id,
        status,
        engine: "vexa",
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
      const fallbackResult = await this.tryFallback(meetingRef, correlationId, error);
      if (fallbackResult) {
        return fallbackResult;
      }

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

  /**
   * Attempt the Playwright fallback when configured and the Vexa error is
   * retriable. Returns a successful {@link JoinResult} or `undefined` to let
   * the caller surface the original error.
   */
  private async tryFallback(
    meetingRef: MeetingRef,
    correlationId: string,
    error: unknown,
  ): Promise<JoinResult | undefined> {
    if (!this.fallback || !this.fallback.supports(meetingRef) || !isRetriableJoinError(error)) {
      return undefined;
    }

    logLifecycle(this.logger, "fallback_started", {
      correlationId,
      platform: meetingRef.platform,
      native_meeting_id: meetingRef.native_meeting_id,
      reason: error instanceof VexaApiError ? error.code : "vexa_unavailable",
    });

    try {
      const result = await this.fallback.join(meetingRef, correlationId);
      this.trackActive(meetingRef, result.status);

      logLifecycle(this.logger, "join_succeeded", {
        correlationId,
        platform: meetingRef.platform,
        native_meeting_id: meetingRef.native_meeting_id,
        status: result.status,
        engine: "playwright",
      });

      return {
        success: true,
        status: result.status,
        meetingRef,
        correlationId,
        message: "Bot joined via Playwright fallback",
      };
    } catch (fallbackError) {
      logLifecycle(this.logger, "fallback_failed", {
        correlationId,
        platform: meetingRef.platform,
        native_meeting_id: meetingRef.native_meeting_id,
        error:
          fallbackError instanceof Error ? fallbackError.message : "Unknown fallback error",
        screenshotPath:
          (fallbackError as { screenshotPath?: string } | undefined)?.screenshotPath,
      });
      return undefined;
    }
  }

  private trackActive(meetingRef: MeetingRef, status: JoinStatus): void {
    if (ACTIVE_STATUSES.has(status)) {
      this.activeMeetings.set(meetingRefKey(meetingRef), meetingRef);
    }
  }

  async getStatus(meetingRef: MeetingRef): Promise<JoinStatus> {
    const [running, meeting] = await Promise.all([
      this.vexa.listRunningBots(),
      this.vexa.findMeeting(meetingRef),
    ]);
    const bot = this.vexa.findRunningBot(running, meetingRef);
    if (!bot && !meeting) return "stopped";
    return resolveJoinStatus({ bot, meeting });
  }

  async leave(meetingRef: MeetingRef): Promise<void> {
    await this.vexa.stopBot(meetingRef);
    this.activeMeetings.delete(meetingRefKey(meetingRef));
  }

  /**
   * Stop tracked Vexa bots and close any fallback browser sessions.
   * Best-effort: individual stop failures are logged but never thrown so a
   * single stuck bot cannot block process shutdown.
   */
  async shutdown(): Promise<void> {
    const meetings = [...this.activeMeetings.values()];
    logLifecycle(this.logger, "shutdown_started", { activeBots: meetings.length });

    await Promise.allSettled(
      meetings.map(async (meetingRef) => {
        try {
          await this.vexa.stopBot(meetingRef);
          logLifecycle(this.logger, "bot_stopped", {
            platform: meetingRef.platform,
            native_meeting_id: meetingRef.native_meeting_id,
          });
        } catch (error) {
          this.logger.warn(
            {
              platform: meetingRef.platform,
              native_meeting_id: meetingRef.native_meeting_id,
              error: error instanceof Error ? error.message : String(error),
            },
            "shutdown_stop_failed",
          );
        }
      }),
    );

    this.activeMeetings.clear();

    if (this.fallback) {
      await this.fallback.close();
    }
  }

  /**
   * Poll container + meeting lifecycle until `active` or timeout.
   * @see https://docs.vexa.ai/concepts
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
      const [running, meeting] = await Promise.all([
        this.vexa.listRunningBots(),
        this.vexa.findMeeting(meetingRef),
      ]);
      const bot = this.vexa.findRunningBot(running, meetingRef);

      if (bot || meeting) {
        lastStatus = resolveJoinStatus({ bot, meeting });
        logLifecycle(this.logger, "vexa_status", {
          correlationId,
          platform: meetingRef.platform,
          native_meeting_id: meetingRef.native_meeting_id,
          status: lastStatus,
          meetingStatus: meeting?.status,
          normalizedStatus: bot?.normalized_status,
          rawStatus: bot?.status,
        });

        if (isVexaMeetingActive(meeting?.status)) {
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
