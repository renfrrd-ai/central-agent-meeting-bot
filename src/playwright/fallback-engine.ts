import type { Browser } from "playwright";
import type { Env } from "../config/env.js";
import type { Logger } from "../logging/logger.js";
import type { FallbackEngine, FallbackResult } from "../orchestrator/fallback.js";
import { meetingRefKey, type MeetingRef } from "../parsers/index.js";

/**
 * Playwright-based fallback that joins Google Meet directly in Chromium.
 *
 * Playwright is imported lazily inside {@link join} so the browser stack is only
 * loaded when a fallback actually runs — app startup stays free of it.
 */
export class PlaywrightFallbackEngine implements FallbackEngine {
  private readonly env: Env;
  private readonly logger: Logger;
  private readonly sessions = new Map<string, Browser>();

  constructor(env: Env, logger: Logger) {
    this.env = env;
    this.logger = logger;
  }

  supports(meetingRef: MeetingRef): boolean {
    return meetingRef.platform === "google_meet";
  }

  async join(meetingRef: MeetingRef, correlationId: string): Promise<FallbackResult> {
    const { joinGoogleMeet, FallbackJoinError } = await import("./join-google-meet.js");
    try {
      const outcome = await joinGoogleMeet({
        meetingRef,
        env: this.env,
        logger: this.logger,
        correlationId,
      });
      this.sessions.set(meetingRefKey(meetingRef), outcome.browser);
      return {
        status: outcome.joined ? "joined" : "awaiting_admission",
        screenshotPath: outcome.screenshotPath,
      };
    } catch (error) {
      if (error instanceof FallbackJoinError) {
        const wrapped = new Error(error.message);
        (wrapped as Error & { screenshotPath?: string }).screenshotPath = error.screenshotPath;
        throw wrapped;
      }
      throw error;
    }
  }

  async close(): Promise<void> {
    for (const [, browser] of this.sessions) {
      try {
        await browser.close();
      } catch {
        // best-effort teardown
      }
    }
    this.sessions.clear();
  }
}
